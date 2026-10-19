import { useEffect, useRef, useState } from 'react';
import { HomeframeTextarea } from '@builtbyted/homeframe';
import {
  ArrowDown,
  ArrowUpRight,
  Code2,
  Copy,
  Feather,
  RefreshCw,
  Sparkles,
  Check,
  ChevronLeft,
  ChevronRight,
} from 'lucide-react';
import { useChat } from '../lib/chat';
import { useSession } from '../lib/session';
import { branch, outputText } from '../lib/history';
import { errorMessage } from '../lib/api';
import { object, text, type Message } from '../lib/types';
import { Markdown } from '../components/Markdown';
import { Busy, ErrorNotice } from '../components/ui';

export function ChatPage() {
  const state = useChat();
  const { user, models } = useSession();
  const end = useRef<HTMLDivElement>(null);
  const [atBottom, setAtBottom] = useState(true);
  const messages = state.chat ? branch(state.chat.chat.history) : [];
  const lastText = messages.at(-1) ? outputText(messages.at(-1)!) : '';
  useEffect(() => {
    const scroller = end.current?.closest<HTMLElement>('[data-hf-scroll-view]');
    if (!scroller) return;
    const scroll = () =>
      setAtBottom(scroller.scrollHeight - scroller.scrollTop - scroller.clientHeight < 160);
    scroller.addEventListener('scroll', scroll, { passive: true });
    return () => scroller.removeEventListener('scroll', scroll);
  }, [state.loading]);
  useEffect(() => {
    if (!atBottom || !state.busy) return;
    const scroller = end.current?.closest<HTMLElement>('[data-hf-scroll-view]');
    scroller?.scrollTo({ top: scroller.scrollHeight });
  }, [lastText, messages.length, state.busy, atBottom]);
  if (state.loading) return <Busy label="Opening conversation…" />;
  if (!messages.length)
    return (
      <section className="welcome">
        <div className="welcome-mark">
          <Sparkles size={30} strokeWidth={1.5} />
        </div>
        <p className="eyebrow">A LITTLE SPACE FOR BIG IDEAS</p>
        <h1>What are we making{user?.name ? `, ${user.name.split(' ')[0]}` : ''}?</h1>
        <p className="welcome-subtitle">Think it through. Write it down. Build something good.</p>
        <div className="starter-grid">
          {[
            {
              icon: Feather,
              title: 'Find the right words',
              prompt: 'Help me turn a rough idea into a clear, thoughtful piece of writing.',
            },
            {
              icon: Code2,
              title: 'Build something useful',
              prompt: 'Help me plan and build an application. Ask me what I want it to do.',
            },
            {
              icon: Sparkles,
              title: 'Explore an idea',
              prompt: 'I have an idea I want to explore. Help me think it through.',
            },
          ].map((card) => (
            <button
              key={card.title}
              onClick={() =>
                window.dispatchEvent(new CustomEvent('studio:compose', { detail: card.prompt }))
              }
            >
              <card.icon size={21} />
              <strong>{card.title}</strong>
              <ArrowUpRight size={17} />
            </button>
          ))}
        </div>
        <ErrorNotice error={state.error} />
      </section>
    );
  return (
    <div className="conversation">
      <ErrorNotice error={state.error} retry={() => void state.refreshChat()} />
      {messages.map((message) => (
        <MessageView
          key={message.id}
          message={message}
          modelName={
            models.find((model) => model.id === message.model)?.name ?? message.model ?? 'Assistant'
          }
        />
      ))}
      {state.busy && messages.at(-1)?.content === '' && <Busy label="Working on it…" />}
      {!atBottom && state.busy && (
        <button
          className="scroll-latest"
          onClick={() => {
            setAtBottom(true);
            const scroller = end.current?.closest<HTMLElement>('[data-hf-scroll-view]');
            scroller?.scrollTo({ top: scroller.scrollHeight, behavior: 'smooth' });
          }}
        >
          <ArrowDown size={16} />
          Latest response
        </button>
      )}
      <div ref={end} className="thread-end" />
    </div>
  );
}

function MessageView({ message, modelName }: { message: Message; modelName: string }) {
  const state = useChat();
  const [copied, setCopied] = useState(false);
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(message.content);
  const [error, setError] = useState('');
  const isUser = message.role === 'user';
  const content = outputText(message);
  const siblings = message.parentId
    ? (state.chat?.chat.history.messages[message.parentId]?.childrenIds ?? [])
    : Object.values(state.chat?.chat.history.messages ?? {})
        .filter((item) => !item.parentId)
        .map((item) => item.id);
  const siblingIndex = siblings.indexOf(message.id);
  const lastStatus = message.statusHistory?.at(-1);
  return (
    <article
      className={`message ${isUser ? 'user-message' : 'assistant-message'}`}
      aria-label={isUser ? 'Your message' : `${modelName} response`}
    >
      {!isUser && (
        <div className="message-heading">
          <span className="assistant-mark">
            <Sparkles size={14} />
          </span>
          <strong>{modelName}</strong>
        </div>
      )}
      {editing ? (
        <div className="stack">
          <HomeframeTextarea
            aria-label="Edit message"
            rows={5}
            value={draft}
            onChange={(event) => setDraft(event.target.value)}
          />
          <div className="actions">
            <button onClick={() => setEditing(false)}>Cancel</button>
            <button
              className="primary"
              disabled={state.busy}
              onClick={() =>
                void state
                  .send(draft, message.files, message.parentId)
                  .then(() => setEditing(false))
                  .catch((reason) => setError(errorMessage(reason)))
              }
            >
              Send as new branch
            </button>
          </div>
        </div>
      ) : (
        <Markdown>{content}</Markdown>
      )}
      {message.files?.length ? (
        <div className="message-files">
          {message.files.map((file, index) =>
            file.type === 'image' ? (
              <a key={file.id ?? index} href={file.url} target="_blank" rel="noreferrer">
                <img src={file.url} alt={file.name ?? 'Generated image'} />
              </a>
            ) : (
              <a
                key={file.id ?? index}
                href={file.url ?? `/api/v1/files/${file.id}/content`}
                target="_blank"
                rel="noreferrer"
              >
                {file.name ?? 'Download file'}
              </a>
            ),
          )}
        </div>
      ) : null}
      {lastStatus && !message.done && (
        <p className="tool-status" role="status">
          {text(lastStatus.description) || text(lastStatus.action)}
        </p>
      )}
      {message.sources?.length ? (
        <details className="sources">
          <summary>
            {message.sources.length} source{message.sources.length === 1 ? '' : 's'}
          </summary>
          {message.sources.map((source, index) => (
            <p key={index}>
              {text(object(source.source).name) || text(source.name)}
              {Array.isArray(source.document) &&
                source.document.map((part, i) => <span key={i}>{text(part)}</span>)}
            </p>
          ))}
        </details>
      ) : null}
      <ErrorNotice error={message.error ? errorMessage(message.error) : error} />
      <div className="message-actions">
        <button
          aria-label="Copy message"
          onClick={() =>
            void navigator.clipboard
              .writeText(content)
              .then(() => {
                setCopied(true);
                setTimeout(() => setCopied(false), 1600);
              })
              .catch((reason) => setError(errorMessage(reason)))
          }
        >
          {copied ? <Check size={15} /> : <Copy size={15} />}
        </button>
        {isUser ? (
          <button onClick={() => setEditing(!editing)} disabled={state.busy}>
            Edit
          </button>
        ) : (
          <button
            aria-label="Regenerate response"
            disabled={state.busy}
            onClick={() => {
              const parent = state.chat?.chat.history.messages[message.parentId ?? ''];
              if (parent)
                void state
                  .send(parent.content, parent.files, parent.parentId, parent)
                  .catch((reason) => setError(errorMessage(reason)));
            }}
          >
            <RefreshCw size={15} />
          </button>
        )}
        {siblings.length > 1 && (
          <>
            <button
              aria-label="Previous branch"
              disabled={siblingIndex === 0 || state.busy}
              onClick={() => {
                const id = siblings[siblingIndex - 1];
                if (id) void state.selectBranch(id);
              }}
            >
              <ChevronLeft size={16} />
            </button>
            <small>
              {siblingIndex + 1}/{siblings.length}
            </small>
            <button
              aria-label="Next branch"
              disabled={siblingIndex >= siblings.length - 1 || state.busy}
              onClick={() => {
                const id = siblings[siblingIndex + 1];
                if (id) void state.selectBranch(id);
              }}
            >
              <ChevronRight size={16} />
            </button>
          </>
        )}
      </div>
      {message.followUps?.length && message.id === state.chat?.chat.history.currentId ? (
        <div className="followups">
          {message.followUps.map((prompt) => (
            <button
              key={prompt}
              onClick={() =>
                window.dispatchEvent(new CustomEvent('studio:compose', { detail: prompt }))
              }
            >
              {prompt}
              <ArrowUpRight size={14} />
            </button>
          ))}
        </div>
      ) : null}
    </article>
  );
}
