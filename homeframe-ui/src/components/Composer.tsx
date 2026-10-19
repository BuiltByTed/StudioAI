import { useEffect, useRef, useState, type FormEvent } from 'react';
import {
  HomeframeInput,
  HomeframeTextarea,
  useHomeframeUpdate,
  useRouterSnapshot,
} from '@builtbyted/homeframe';
import { ArrowUp, Paperclip, Square, X, Globe2, Code2, ImagePlus } from 'lucide-react';
import { useChat } from '../lib/chat';
import { useSession } from '../lib/session';
import { errorMessage, upload } from '../lib/api';
import { emptyDraft, readDraft, saveDraft, type Draft } from '../lib/storage';
import { object, text, items, type Attachment, type Resource } from '../lib/types';
import { useResource } from '../lib/useResource';
import { ChatParameters } from './ChatParameters';
import { VoiceInput } from './VoiceInput';
import { LinkContext } from './LinkContext';
import { PromptPicker } from './PromptPicker';
import { ErrorNotice, Toggle } from './ui';

export function Composer() {
  const chat = useChat();
  const { user, config } = useSession();
  const route = useRouterSnapshot();
  const key = chat.temporary
    ? 'temporary'
    : (/^\/c\/([^/]+)/.exec(route.url.pathname)?.[1] ??
      (route.url.searchParams.get('folder')
        ? `folder:${route.url.searchParams.get('folder')}`
        : ''));
  const [state, setState] = useState<Draft>(emptyDraft);
  const liveState = useRef(state);
  liveState.current = state;
  const { prompt: draft, files } = state;
  const [uploading, setUploading] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');
  const input = useRef<HTMLInputElement>(null);
  const area = useRef<HTMLTextAreaElement>(null);
  const update = useHomeframeUpdate();
  const tools = useResource<unknown>(config.features?.enable_tools ? '/api/v1/tools/' : null);
  const knowledge = useResource<unknown>('/api/v1/knowledge/');
  const skills = useResource<unknown>(config.features?.enable_tools ? '/api/v1/skills/' : null);
  const filters = useResource<unknown>(
    config.features?.enable_functions ? '/api/v1/functions/' : null,
  );
  const identity = `${user?.id}:${key}`;
  const activeIdentity = useRef(identity);
  activeIdentity.current = identity;
  useEffect(() => {
    const restored = user && !chat.temporary ? readDraft(user.id, key) : emptyDraft();
    setState(restored);
    liveState.current = restored;
    const features = { ...chat.features };
    if (restored.webSearchEnabled !== undefined) features.web_search = restored.webSearchEnabled;
    if (restored.imageGenerationEnabled !== undefined)
      features.image_generation = restored.imageGenerationEnabled;
    if (restored.codeInterpreterEnabled !== undefined)
      features.code_interpreter = restored.codeInterpreterEnabled;
    chat.setFeatures(features);
    setError('');
  }, [user?.id, key]);
  useEffect(
    () => update.registerGuard(() => !draft && !uploading && !files.length),
    [draft, uploading, files.length, update.registerGuard],
  );
  const change = (patch: Partial<Draft>) => {
    const next = { ...liveState.current, ...patch };
    liveState.current = next;
    setState(next);
    if (user && !chat.temporary && !saveDraft(user.id, key, next))
      setError('Browser storage is full. Keep this tab open until your message is sent.');
  };
  const edit = (value: string) => change({ prompt: value });
  useEffect(() => {
    const fill = (event: Event) => {
      edit((event as CustomEvent<string>).detail);
      area.current?.focus();
    };
    window.addEventListener('studio:compose', fill);
    return () => window.removeEventListener('studio:compose', fill);
  }, [key, user?.id]);
  useEffect(() => {
    const shared = route.url.searchParams.get('shared') || route.url.searchParams.get('q');
    if (shared && !liveState.current.prompt) edit(shared);
  }, [route.url.searchParams.get('shared'), user?.id, key]);
  const send = async (event?: FormEvent) => {
    event?.preventDefault();
    if (!draft.trim() || uploading || chat.busy || submitting) return;
    const submitted = liveState.current;
    const origin = identity;
    setError('');
    setSubmitting(true);
    change({ prompt: '', files: [] });
    try {
      await chat.send(submitted.prompt, submitted.files, undefined, undefined, submitted);
    } catch (reason) {
      if (activeIdentity.current === origin) {
        change(submitted);
        setError(errorMessage(reason));
      } else if (user && !chat.temporary) saveDraft(user.id, key, submitted);
    } finally {
      setSubmitting(false);
    }
  };
  const attach = async (selection: FileList | null) => {
    if (!selection) return;
    setUploading(true);
    setError('');
    const origin = identity;
    let pending = liveState.current;
    try {
      for (const file of Array.from(selection)) {
        const data = await upload(file, !file.type.startsWith('image/'));
        const attachment: Attachment = {
          type: file.type.startsWith('image/') ? 'image' : 'file',
          id: data.id,
          name: file.name,
          file: data,
          url: `/api/v1/files/${encodeURIComponent(data.id)}/content`,
        };
        if (activeIdentity.current === origin) {
          pending = { ...liveState.current, files: [...liveState.current.files, attachment] };
          change(pending);
        } else if (user && !chat.temporary) {
          pending = { ...pending, files: [...pending.files, attachment] };
          saveDraft(user.id, key, pending);
        }
      }
    } catch (reason) {
      setError(errorMessage(reason));
    } finally {
      setUploading(false);
      if (input.current) input.current.value = '';
    }
  };
  const options = [
    {
      id: 'web_search',
      label: 'Search',
      icon: Globe2,
      enabled: config.features?.enable_web_search,
    },
    {
      id: 'code_interpreter',
      label: 'Code',
      icon: Code2,
      enabled: config.features?.enable_code_interpreter,
    },
    {
      id: 'image_generation',
      label: 'Images',
      icon: ImagePlus,
      enabled: config.features?.enable_image_generation,
    },
  ];
  return (
    <div className="composer-wrap">
      <ErrorNotice error={error} />
      <form className="composer" onSubmit={(event) => void send(event)}>
        {files.length > 0 && (
          <div className="attachments">
            {files.map((file, index) => (
              <div className="attachment" key={file.id}>
                {file.type === 'image' && <img src={file.url} alt="" />}
                <span>{file.name}</span>
                <button
                  type="button"
                  aria-label={`Remove ${file.name}`}
                  disabled={submitting}
                  onClick={() => change({ files: files.filter((_, i) => i !== index) })}
                >
                  <X size={14} />
                </button>
              </div>
            ))}
          </div>
        )}
        <HomeframeTextarea
          ref={area}
          aria-label="Message"
          placeholder={uploading ? 'Uploading your files…' : 'Ask anything, or make something.'}
          rows={2}
          disabled={submitting}
          value={draft}
          onChange={(event) => edit(event.target.value)}
          onKeyDown={(event) => {
            if (
              event.key === 'Enter' &&
              !event.shiftKey &&
              !event.nativeEvent.isComposing &&
              !/Android|iPhone|iPad/i.test(navigator.userAgent)
            ) {
              event.preventDefault();
              void send();
            }
          }}
        />
        <div className="composer-controls">
          <div className="composer-tools">
            <HomeframeInput
              className="sr-only"
              type="file"
              multiple
              ref={input}
              onChange={(event) => void attach(event.target.files)}
              tabIndex={-1}
            />
            <button
              type="button"
              className="icon-button"
              aria-label="Attach files"
              disabled={uploading || submitting}
              onClick={() => input.current?.click()}
            >
              <Paperclip size={19} />
            </button>
            {(user?.role === 'admin' || user?.permissions?.features?.audio_stt !== false) && (
              <VoiceInput
                key={identity}
                append={(value) =>
                  edit([liveState.current.prompt, value].filter(Boolean).join(' '))
                }
                onError={setError}
              />
            )}
            {options
              .filter((option) => option.enabled)
              .map((option) => (
                <button
                  className={`tool-chip ${chat.features[option.id] ? 'selected' : ''}`}
                  key={option.id}
                  type="button"
                  aria-pressed={!!chat.features[option.id]}
                  onClick={() => {
                    const enabled = !chat.features[option.id];
                    chat.setFeatures({ ...chat.features, [option.id]: enabled });
                    const name =
                      option.id === 'web_search'
                        ? 'webSearchEnabled'
                        : option.id === 'image_generation'
                          ? 'imageGenerationEnabled'
                          : 'codeInterpreterEnabled';
                    change({ [name]: enabled });
                  }}
                >
                  <option.icon size={15} />
                  <span>{option.label}</span>
                </button>
              ))}
            <details
              className="tool-selector"
              open={
                route.url.searchParams.has('youtube') || route.url.searchParams.has('load-url')
                  ? true
                  : undefined
              }
            >
              <summary>Tools</summary>
              <div className="stack">
                <PromptPicker draft={draft} apply={edit} />
                <ChatParameters />
                <LinkContext
                  key={identity}
                  attach={(file) => change({ files: [...liveState.current.files, file] })}
                />
                <strong>Knowledge</strong>
                <ErrorNotice error={knowledge.error} />
                {items<Resource>(knowledge.data).map((item) => (
                  <Toggle
                    key={item.id}
                    label={item.name || item.id}
                    checked={files.some(
                      (file) => file.type === 'collection' && file.id === item.id,
                    )}
                    onChange={(enabled) =>
                      change({
                        files: enabled
                          ? [...files, { ...item, type: 'collection', name: item.name || item.id }]
                          : files.filter(
                              (file) => file.type !== 'collection' || file.id !== item.id,
                            ),
                      })
                    }
                  />
                ))}
                {[
                  { label: 'Tools', key: 'selectedToolIds' as const, resource: tools },
                  { label: 'Skills', key: 'selectedSkillIds' as const, resource: skills },
                  { label: 'Filters', key: 'selectedFilterIds' as const, resource: filters },
                ].map((group) => (
                  <div key={group.key}>
                    <strong>{group.label}</strong>
                    <ErrorNotice error={group.resource.error} retry={group.resource.reload} />
                    {items<Resource>(group.resource.data)
                      .filter((item) => group.key !== 'selectedFilterIds' || item.type === 'filter')
                      .map((item) => (
                        <Toggle
                          key={item.id}
                          label={item.name || item.id}
                          checked={state[group.key].includes(item.id)}
                          onChange={(enabled) =>
                            change({
                              [group.key]: enabled
                                ? [...state[group.key], item.id]
                                : state[group.key].filter((id) => id !== item.id),
                            })
                          }
                        />
                      ))}
                    {!group.resource.loading && !items(group.resource.data).length && (
                      <small className="muted">None configured</small>
                    )}
                  </div>
                ))}
              </div>
            </details>
          </div>
          {chat.busy ? (
            <button
              type="button"
              className="send-button"
              aria-label="Stop generating"
              onClick={() => void chat.stop().catch((reason) => setError(errorMessage(reason)))}
            >
              <Square size={16} fill="currentColor" />
            </button>
          ) : (
            <button
              className="send-button"
              aria-label="Send message"
              disabled={!draft.trim() || uploading || submitting || !chat.model}
            >
              <ArrowUp size={20} />
            </button>
          )}
        </div>
      </form>
      <div className="composer-caption">
        {chat.connected ? (
          <>
            <span className="status-dot" />
            Your workspace. Your models.
          </>
        ) : (
          <span role="status">Connecting to your workspace…</span>
        )}
        <span>{chat.temporary ? 'Temporary · not saved in history' : 'Studio AI'}</span>
      </div>
    </div>
  );
}
