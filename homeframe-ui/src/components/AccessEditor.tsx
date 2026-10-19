import { useState } from 'react';
import { HomeframeInput, HomeframeSelect } from '@builtbyted/homeframe';
import { useResource } from '../lib/useResource';
import { items, text, type Dict } from '../lib/types';
import { ErrorNotice, Field } from './ui';
export function AccessEditor({
  value,
  onChange,
  label = 'Sharing',
}: {
  value: unknown;
  onChange: (value: Dict[]) => void;
  label?: string;
}) {
  const grants = items<Dict>(value);
  const [type, setType] = useState('user'),
    [query, setQuery] = useState(''),
    [principal, setPrincipal] = useState(''),
    [permission, setPermission] = useState('read');
  const users = useResource<{ users: Dict[] }>(
    type === 'user' ? `/api/v1/users/search?query=${encodeURIComponent(query)}` : null,
  );
  const groups = useResource<Dict[]>(type === 'group' ? '/api/v1/groups/?share=true' : null);
  const choices = type === 'user' ? (users.data?.users ?? []) : (groups.data ?? []);
  return (
    <div className="stack">
      <p className="muted">The owner keeps access. Changes take effect when you save.</p>
      <ErrorNotice error={users.error || groups.error} />
      {grants.map((grant, index) => (
        <div className="list-row" key={text(grant.id) || index}>
          <span>
            {grant.principal_type === 'anyone'
              ? 'Anyone with access to this link'
              : grant.principal_id === '*'
                ? 'Everyone in this workspace'
                : text(grant.principal_name) || text(grant.principal_id)}{' '}
            · {grant.permission === 'write' ? 'Can edit' : 'Can view'}
          </span>
          <button type="button" onClick={() => onChange(grants.filter((_, i) => i !== index))}>
            Remove access
          </button>
        </div>
      ))}
      {!grants.length && <p>Only you can access this item.</p>}
      <Field label={`${label} audience`}>
        <HomeframeSelect
          value={type}
          onChange={(e) => {
            setType(e.target.value);
            setPrincipal('');
          }}
        >
          <option value="user">A person</option>
          <option value="group">A group</option>
          <option value="everyone">Everyone in this workspace</option>
        </HomeframeSelect>
      </Field>
      {type === 'user' && (
        <Field label={`${label} search people`}>
          <HomeframeInput
            type="search"
            value={query}
            onChange={(e) => {
              setQuery(e.target.value);
              setPrincipal('');
            }}
          />
        </Field>
      )}
      {type !== 'everyone' && (
        <Field label={`${label} recipient`}>
          <HomeframeSelect value={principal} onChange={(e) => setPrincipal(e.target.value)}>
            <option value="">Choose {type === 'user' ? 'a person' : 'a group'}</option>
            {choices.map((choice) => (
              <option key={text(choice.id)} value={text(choice.id)}>
                {text(choice.name) || text(choice.id)}
              </option>
            ))}
          </HomeframeSelect>
        </Field>
      )}
      <Field label={`${label} permission`}>
        <HomeframeSelect value={permission} onChange={(e) => setPermission(e.target.value)}>
          <option value="read">Can view</option>
          <option value="write">Can edit</option>
        </HomeframeSelect>
      </Field>
      <button
        type="button"
        disabled={type !== 'everyone' && !principal}
        onClick={() => {
          const grant = {
            principal_type: type === 'everyone' ? 'user' : type,
            principal_id: type === 'everyone' ? '*' : principal,
            permission,
          };
          if (
            !grants.some(
              (g) =>
                g.principal_type === grant.principal_type &&
                g.principal_id === grant.principal_id &&
                g.permission === grant.permission,
            )
          )
            onChange([...grants, grant]);
          setPrincipal('');
        }}
      >
        Add access
      </button>
    </div>
  );
}
