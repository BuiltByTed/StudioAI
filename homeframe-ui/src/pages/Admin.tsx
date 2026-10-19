import { useEffect, useState } from 'react';
import {
  HomeframeInput,
  HomeframeTextarea,
  NavLink,
  useRouterSnapshot,
} from '@builtbyted/homeframe';
import { Save } from 'lucide-react';
import { api } from '../lib/api';
import { useResource } from '../lib/useResource';
import { useSession } from '../lib/session';
import { items, object, text, type Dict, type User } from '../lib/types';
import { Action, Busy, Empty, ErrorNotice, Field, Page, Toggle } from '../components/ui';

const sections: Record<string, { name: string; read: string; write: string }> = {
  general: {
    name: 'General',
    read: '/api/v1/auths/admin/config',
    write: '/api/v1/auths/admin/config',
  },
  connections: { name: 'Connections', read: '/openai/config', write: '/openai/config/update' },
  models: { name: 'Models', read: '/api/v1/configs/models', write: '/api/v1/configs/models' },
  images: { name: 'Images', read: '/api/v1/images/config', write: '/api/v1/images/config/update' },
  search: {
    name: 'Search & retrieval',
    read: '/api/v1/retrieval/config',
    write: '/api/v1/retrieval/config/update',
  },
  code: {
    name: 'Code execution',
    read: '/api/v1/configs/code_execution',
    write: '/api/v1/configs/code_execution',
  },
  audio: { name: 'Audio', read: '/api/v1/audio/config', write: '/api/v1/audio/config/update' },
};
const label = (key: string) =>
  key
    .toLowerCase()
    .replaceAll('_', ' ')
    .replace(/^./, (char) => char.toUpperCase());
export function AdminPage() {
  const { user } = useSession();
  const route = useRouterSnapshot();
  const tab = route.url.pathname.split('/').filter(Boolean).at(-1) ?? 'general';
  const section = sections[tab] ?? sections.general!;
  const isUsers = tab === 'users';
  const resource = useResource<Dict>(
    user?.role === 'admin' ? (isUsers ? '/api/v1/users/' : section.read) : null,
  );
  const [draft, setDraft] = useState<Dict>({});
  const [dirty, setDirty] = useState(false);
  useEffect(() => {
    setDraft(resource.data ?? {});
    setDirty(false);
  }, [resource.data]);
  if (user?.role !== 'admin')
    return (
      <Empty title="Administrator access required">
        Ask your administrator to manage this workspace.
      </Empty>
    );
  return (
    <Page
      eyebrow="ADMINISTRATION"
      title="Workspace settings"
      description="Manage your server, connections, and people."
      actions={
        !isUsers && (
          <Action
            className="primary"
            disabled={!dirty}
            run={async () => {
              await api(section.write, draft);
              resource.reload();
              setDirty(false);
            }}
          >
            <Save size={16} />
            Save changes
          </Action>
        )
      }
    >
      <nav className="tabs">
        <NavLink to="/admin/users" className={isUsers ? 'active' : ''}>
          People
        </NavLink>
        {Object.entries(sections).map(([key, value]) => (
          <NavLink
            key={key}
            to={`/admin/settings/${key}`}
            className={!isUsers && value === section ? 'active' : ''}
          >
            {value.name}
          </NavLink>
        ))}
      </nav>
      <ErrorNotice error={resource.error} retry={resource.reload} />
      {resource.loading ? (
        <Busy />
      ) : isUsers ? (
        <div className="list-card">
          {items<User>(resource.data?.users ?? resource.data).map((person) => (
            <div className="list-row" key={person.id}>
              <span className="avatar">{person.name.slice(0, 1)}</span>
              <div>
                <strong>{person.name}</strong>
                <small>{person.email}</small>
              </div>
              <span className="badge">{person.role}</span>
            </div>
          ))}
        </div>
      ) : (
        <div className="card stack">
          <ConfigFields
            value={draft}
            onChange={(value) => {
              setDraft(value);
              setDirty(true);
            }}
          />
        </div>
      )}
    </Page>
  );
}
function ConfigFields({ value, onChange }: { value: Dict; onChange: (value: Dict) => void }) {
  return (
    <>
      {Object.entries(value).map(([key, entry]) => {
        const update = (next: unknown) => onChange({ ...value, [key]: next });
        if (typeof entry === 'boolean')
          return <Toggle key={key} label={label(key)} checked={entry} onChange={update} />;
        if (typeof entry === 'number')
          return (
            <Field key={key} label={label(key)}>
              <HomeframeInput
                type="number"
                value={entry}
                onChange={(event) => update(Number(event.target.value))}
              />
            </Field>
          );
        if (typeof entry === 'string' || entry == null)
          return (
            <Field key={key} label={label(key)}>
              {key.toLowerCase().includes('prompt') ? (
                <HomeframeTextarea
                  rows={4}
                  value={text(entry)}
                  onChange={(event) => update(event.target.value)}
                />
              ) : (
                <HomeframeInput
                  type={/key|secret|password|token/i.test(key) ? 'password' : 'text'}
                  autoComplete="off"
                  value={text(entry)}
                  onChange={(event) => update(event.target.value)}
                />
              )}
            </Field>
          );
        if (
          Array.isArray(entry) &&
          entry.every((item) => typeof item === 'string') &&
          /key|secret|password|token/i.test(key)
        )
          return (
            <fieldset key={key}>
              <legend>{label(key)}</legend>
              {entry.map((item, index) => (
                <Field key={index} label={`Credential ${index + 1}`}>
                  <HomeframeInput
                    type="password"
                    autoComplete="off"
                    value={item}
                    onChange={(event) =>
                      update(
                        entry.map((previous, i) => (i === index ? event.target.value : previous)),
                      )
                    }
                  />
                </Field>
              ))}
            </fieldset>
          );
        if (Array.isArray(entry) && entry.every((item) => typeof item === 'string'))
          return (
            <Field key={key} label={`${label(key)} (one per line)`}>
              <HomeframeTextarea
                rows={Math.max(2, Math.min(6, entry.length))}
                value={entry.join('\n')}
                onChange={(event) => update(event.target.value.split('\n'))}
              />
            </Field>
          );
        if (entry && !Array.isArray(entry))
          return (
            <details key={key}>
              <summary>{label(key)}</summary>
              <ConfigFields value={object(entry)} onChange={update} />
            </details>
          );
        return (
          <details key={key}>
            <summary>{label(key)}</summary>
            <p className="muted">
              {Array.isArray(entry) ? `${entry.length} entries` : 'No entries'}
            </p>
            {Array.isArray(entry) &&
              entry.map((item, index) => (
                <fieldset key={index}>
                  <legend>
                    {label(key)} {index + 1}
                  </legend>
                  <ConfigFields
                    value={object(item)}
                    onChange={(next) => update(entry.map((old, i) => (i === index ? next : old)))}
                  />
                </fieldset>
              ))}
          </details>
        );
      })}
    </>
  );
}
