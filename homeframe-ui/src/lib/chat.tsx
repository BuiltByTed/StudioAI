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
  type Attachment,
  type Chat,
  type ChatSummary,
  type Dict,
  type Message,
} from './types';
import { disposePython, executePython } from './python';

interface ChatContext {
  chat: Chat | null;
  loading: boolean;
  busy: boolean;
  error: string;
  connected: boolean;
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
  const isChat = route.url.pathname === '/' || route.url.pathname === '/home' || !!routeId;
  const [chat, setChat] = useState<Chat | null>(null);
  const current = useRef(chat);
  current.current = chat;
  const [list, setList] = useState<ChatSummary[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const [connected, setConnected] = useState(false);
  const [model, setModelValue] = useState('');
  const [features, setFeatures] = useState<Record<string, boolean>>({});
  const socket = useRef<Socket | null>(null);
  const selectedRoute = useRef(routeId);
  selectedRoute.current = routeId;
  const update = useHomeframeUpdate();
  useEffect(() => update.registerGuard(() => !busy), [busy, update.registerGuard]);

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
    const saved = await api<Chat>(`/api/v1/chats/${segment(id)}`);
    if (current.current?.id !== id) return;
    saved.chat.history = normalizeHistory(saved.chat);
    setChat(saved);
    setBusy(saved.active === true);
  }, []);
  const latestRefresh = useRef(refreshChat);
  latestRefresh.current = refreshChat;
  const setModel = (id: string) => {
    setModelValue(id);
    const selected = models.find((item) => item.id === id);
    const defaults = selected?.info?.meta?.defaultFeatureIds ?? [];
    setFeatures({
      web_search: defaults.includes('web_search') || object(settings.ui).webSearch === 'always',
      code_interpreter: defaults.includes('code_interpreter'),
      image_generation: defaults.includes('image_generation'),
      memory: object(settings.ui).memory === true,
    });
  };
  useEffect(() => {
    if (!models.length || model) return;
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
      void latestRefresh.current().catch((reason) => setError(errorMessage(reason)));
    });
    client.on('disconnect', () => setConnected(false));
    client.on('connect_error', () => setConnected(false));
    client.on('events', (event: Dict, acknowledge?: (answer: unknown) => void) => {
      const envelope = object(event.data);
      const type = text(envelope.type);
      const data = object(envelope.data);
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
      // Browser-executed tools cannot silently hang. Acknowledge unsupported requests
      // explicitly; server-side tools continue through the standard task protocol.
      if (acknowledge && ['execute', 'input', 'confirmation'].includes(type)) {
        acknowledge({ error: 'This browser action requires an explicit interactive handler.' });
        setError('A tool requested an interactive browser action. Its request was not executed.');
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
      client.disconnect();
      socket.current = null;
      setConnected(false);
      disposePython();
    };
  }, [user?.id, refreshList]);

  useEffect(() => {
    if (!user || !isChat) return;
    setError('');
    if (routeId === current.current?.id) return;
    if (!routeId) {
      setChat(blank());
      setBusy(false);
      setLoading(false);
      return;
    }
    const abort = new AbortController();
    setLoading(true);
    setChat(null);
    setBusy(false);
    api<Chat>(`/api/v1/chats/${segment(routeId)}`, undefined, { signal: abort.signal })
      .then((saved) => {
        saved.chat.history = normalizeHistory(saved.chat);
        setChat(saved);
        setBusy(saved.active === true);
        if (saved.chat.models?.[0]) setModelValue(saved.chat.models[0]);
      })
      .catch((reason) => {
        if (!abort.signal.aborted) setError(errorMessage(reason));
      })
      .finally(() => {
        if (!abort.signal.aborted) setLoading(false);
      });
    return () => abort.abort();
  }, [routeId, isChat, user?.id]);

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
  ) => {
    if (!content.trim() || busy) return;
    if (!socket.current?.connected || !socket.current.id)
      throw new Error(
        'The live connection is reconnecting. Your draft is saved; try again shortly.',
      );
    if (!model) throw new Error('Choose a model before sending.');
    setError('');
    const previous = current.current ?? blank();
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
        ...(previous.id ? { chat_id: previous.id } : {}),
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
        features,
        params: { ...object(object(settings.ui).params), ...previous.chat.params },
        background_tasks: {
          title_generation: !previous.id,
          tags_generation: !previous.id,
          follow_up_generation: object(settings.ui).autoFollowUps !== false,
        },
      };
      const response = await api<{ chat_id: string; task_ids: string[]; error?: unknown }>(
        '/api/chat/completions',
        payload,
      );
      if (response.error) throw new Error(errorMessage(response.error));
      if (!previous.id && current.current?.chat.history.messages[assistant.id]) {
        setChat((value) => (value ? { ...value, id: response.chat_id } : value));
        current.current = { ...current.current, id: response.chat_id };
        await navigate(`/c/${segment(response.chat_id)}`, {
          replace: true,
          preventScrollReset: true,
        });
      }
      void refreshList();
    } catch (reason) {
      setBusy(false);
      setError(errorMessage(reason));
      setChat((value) =>
        value
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
    if (!chat?.id) return;
    const saved = await api<Chat>(`/api/v1/chats/${segment(chat.id)}`, { chat: data });
    saved.chat.history = normalizeHistory(saved.chat);
    setChat(saved);
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
