import { useEffect, useRef, useState } from 'react';
import {
  HomeframeInput,
  HomeframeSelect,
  HomeframeTextarea,
  Link,
  useHomeframeUpdate,
  useRouterSnapshot,
  useStateCheckpoint,
} from '@builtbyted/homeframe';
import { useSession } from '../lib/session';
import { api, errorMessage, request, segment } from '../lib/api';
import { consumeCompletion } from '../lib/stream';
import { Action, Empty, ErrorNotice, Field, Page, JSONField } from '../components/ui';
import { object, text, type Dict, type Chat } from '../lib/types';
import { useNavigate } from '@builtbyted/homeframe';
interface Entry {
  role: 'system' | 'user' | 'assistant';
  content: string;
}
export function PlaygroundPage() {
  const { user, models } = useSession(),
    route = useRouterSnapshot(),
    navigate = useNavigate();
  const completion = route.url.pathname.endsWith('/completions');
  const [messages, setMessages] = useStateCheckpoint<Entry[]>({
    key: `playground:messages:${user?.id}`,
    initialValue: [{ role: 'user', content: '' }],
    storage: 'local',
  });
  const [model, setModel] = useStateCheckpoint<string>({
      key: `playground:model:${user?.id}`,
      initialValue: models[0]?.id ?? '',
      storage: 'local',
    }),
    [system, setSystem] = useStateCheckpoint<string>({
      key: `playground:system:${user?.id}`,
      initialValue: '',
      storage: 'local',
    }),
    [params, setParams] = useStateCheckpoint<Dict>({
      key: `playground:params:${user?.id}`,
      initialValue: { temperature: 0.7 },
      storage: 'local',
    });
  const [prompt, setPrompt] = useStateCheckpoint<string>({
      key: `playground:prompt:${user?.id}`,
      initialValue: '',
      storage: 'local',
    }),
    [busy, setBusy] = useState(false),
    [error, setError] = useState('');
  const controller = useRef<AbortController | null>(null),
    update = useHomeframeUpdate();
  useEffect(() => () => controller.current?.abort(), []);
  useEffect(() => update.registerGuard(() => !busy), [busy, update.registerGuard]);
  const run = async () => {
    if (busy) return;
    setError('');
    setBusy(true);
    const abort = new AbortController();
    controller.current = abort;
    const input: Entry[] = completion
      ? [{ role: 'assistant', content: prompt }]
      : [
          ...(system ? [{ role: 'system' as const, content: system }] : []),
          ...messages.filter((m) => m.content.trim()),
        ];
    const index = messages.length;
    if (!completion) setMessages([...messages, { role: 'assistant', content: '' }]);
    try {
      const response = await request('/api/chat/completions', {
        method: 'POST',
        body: JSON.stringify({ ...params, model, stream: true, messages: input }),
        signal: abort.signal,
      });
      await consumeCompletion(response, (delta) => {
        if (completion) setPrompt((value) => value + delta);
        else
          setMessages((value) =>
            value.map((entry, i) =>
              i === index ? { ...entry, content: entry.content + delta } : entry,
            ),
          );
      });
    } catch (reason) {
      if (!abort.signal.aborted) setError(errorMessage(reason));
    } finally {
      setBusy(false);
      controller.current = null;
    }
  };
  if (user?.role !== 'admin') return <Empty title="Administrator access required" />;
  return (
    <Page
      title={completion ? 'Text completion' : 'Playground'}
      description="Try instructions and model parameters before saving a conversation."
    >
      <nav className="tabs">
        <Link to="/playground">Chat</Link>
        <Link to="/playground/completions">Text completion</Link>
        <Link to="/playground/images">Images</Link>
      </nav>
      <ErrorNotice error={error} />
      <section className="card stack" data-validation-scope>
        <Field label="Playground model">
          <HomeframeSelect value={model} disabled={busy} onChange={(e) => setModel(e.target.value)}>
            {models.map((m) => (
              <option key={m.id} value={m.id}>
                {m.name || m.id}
              </option>
            ))}
          </HomeframeSelect>
        </Field>
        {completion ? (
          <Field label="Completion text">
            <HomeframeTextarea
              rows={14}
              value={prompt}
              readOnly={busy}
              onChange={(e) => setPrompt(e.target.value)}
            />
          </Field>
        ) : (
          <>
            <Field label="System instructions">
              <HomeframeTextarea
                rows={3}
                value={system}
                disabled={busy}
                onChange={(e) => setSystem(e.target.value)}
              />
            </Field>
            {messages.map((entry, index) => (
              <div className="stack" key={index}>
                <div className="actions">
                  <HomeframeSelect
                    aria-label={`Role ${index + 1}`}
                    value={entry.role}
                    disabled={busy}
                    onChange={(e) =>
                      setMessages(
                        messages.map((m, i) =>
                          i === index ? { ...m, role: e.target.value as Entry['role'] } : m,
                        ),
                      )
                    }
                  >
                    <option value="user">User</option>
                    <option value="assistant">Assistant</option>
                    <option value="system">System</option>
                  </HomeframeSelect>
                  <button
                    disabled={busy}
                    onClick={() => setMessages(messages.filter((_, i) => i !== index))}
                  >
                    Remove message
                  </button>
                </div>
                <Field label={`Message ${index + 1}`}>
                  <HomeframeTextarea
                    rows={5}
                    value={entry.content}
                    readOnly={busy}
                    onChange={(e) =>
                      setMessages(
                        messages.map((m, i) =>
                          i === index ? { ...m, content: e.target.value } : m,
                        ),
                      )
                    }
                  />
                </Field>
              </div>
            ))}
            <button
              disabled={busy}
              onClick={() => setMessages([...messages, { role: 'user', content: '' }])}
            >
              Add message
            </button>
          </>
        )}
        <details>
          <summary>Model parameters</summary>
          <JSONField
            label="Generation parameters"
            value={params}
            onChange={(value) => setParams(object(value))}
          />
        </details>
        <div className="actions">
          {busy ? (
            <button onClick={() => controller.current?.abort()}>Stop generation</button>
          ) : (
            <Action
              className="primary"
              disabled={
                !model || (completion ? !prompt.trim() : !messages.some((m) => m.content.trim()))
              }
              run={run}
            >
              Generate
            </Action>
          )}
          {!completion && (
            <Action
              disabled={busy || !messages.some((m) => m.content)}
              run={async () => {
                const entries = messages
                  .filter((m) => m.content)
                  .map((entry, index) => ({
                    ...entry,
                    id: crypto.randomUUID(),
                    parentId: null as string | null,
                    childrenIds: [] as string[],
                    timestamp: Math.floor(Date.now() / 1000),
                    ...(entry.role === 'assistant' ? { model, done: true } : { models: [model] }),
                  }));
                entries.forEach((entry, index) => {
                  entry.parentId = entries[index - 1]?.id ?? null;
                  if (entries[index + 1]) entry.childrenIds = [entries[index + 1]!.id];
                });
                const saved = await api<Chat>('/api/v1/chats/new', {
                  chat: {
                    title: 'Playground conversation',
                    models: [model],
                    params: { ...params, system },
                    history: {
                      messages: Object.fromEntries(entries.map((e) => [e.id, e])),
                      currentId: entries.at(-1)?.id ?? null,
                    },
                    messages: entries,
                  },
                });
                await navigate(`/c/${segment(saved.id)}`);
              }}
            >
              Save as conversation
            </Action>
          )}
        </div>
      </section>
    </Page>
  );
}
