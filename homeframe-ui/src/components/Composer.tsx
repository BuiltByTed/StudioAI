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
import { draftKey, readDraft, writeJSON } from '../lib/storage';
import { object, type Attachment } from '../lib/types';
import { ErrorNotice } from './ui';

export function Composer() {
  const chat = useChat();
  const { user, config } = useSession();
  const route = useRouterSnapshot();
  const key = /^\/c\/([^/]+)/.exec(route.url.pathname)?.[1] ?? '';
  const [draft, setDraft] = useState('');
  const [files, setFiles] = useState<Attachment[]>([]);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState('');
  const input = useRef<HTMLInputElement>(null);
  const area = useRef<HTMLTextAreaElement>(null);
  const update = useHomeframeUpdate();
  useEffect(() => {
    if (user) setDraft(readDraft(user.id, key));
    setFiles([]);
    setError('');
  }, [user?.id, key]);
  useEffect(
    () => update.registerGuard(() => !draft && !uploading && !files.length),
    [draft, uploading, files.length, update.registerGuard],
  );
  const edit = (value: string) => {
    setDraft(value);
    if (user && !writeJSON(draftKey(user.id, key), value))
      setError('Browser storage is full. Keep this tab open until your message is sent.');
  };
  useEffect(() => {
    const fill = (event: Event) => {
      edit((event as CustomEvent<string>).detail);
      area.current?.focus();
    };
    window.addEventListener('studio:compose', fill);
    return () => window.removeEventListener('studio:compose', fill);
  }, [key, user?.id]);
  const send = async (event?: FormEvent) => {
    event?.preventDefault();
    if (!draft.trim() || uploading || chat.busy) return;
    const submitted = draft;
    setError('');
    try {
      await chat.send(submitted, files);
      edit('');
      setFiles([]);
    } catch (reason) {
      setError(errorMessage(reason));
    }
  };
  const attach = async (selection: FileList | null) => {
    if (!selection) return;
    setUploading(true);
    setError('');
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
        setFiles((previous) => [...previous, attachment]);
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
                  onClick={() => setFiles((previous) => previous.filter((_, i) => i !== index))}
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
              disabled={uploading}
              onClick={() => input.current?.click()}
            >
              <Paperclip size={19} />
            </button>
            {options
              .filter((option) => option.enabled)
              .map((option) => (
                <button
                  className={`tool-chip ${chat.features[option.id] ? 'selected' : ''}`}
                  key={option.id}
                  type="button"
                  aria-pressed={!!chat.features[option.id]}
                  onClick={() =>
                    chat.setFeatures({ ...chat.features, [option.id]: !chat.features[option.id] })
                  }
                >
                  <option.icon size={15} />
                  <span>{option.label}</span>
                </button>
              ))}
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
              disabled={!draft.trim() || uploading || !chat.model}
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
        <span>Open WebUI</span>
      </div>
    </div>
  );
}
