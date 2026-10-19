import { useEffect, useState } from 'react';
import {
  HomeframeInput,
  HomeframeSelect,
  HomeframeTextarea,
  Link,
  useRouterSnapshot,
} from '@builtbyted/homeframe';
import { api, remove, segment } from '../lib/api';
import { useResource } from '../lib/useResource';
import { useSession } from '../lib/session';
import { items, object, text, type Dict, type User } from '../lib/types';
import { Action, Busy, Empty, ErrorNotice, Field, JSONField, Page, Toggle } from '../components/ui';
import { AdminNav } from '../components/AdminNav';

export function PeoplePage() {
  const { user } = useSession();
  const route = useRouterSnapshot();
  const groups = route.url.pathname.endsWith('/groups');
  const [page, setPage] = useState(1),
    [query, setQuery] = useState('');
  const [draft, setDraft] = useState<Dict | null>(null);
  useEffect(() => {
    setDraft(null);
    setPage(1);
    setQuery('');
  }, [groups]);
  const resource = useResource<unknown>(
    user?.role === 'admin'
      ? groups
        ? '/api/v1/groups/'
        : `/api/v1/users/?page=${page}&query=${segment(query)}`
      : null,
  );
  const records = items<Dict>(groups ? resource.data : object(resource.data).users);
  if (user?.role !== 'admin') return <Empty title="Administrator access required" />;
  return (
    <Page
      title={groups ? 'Groups' : 'People'}
      description="Manage access to your workspace."
      actions={
        <>
          <Link className="button" to="/admin/settings">
            Server settings
          </Link>
          <button
            onClick={() =>
              setDraft(
                groups
                  ? { name: '', description: '', permissions: null, data: {} }
                  : { name: '', email: '', role: 'user', password: '' },
              )
            }
          >
            {groups ? 'Create group' : 'Create account'}
          </button>
        </>
      }
    >
      <AdminNav />
      <ErrorNotice error={resource.error} retry={resource.reload} />
      {!groups && (
        <Field label="Find a person">
          <HomeframeInput
            type="search"
            value={query}
            onChange={(event) => {
              setQuery(event.target.value);
              setPage(1);
            }}
          />
        </Field>
      )}
      {draft && (
        <section className="card stack" data-validation-scope>
          <h2>
            {draft.id ? 'Edit' : 'New'} {groups ? 'group' : 'account'}
          </h2>
          <Field label="Name">
            <HomeframeInput
              required
              value={text(draft.name)}
              onChange={(event) => setDraft({ ...draft, name: event.target.value })}
            />
          </Field>
          {groups ? (
            <>
              <Field label="Description">
                <HomeframeTextarea
                  value={text(draft.description)}
                  onChange={(event) => setDraft({ ...draft, description: event.target.value })}
                />
              </Field>
              <Field label="Parent group">
                <HomeframeSelect
                  value={text(draft.parent_group_id)}
                  onChange={(event) =>
                    setDraft({ ...draft, parent_group_id: event.target.value || null })
                  }
                >
                  <option value="">No parent</option>
                  {records
                    .filter((group) => group.id !== draft.id)
                    .map((group) => (
                      <option key={text(group.id)} value={text(group.id)}>
                        {text(group.name)}
                      </option>
                    ))}
                </HomeframeSelect>
              </Field>
              <JSONField
                key={text(draft.id) || 'new'}
                label="Permission overrides"
                value={draft.permissions ?? {}}
                onChange={(value) => setDraft({ ...draft, permissions: value })}
              />
              {draft.id ? <GroupMembers id={text(draft.id)} /> : null}
            </>
          ) : (
            <>
              <Field label="Email">
                <HomeframeInput
                  type="email"
                  required
                  value={text(draft.email)}
                  onChange={(event) => setDraft({ ...draft, email: event.target.value })}
                />
              </Field>
              <Field label="Role">
                <HomeframeSelect
                  value={text(draft.role)}
                  onChange={(event) => setDraft({ ...draft, role: event.target.value })}
                >
                  <option value="pending">Pending</option>
                  <option value="user">User</option>
                  <option value="admin">Administrator</option>
                </HomeframeSelect>
              </Field>
              <Field label={draft.id ? 'New password (leave blank to keep current)' : 'Password'}>
                <HomeframeInput
                  type="password"
                  autoComplete="new-password"
                  required={!draft.id}
                  value={text(draft.password)}
                  onChange={(event) => setDraft({ ...draft, password: event.target.value })}
                />
              </Field>
            </>
          )}
          <div className="actions">
            <button onClick={() => setDraft(null)}>Cancel</button>
            <Action
              className="primary"
              run={async () => {
                const id = text(draft.id);
                const body = groups
                  ? {
                      name: draft.name,
                      description: draft.description,
                      parent_group_id: draft.parent_group_id ?? null,
                      permissions: draft.permissions,
                      data: draft.data,
                    }
                  : {
                      name: draft.name,
                      email: draft.email,
                      role: draft.role,
                      ...(draft.password ? { password: draft.password } : {}),
                    };
                await api(
                  groups
                    ? id
                      ? `/api/v1/groups/id/${segment(id)}/update`
                      : '/api/v1/groups/create'
                    : id
                      ? `/api/v1/users/${segment(id)}/update`
                      : '/api/v1/auths/add',
                  body,
                );
                setDraft(null);
                resource.reload();
              }}
            >
              Save {groups ? 'group' : 'account'}
            </Action>
          </div>
        </section>
      )}
      {resource.loading ? (
        <Busy />
      ) : (
        <div className="list-card">
          {records.map((person) => (
            <div className="list-row" key={text(person.id)}>
              <span className="avatar">{text(person.name).slice(0, 1)}</span>
              <div>
                <strong>{text(person.name)}</strong>
                <small>{groups ? text(person.description) : text(person.email)}</small>
              </div>
              <span className="badge">
                {groups ? `${Number(person.member_count ?? 0)} members` : text(person.role)}
              </span>
              <button onClick={() => setDraft({ ...person, password: '' })}>Edit</button>
              {!groups && person.id !== user.id && (
                <Action
                  run={async () => {
                    if (!window.confirm(`Revoke every session for ${text(person.name)}?`)) return;
                    await api(`/api/v1/users/${segment(text(person.id))}/sessions/revoke`, {});
                  }}
                >
                  Revoke sessions
                </Action>
              )}
              <Action
                disabled={person.id === user.id}
                run={async () => {
                  if (
                    !window.confirm(
                      `Delete ${text(person.name)}? ${groups ? 'Group access grants will be removed.' : 'This permanently removes the account and its data.'}`,
                    )
                  )
                    return;
                  await remove(
                    groups
                      ? `/api/v1/groups/id/${segment(text(person.id))}/delete`
                      : `/api/v1/users/${segment(text(person.id))}`,
                  );
                  resource.reload();
                }}
              >
                Delete
              </Action>
            </div>
          ))}
        </div>
      )}
      {!groups && (
        <div className="pagination">
          <button disabled={page === 1} onClick={() => setPage(page - 1)}>
            Previous
          </button>
          <span>Page {page}</span>
          <button
            disabled={page * 30 >= Number(object(resource.data).total ?? 0)}
            onClick={() => setPage(page + 1)}
          >
            Next
          </button>
        </div>
      )}
    </Page>
  );
}
function GroupMembers({ id }: { id: string }) {
  const [page, setPage] = useState(1),
    [query, setQuery] = useState('');
  const members = useResource<Dict>(
    `/api/v1/groups/id/${segment(id)}/members?page=${page}&query=${segment(query)}`,
  );
  const users = useResource<Dict>('/api/v1/users/all');
  const [selected, setSelected] = useState('');
  return (
    <details>
      <summary>Group members</summary>
      <Field label="Find a group member">
        <HomeframeInput
          type="search"
          value={query}
          onChange={(e) => {
            setQuery(e.target.value);
            setPage(1);
          }}
        />
      </Field>
      <ErrorNotice error={members.error || users.error} retry={members.reload} />
      <Field label="Add member">
        <HomeframeSelect value={selected} onChange={(event) => setSelected(event.target.value)}>
          <option value="">Choose a person</option>
          {items<User>(users.data?.users ?? users.data).map((person) => (
            <option key={person.id} value={person.id}>
              {person.name} · {person.email}
            </option>
          ))}
        </HomeframeSelect>
      </Field>
      <Action
        disabled={!selected}
        run={async () => {
          await api(`/api/v1/groups/id/${segment(id)}/users/add`, { user_ids: [selected] });
          setSelected('');
          members.reload();
        }}
      >
        Add member
      </Action>
      {items<Dict>(members.data?.members ?? members.data?.users ?? members.data).map((person) => (
        <div className="list-row" key={text(person.id)}>
          <span>
            {text(person.name) || text(person.email)}
            {person.membership_type === 'inherited' && <small>Inherited from a child group</small>}
          </span>
          <Action
            disabled={person.membership_type === 'inherited'}
            run={async () => {
              await api(`/api/v1/groups/id/${segment(id)}/users/remove`, { user_ids: [person.id] });
              members.reload();
            }}
          >
            Remove from group
          </Action>
        </div>
      ))}
      <div className="pagination">
        <button disabled={page === 1} onClick={() => setPage(page - 1)}>
          Previous members
        </button>
        <span>Page {page}</span>
        <button
          disabled={page * 30 >= Number(members.data?.total ?? 0)}
          onClick={() => setPage(page + 1)}
        >
          Next members
        </button>
      </div>
    </details>
  );
}
