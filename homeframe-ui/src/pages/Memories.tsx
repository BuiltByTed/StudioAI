import { useState } from 'react';
import { HomeframeInput, HomeframeSelect, HomeframeTextarea, Link } from '@builtbyted/homeframe';
import { api, remove, segment } from '../lib/api';
import { useResource } from '../lib/useResource';
import { items, text, type Dict } from '../lib/types';
import { Action, Busy, Empty, ErrorNotice, Field, Page } from '../components/ui';

export function MemoriesPage() {
  const resource = useResource<Dict[]>('/api/v1/memories/');
  const [draft, setDraft] = useState<Dict | null>(null);
  const [query, setQuery] = useState('');
  const records = items<Dict>(resource.data).filter((memory) =>
    (text(memory.content) + ' ' + text(memory.path)).toLowerCase().includes(query.toLowerCase()),
  );
  return (
    <Page
      title="Memories"
      description="Review the personal context available to your assistants."
      actions={
        <>
          <Link className="button" to="/settings">
            Settings
          </Link>
          <button onClick={() => setDraft({ content: '', type: 'context', path: '' })}>
            Add memory
          </button>
        </>
      }
    >
      <ErrorNotice error={resource.error} retry={resource.reload} />
      <Field label="Find a memory">
        <HomeframeInput
          type="search"
          value={query}
          onChange={(event) => setQuery(event.target.value)}
        />
      </Field>
      {draft && (
        <section className="card stack" data-validation-scope>
          <Field label="Memory">
            <HomeframeTextarea
              rows={5}
              value={text(draft.content)}
              onChange={(event) => setDraft({ ...draft, content: event.target.value })}
              required
            />
          </Field>
          <Field label="Type">
            <HomeframeSelect
              value={text(draft.type)}
              onChange={(event) => setDraft({ ...draft, type: event.target.value })}
            >
              <option value="context">Context</option>
              <option value="user">About you</option>
            </HomeframeSelect>
          </Field>
          <Field label="Path">
            <HomeframeInput
              value={text(draft.path)}
              onChange={(event) => setDraft({ ...draft, path: event.target.value })}
            />
          </Field>
          <div className="actions">
            <button onClick={() => setDraft(null)}>Cancel</button>
            <Action
              className="primary"
              disabled={!text(draft.content).trim()}
              run={async () => {
                await api(
                  `/api/v1/memories/${draft.id ? `${segment(text(draft.id))}/update` : 'add'}`,
                  { content: draft.content, type: draft.type, path: draft.path || null },
                );
                setDraft(null);
                resource.reload();
              }}
            >
              Save memory
            </Action>
          </div>
        </section>
      )}
      {resource.loading ? (
        <Busy />
      ) : records.length ? (
        <div className="list-card">
          {records.map((memory) => (
            <div className="list-row" key={text(memory.id)}>
              <div>
                <p className="selectable">{text(memory.content)}</p>
                <small>
                  {text(memory.type)} {text(memory.path)}
                </small>
              </div>
              <button onClick={() => setDraft({ ...memory })}>Edit</button>
              <Action
                run={async () => {
                  if (!window.confirm('Delete this memory?')) return;
                  await remove(`/api/v1/memories/${segment(text(memory.id))}`);
                  resource.reload();
                }}
              >
                Delete
              </Action>
            </div>
          ))}
        </div>
      ) : (
        !resource.error && (
          <Empty title="No memories">
            Add context here, or let your assistant save it when memory is enabled.
          </Empty>
        )
      )}
    </Page>
  );
}
