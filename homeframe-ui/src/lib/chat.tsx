import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useRef,
  useState,
  type ReactNode,
} from 'react';
import { useHomeframeUpdate, useNavigate, useRouterSnapshot } from '@builtbyted/homeframe';
import { io, type Socket } from 'socket.io-client';
import { api, errorMessage, segment, token } from './api';
import { applyCompletion, branch, latestLeaf, normalizeHistory } from './history';
import { useSession } from './session';
import {
  object,
  text,
  items,
  type Attachment,
  type Chat,
  type ChatSummary,
  type Dict,
  type Message,
} from './types';
import { disposePython, executePython } from './python';
import { parametersKey, readJSON, writeJSON, readDraft, type Draft } from './storage';

export interface Interaction {
  id: string;
  type: string;
  data: Dict;
  chatId: string;
  reply: (answer: unknown) => void;
}
export const cancelledInteraction = (type: string) =>
  type === 'request:user_input'
    ? { status: 'cancelled', answers: {} }
    : type === 'request:elicitation'
      ? { action: 'cancel' }
      : type === 'input'
        ? null
        : false;

interface ChatContext {
  chat: Chat | null;
  loading: boolean;
  busy: boolean;
  error: string;
  connected: boolean;
  temporary: boolean;
  interaction: Interaction | null;
  respond: (id: string, answer: unknown) => void;
  list: ChatSummary[];
  refreshList: () => Promise<void>;
  refreshChat: () => Promise<void>;
  model: string;
  setModel: (model: string) => void;
  features: Record<string, boolean>;
  setFeatures: (features: Record<string, boolean>) => void;
  send: (
    content: string,
    files?: Attachment[],
    parent?: string | null,
    reuseUserMessage?: Message,
    options?: Draft,
  ) => Promise<void>;
  stop: () => Promise<void>;
  selectBranch: (id: string) => Promise<void>;
  updateChat: (data: Dict) => Promise<void>;
}
const Context = createContext<ChatContext | null>(null);
export const useChat = () => {
  const context = useContext(Context);
  if (!context) throw new Error('Missing chat provider');
  return context;
};
const blank = (): Chat => ({
  id: '',
  title: 'New chat',
  chat: { history: { messages: {}, currentId: null } },
});

export function ChatProvider({ children }: { children: ReactNode }) {
  const { user, models, config, settings } = useSession();
  const route = useRouterSnapshot();
  const navigate = useNavigate();
  const routeId = /^\/c\/([^/]+)/.exec(route.url.pathname)?.[1] ?? '';
  const newFolder = route.url.searchParams.get('folder') ?? '';
  const isChat = route.url.pathname === '/' || route.url.pathname === '/home' || !!routeId;
  const temporary =
    !routeId &&
    (user?.role === 'admin' || user?.permissions?.chat?.temporary === true) &&
    ((user?.role !== 'admin' && user?.permissions?.chat?.temporary_enforced === true) ||
      route.url.searchParams.get('temporary-chat') === 'true' ||
      object(settings.ui).temporaryChatByDefault === true);

  const [chat, setChat] = useState<Chat | null>(null);
  const current = useRef(chat);
  current.current = chat;
  const [list, setList] = useState<ChatSummary[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const [connected, setConnected] = useState(false);
  const [interactions, setInteractions] = useState<Interaction[]>([]);
  const pendingInteractions = useRef(interactions);
  pendingInteractions.current = interactions;
  const respond = (id: string, answer: unknown) => {
    const item = pendingInteractions.current.find((item) => item.id === id);
    if (!item) return;
    pendingInteractions.current = pendingInteractions.current.filter((item) => item.id !== id);
    setInteractions(pendingInteractions.current);
    item.reply(answer);
  };
  const savedModels = object(settings.ui).models;
  const preferred = Array.isArray(savedModels)
    ? text(savedModels[0])
    : config.default_models?.split(',')[0];
  const initialModel = models.find((item) => item.id === preferred)?.id ?? models[0]?.id ?? '';
  const modelFeatures = (id: string): Record<string, boolean> => {
    const defaults = models.find((item) => item.id === id)?.info?.meta?.defaultFeatureIds ?? [];
    return {
      web_search: defaults.includes('web_search') || object(settings.ui).webSearch === 'always',
      code_interpreter: defaults.includes('code_interpreter'),
      image_generation: defaults.includes('image_generation'),
      memory: object(settings.ui).memory === true,
    };
  };
  const [model, setModelValue] = useState(initialModel);
  const [features, setFeatures] = useState<Record<string, boolean>>(() =>
    modelFeatures(initialModel),
  );
  const socket = useRef<Socket | null>(null);
  const selectedRoute = useRef(routeId);
  selectedRoute.current = routeId;
  const update = useHomeframeUpdate();
  const running = useRef(new Set<string>());
  useEffect(
    () =>
      update.registerGuard(
        () => !busy && !running.current.size && !pendingInteractions.current.length,
      ),
    [busy, update.registerGuard],
  );

  const refreshList = useCallback(async () => {
    if (!user) {
      setList([]);
      return;
    }
    try {
      setList(
        await api<ChatSummary[]>('/api/v1/chats/?page=1&include_pinned=true&include_folders=true'),
      );
    } catch (reason) {
      setError(errorMessage(reason));
    }
  }, [user]);
  const refreshChat = useCallback(async () => {
    const id = current.current?.id;
    if (!id) return;
    if (id.startsWith('temporary:')) {
      const tasks = await api<{ task_ids: string[] }>(`/api/tasks/chat/${segment(id)}`);
      if (current.current?.id !== id) return;
      setBusy(tasks.task_ids.length > 0);
      if (!tasks.task_ids.length) running.current.delete(id);
      return;
    }
    const [saved, tasks] = await Promise.all([
      api<Chat>(`/api/v1/chats/${segment(id)}`),
      api<{ task_ids: string[] }>(`/api/tasks/chat/${segment(id)}`),
    ]);
    if (current.current?.id !== id) return;
    saved.chat.history = normalizeHistory(saved.chat);
    const active = tasks.task_ids.length > 0;
    if (active) running.current.add(id);
    else running.current.delete(id);
    // A periodic database snapshot can lag a live token stream. Preserve the
    // streamed branch until the server says the task has actually finished.
    if (!active) setChat(saved);
    else
      setChat((previous) =>
        previous
          ? {
              ...previous,
              title: saved.title,
              pinned: saved.pinned ?? false,
              archived: saved.archived ?? false,
              folder_id: saved.folder_id ?? '',
              share_id: saved.share_id ?? '',
            }
          : saved,
      );
    setBusy(active);
  }, []);
  useEffect(() => {
    const timer = setInterval(() => {
      for (const id of running.current) {
        void api<{ task_ids: string[] }>(`/api/tasks/chat/${segment(id)}`)
          .then((tasks) => {
            if (!tasks.task_ids.length) running.current.delete(id);
          })
          .catch(() => {});
      }
    }, 30000);
    return () => clearInterval(timer);
  }, []);
  const latestRefresh = useRef(refreshChat);
  latestRefresh.current = refreshChat;
  const setModel = (id: string) => {
    setModelValue(id);
    setFeatures(modelFeatures(id));
  };
  useEffect(() => {
    if (!models.length || models.some((item) => item.id === model)) return;
    const saved = object(settings.ui).models;
    const preference = Array.isArray(saved) ? text(saved[0]) : config.default_models?.split(',')[0];
    setModel(models.find((item) => item.id === preference)?.id ?? models[0]!.id);
  }, [models, config.default_models, settings]);
  useEffect(() => {
    void refreshList();
  }, [refreshList]);

  useEffect(() => {
    if (!user) return;
    const client = io({
      path: '/ws/socket.io',
      transports: ['websocket', 'polling'],
      auth: (callback) => callback({ token: token() }),
      reconnectionDelayMax: 5000,
    });
    socket.current = client;
    client.on('connect', () => {
      setConnected(true);
      client.emit('user-join', { auth: { token: token() } });
      for (const id of running.current) {
        void api<{ task_ids: string[] }>(`/api/tasks/chat/${segment(id)}`)
          .then((tasks) => {
            if (!tasks.task_ids.length) running.current.delete(id);
          })
          .catch(() => {
            /* Keep the update guard until task state is known. */
          });
      }
      void latestRefresh.current().catch((reason) => setError(errorMessage(reason)));
    });
    client.on('disconnect', () => setConnected(false));
    client.on('connect_error', () => setConnected(false));
    client.on('events', (event: Dict, acknowledge?: (answer: unknown) => void) => {
      const envelope = object(event.data);
      const type = text(envelope.type);
      const data = object(envelope.data);
      if (type === 'chat:active') {
        if (data.active) running.current.add(text(event.chat_id));
        else running.current.delete(text(event.chat_id));
      }
      if (
        (['chat:completion', 'response:completion'].includes(type) && data.done) ||
        ['chat:tasks:cancel', 'chat:message:error'].includes(type)
      )
        running.current.delete(text(event.chat_id));
      if (
        acknowledge &&
        ['request:user_input', 'request:elicitation', 'confirmation', 'input', 'execute'].includes(
          type,
        )
      ) {
        const item: Interaction = {
          id: text(data.interaction_id) || crypto.randomUUID(),
          type,
          data,
          chatId: text(event.chat_id),
          reply: acknowledge,
        };
        setInteractions((previous) => [
          ...previous.filter((existing) => existing.id !== item.id),
          item,
        ]);
        return;
      }
      if (
        type === 'request:interaction:done' ||
        type === 'interaction:resolved' ||
        type === 'interaction:cancelled'
      ) {
        setInteractions((previous) => previous.filter((item) => item.id !== data.interaction_id));
        return;
      }
      if (type === 'execute:python' && data.session_id === client.id && acknowledge) {
        void executePython(data)
          .then(acknowledge)
          .catch((reason) =>
            acknowledge({ stderr: errorMessage(reason), stdout: null, result: null }),
          );
        return;
      }
      if (type === 'chat:title' || type === 'chat:list') void refreshList();
      const active = current.current;
      const messageId = text(event.message_id);
      if (!active || (event.chat_id !== active.id && !active.chat.history.messages[messageId]))
        return;
      if (type === 'chat:active') {
        setBusy(data.active === true);
        if (data.active === false) {
          void latestRefresh.current().catch((reason) => setError(errorMessage(reason)));
          void refreshList();
        }
      }
      if (type === 'chat:title') {
        setChat((previous) =>
          previous
            ? {
                ...previous,
                title: text(envelope.data),
                chat: { ...previous.chat, title: text(envelope.data) },
              }
            : previous,
        );
        return;
      }
      setChat((previous) => {
        const message = previous?.chat.history.messages[messageId];
        if (!previous || !message) return previous;
        let next = { ...message };
        if (type === 'chat:completion' || type === 'response:completion')
          next = applyCompletion(next, data);
        if (type === 'chat:message:delta' || type === 'message') next.content += text(data.content);
        if (type === 'chat:message' || type === 'replace') next.content = text(data.content);
        if (type === 'status') next.statusHistory = [...(next.statusHistory ?? []), data];
        if (type === 'source' || type === 'citation') {
          if (object(data.source).type === 'code_interpreter' || data.type === 'code_interpreter') {
            const previous = Array.isArray(next.code_executions)
              ? (next.code_executions as Dict[])
              : [];
            next.code_executions = [...previous.filter((item) => item.id !== data.id), data];
          } else next.sources = [...(next.sources ?? []), data];
        }
        if (type === 'chat:message:files' || type === 'files')
          next.files = data.files as Attachment[];
        if (type === 'chat:message:follow_ups') next.followUps = data.follow_ups as string[];
        if (type === 'chat:message:error') {
          next.error = data.error;
          next.done = true;
        }
        if (type === 'chat:tasks:cancel') next.done = true;
        if (next.done) setBusy(false);
        const result = {
          ...previous,
          chat: {
            ...previous.chat,
            history: {
              ...previous.chat.history,
              messages: { ...previous.chat.history.messages, [messageId]: next },
            },
          },
        };
        current.current = result;
        return result;
      });
    });
    return () => {
      for (const item of pendingInteractions.current) item.reply(cancelledInteraction(item.type));
      pendingInteractions.current = [];
      client.disconnect();
      socket.current = null;
      setConnected(false);
      disposePython();
    };
  }, [user?.id, refreshList]);

  useEffect(() => {
    if (!user || !isChat) return;
    setError('');
    if (!temporary && routeId && routeId === current.current?.id) return;
    if (!routeId) {
      const initial = blank();
      if (!temporary) initial.chat.params = object(readJSON(parametersKey(user.id, newFolder), {}));
      setChat(initial);
      setBusy(false);
      const savedDraft = temporary
        ? null
        : readDraft(user.id, newFolder ? `folder:${newFolder}` : '');
      const restoreFeatures = (id: string) => ({
        ...modelFeatures(id),
        ...(savedDraft?.webSearchEnabled !== undefined
          ? { web_search: savedDraft.webSearchEnabled }
          : {}),
        ...(savedDraft?.codeInterpreterEnabled !== undefined
          ? { code_interpreter: savedDraft.codeInterpreterEnabled }
          : {}),
        ...(savedDraft?.imageGenerationEnabled !== undefined
          ? { image_generation: savedDraft.imageGenerationEnabled }
          : {}),
      });
      setModelValue(initialModel);
      setFeatures(restoreFeatures(initialModel));
      if (!newFolder) {
        setLoading(false);
        return;
      }
      const abort = new AbortController();
      setLoading(true);
      void api<Dict>(`/api/v1/folders/${segment(newFolder)}`, undefined, { signal: abort.signal })
        .then((folder) => {
          if (abort.signal.aborted) return;
          const selected = text(items(object(folder.data).model_ids)[0]);
          if (models.some((item) => item.id === selected)) {
            setModelValue(selected);
            setFeatures(restoreFeatures(selected));
          }
          setChat({ ...initial, folder_id: newFolder });
        })
        .catch((reason) => {
          if (!abort.signal.aborted) setError(errorMessage(reason));
        })
        .finally(() => {
          if (!abort.signal.aborted) setLoading(false);
        });
      return () => abort.abort();
    }
    const abort = new AbortController();
    setLoading(true);
    setChat(null);
    setBusy(false);
    Promise.all([
      api<Chat>(`/api/v1/chats/${segment(routeId)}`, undefined, { signal: abort.signal }),
      api<{ task_ids: string[] }>(`/api/tasks/chat/${segment(routeId)}`, undefined, {
        signal: abort.signal,
      }),
    ])
      .then(([saved, tasks]) => {
        saved.chat.history = normalizeHistory(saved.chat);
        setChat(saved);
        const active = tasks.task_ids.length > 0;
        setBusy(active);
        if (active) running.current.add(routeId);
        else running.current.delete(routeId);
        if (saved.chat.models?.[0]) {
          const selected = saved.chat.models[0],
            draft = readDraft(user.id, routeId),
            next = modelFeatures(selected);
          if (draft.webSearchEnabled !== undefined) next.web_search = draft.webSearchEnabled;
          if (draft.codeInterpreterEnabled !== undefined)
            next.code_interpreter = draft.codeInterpreterEnabled;
          if (draft.imageGenerationEnabled !== undefined)
            next.image_generation = draft.imageGenerationEnabled;
          setModelValue(selected);
          setFeatures(next);
        }
      })
      .catch((reason) => {
        if (!abort.signal.aborted) setError(errorMessage(reason));
      })
      .finally(() => {
        if (!abort.signal.aborted) setLoading(false);
      });
    return () => abort.abort();
  }, [routeId, isChat, temporary, newFolder, user?.id]);

  useEffect(() => {
    if (!busy || !chat?.id) return;
    const timer = setInterval(() => {
      void refreshChat().catch((reason) => setError(errorMessage(reason)));
    }, 15000);
    return () => clearInterval(timer);
  }, [busy, chat?.id, refreshChat]);

  const send = async (
    content: string,
    files: Attachment[] = [],
    parent?: string | null,
    reuseUserMessage?: Message,
    options?: Draft,
  ) => {
    if (!content.trim()) throw new Error('Enter a message before sending.');
    if (loading) throw new Error('Wait for this conversation to finish loading.');
    if (busy) throw new Error('Wait for this response or stop it before sending another message.');
    if (!socket.current?.connected || !socket.current.id)
      throw new Error(
        'The live connection is reconnecting. Your draft is saved; try again shortly.',
      );
    if (!model) throw new Error('Choose a model before sending.');
    setError('');
    const previous = current.current ?? blank();
    const conversationId = temporary ? `temporary:${socket.current.id}` : previous.id;
    const history = previous.chat.history;
    const parentId = parent === undefined ? history.currentId : parent;
    const userMessage: Message = {
      id: reuseUserMessage?.id ?? crypto.randomUUID(),
      role: 'user',
      content,
      parentId,
      childrenIds: [...(reuseUserMessage?.childrenIds ?? [])],
      timestamp: reuseUserMessage?.timestamp ?? Math.floor(Date.now() / 1000),
      models: [model],
      files,
    };
    const assistant: Message = {
      id: crypto.randomUUID(),
      role: 'assistant',
      content: '',
      model,
      parentId: userMessage.id,
      childrenIds: [],
      timestamp: Math.floor(Date.now() / 1000),
      done: false,
    };
    userMessage.childrenIds.push(assistant.id);
    const messages = {
      ...history.messages,
      [userMessage.id]: userMessage,
      [assistant.id]: assistant,
    };
    if (parentId && messages[parentId])
      messages[parentId] = {
        ...messages[parentId],
        childrenIds: [...new Set([...messages[parentId].childrenIds, userMessage.id])],
      };
    const optimistic: Chat = {
      ...previous,
      id: conversationId,
      chat: { ...previous.chat, models: [model], history: { messages, currentId: assistant.id } },
    };
    current.current = optimistic;
    setChat(optimistic);
    setBusy(true);
    try {
      const payload: Dict = {
        model,
        stream: true,
        session_id: socket.current.id,
        id: assistant.id,
        parent_id: parentId,
        user_message: userMessage,
        ...(conversationId ? { chat_id: conversationId } : {}),
        messages: [...branch(history, parentId), userMessage].map((message) => ({
          role: message.role,
          content: message.content,
          ...(message.files?.some((file) => file.type === 'image')
            ? {
                content: [
                  { type: 'text', text: message.content },
                  ...message.files
                    .filter((file) => file.type === 'image')
                    .map((file) => ({ type: 'image_url', image_url: { url: file.url } })),
                ],
              }
            : {}),
        })),
        files,
        ...(previous.folder_id ? { folder_id: previous.folder_id } : {}),
        features,
        tool_ids: options?.selectedToolIds ?? [],
        skill_ids: options?.selectedSkillIds ?? [],
        filter_ids: options?.selectedFilterIds ?? [],
        params: { ...object(object(settings.ui).params), ...previous.chat.params },
        background_tasks: {
          title_generation: !previous.id && !temporary,
          tags_generation: !previous.id && !temporary,
          follow_up_generation: object(settings.ui).autoFollowUps !== false,
        },
      };
      const response = await api<{ chat_id: string; task_ids: string[]; error?: unknown }>(
        '/api/chat/completions',
        payload,
      );
      if (response.error) throw new Error(errorMessage(response.error));
      if (response.task_ids?.length) running.current.add(response.chat_id);
      if (!temporary && !previous.id && current.current?.chat.history.messages[assistant.id]) {
        setChat((value) => (value ? { ...value, id: response.chat_id } : value));
        current.current = { ...current.current, id: response.chat_id };
        await navigate(`/c/${segment(response.chat_id)}`, {
          replace: true,
          preventScrollReset: true,
        });
      }
      void refreshList();
    } catch (reason) {
      if (current.current?.chat.history.messages[assistant.id]) {
        setBusy(false);
        setError(errorMessage(reason));
        setChat((value) =>
          value?.chat.history.messages[assistant.id]
            ? {
                ...value,
                chat: {
                  ...value.chat,
                  history: {
                    ...value.chat.history,
                    messages: {
                      ...value.chat.history.messages,
                      [assistant.id]: { ...assistant, error: errorMessage(reason), done: true },
                    },
                  },
                },
              }
            : value,
        );
      }
      throw reason;
    }
  };
  const stop = async () => {
    if (!chat?.id) return;
    await api(`/api/tasks/chat/${segment(chat.id)}/stop`, {});
    setBusy(false);
    await refreshChat();
  };
  const updateChat = async (data: Dict) => {
    if (!chat) return;
    if (temporary || !chat.id) {
      if (
        !temporary &&
        user &&
        data.params !== undefined &&
        !writeJSON(parametersKey(user.id, newFolder), data.params)
      )
        throw new Error('Browser storage is full. Conversation settings could not be saved.');
      setChat((value) => (value ? { ...value, chat: { ...value.chat, ...data } } : value));
      return;
    }
    const saved = await api<Chat>(`/api/v1/chats/${segment(chat.id)}`, { chat: data });
    saved.chat.history = normalizeHistory(saved.chat);
    if (current.current?.id === saved.id) {
      // Keep a response streaming while changing conversation metadata.
      if (running.current.has(saved.id))
        setChat((value) =>
          value ? { ...value, title: saved.title, chat: { ...value.chat, ...data } } : value,
        );
      else setChat(saved);
    }
    await refreshList();
  };
  const selectBranch = async (id: string) => {
    if (chat)
      await updateChat({
        history: { ...chat.chat.history, currentId: latestLeaf(chat.chat.history, id) },
      });
  };
  return (
    <Context.Provider
      value={{
        chat,
        loading,
        busy,
        error,
        connected,
        temporary,
        interaction: interactions[0] ?? null,
        respond,
        list,
        refreshList,
        refreshChat,
        model,
        setModel,
        features,
        setFeatures,
        send,
        stop,
        selectBranch,
        updateChat,
      }}
    >
      {children}
    </Context.Provider>
  );
}
