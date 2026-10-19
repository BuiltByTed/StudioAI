import { AccessEditor } from '../components/AccessEditor';
import { useEffect, useState } from 'react';
import {
  HomeframeInput,
  HomeframeSelect,
  HomeframeTextarea,
  Link,
  NavLink,
  useHomeframeUpdate,
  useNavigate,
  useRouterSnapshot,
} from '@builtbyted/homeframe';
import { Blocks, BookOpen, Box, Braces, FileText, Plus, Save, WandSparkles } from 'lucide-react';
import { api, errorMessage, segment, upload, remove, download } from '../lib/api';
import { useResource } from '../lib/useResource';
import { useSession } from '../lib/session';
import { items, object, text, type Dict, type Resource } from '../lib/types';
import {
  Action,
  Busy,
  Empty,
  ErrorNotice,
  Field,
  JSONField,
  Page,
  Toggle,
  validateFields,
} from '../components/ui';
import { ConfigFields } from './Admin';

const sections = {
  models: {
    title: 'Models',
    singular: 'model',
    description: 'Give your models a purpose, a voice, and the right tools.',
    icon: Box,
    list: '/api/v1/models/list',
  },
  knowledge: {
    title: 'Knowledge',
    singular: 'knowledge base',
    description: 'Your documents, ready to be part of the conversation.',
    icon: BookOpen,
    list: '/api/v1/knowledge/',
  },
  prompts: {
    title: 'Prompts',
    singular: 'prompt',
    description: 'Save the instructions you reach for again and again.',
    icon: FileText,
    list: '/api/v1/prompts/list',
  },
  skills: {
    title: 'Skills',
    singular: 'skill',
    description: 'Reusable expertise for your assistants.',
    icon: WandSparkles,
    list: '/api/v1/skills/list',
  },
  tools: {
    title: 'Tools',
    singular: 'tool',
    description: 'Connect your assistants to useful actions.',
    icon: Braces,
    list: '/api/v1/tools/list',
  },
  functions: {
    title: 'Functions',
    singular: 'function',
    description: 'Workspace filters, actions and model pipes.',
    icon: Braces,
    list: '/api/v1/functions/list',
  },
} as const;
type Section = keyof typeof sections;
function resourcePath(kind: Section, id: string) {
  return kind === 'models'
    ? `/api/v1/models/model?id=${segment(id)}`
    : `/api/v1/${kind}/${kind === 'knowledge' ? '' : 'id/'}${segment(id)}`;
}

export function WorkspacePage() {
  const route = useRouterSnapshot();
  const navigate = useNavigate();
  const { models, user, refresh } = useSession();
  const parts = route.url.pathname.split('/');
  const kind: Section = parts[2] && parts[2] in sections ? (parts[2] as Section) : 'models';
  const meta = sections[kind];
  const id = parts[3] === 'edit' ? (route.url.searchParams.get('id') ?? '') : (parts[3] ?? '');
  const creating = id === 'create';
  const [page, setPage] = useState(1);
  const [query, setQuery] = useState('');
  const list = useResource<unknown>(
    !id
      ? `${meta.list}${meta.list.includes('?') ? '&' : '?'}page=${page}&query=${encodeURIComponent(query)}`
      : null,
  );
  const records = items<Resource>(list.data);
  const matches = Array.isArray(list.data)
    ? records.filter((item) =>
        `${item.name ?? ''} ${item.title ?? ''} ${item.id}`
          .toLocaleLowerCase()
          .includes(query.toLocaleLowerCase()),
      )
    : records;
  const visible = Array.isArray(list.data) ? matches.slice((page - 1) * 30, page * 30) : matches;
  const hasNext = Array.isArray(list.data) ? matches.length > page * 30 : records.length >= 30;
  const detail = useResource<Resource>(id && !creating ? resourcePath(kind, id) : null);
  const [draft, setDraft] = useState<Dict>({});
  const [dirty, setDirty] = useState(false);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const update = useHomeframeUpdate();
  useEffect(() => {
    setPage(1);
    setQuery('');
  }, [kind]);
  useEffect(() => {
    setDraft(
      detail.data
        ? { ...detail.data }
        : {
            id: '',
            name: '',
            title: '',
            description: '',
            content: '',
            command: '',
            meta: {},
            params: {},
            is_active: true,
          },
    );
    setDirty(false);
    setError('');
  }, [kind, id, detail.data]);
  useEffect(() => update.registerGuard(() => !dirty && !busy), [dirty, busy, update.registerGuard]);
  const edit = (key: string, value: unknown) => {
    setDraft((previous) => ({ ...previous, [key]: value }));
    setDirty(true);
  };
  const save = async () => {
    setBusy(true);
    setError('');
    try {
      const body = { ...draft };
      if (creating && !body.id && kind !== 'knowledge')
        body.id = text(body.name || body.title)
          .toLowerCase()
          .replace(/[^a-z0-9]+/g, '-')
          .replace(/^-|-$/g, '');
      let path = `/api/v1/${kind}/create`;
      if (!creating)
        path =
          kind === 'models'
            ? `/api/v1/models/model/update?id=${segment(id)}`
            : `${resourcePath(kind, id)}/update`;
      if (kind === 'skills') body.expected_version_id = detail.data?.version_id ?? null;
      const saved = await api<Resource>(path, body);
      setDirty(false);
      if (kind === 'models' || kind === 'functions') await refresh();
      if (creating) await navigate(`/workspace/${kind}/${segment(saved.id)}`, { replace: true });
      else detail.reload();
    } catch (reason) {
      setError(errorMessage(reason));
    } finally {
      setBusy(false);
    }
  };
  return (
    <Page
      eyebrow="WORKSPACE"
      title={id ? `${creating ? 'New' : 'Edit'} ${meta.singular}` : meta.title}
      description={id ? undefined : meta.description}
      actions={
        id ? (
          <>
            <button
              className="primary"
              disabled={busy || (!dirty && !creating)}
              onClick={(event) => {
                if (validateFields(event.currentTarget)) void save();
              }}
            >
              <Save size={16} />
              {busy ? 'Saving…' : 'Save'}
            </button>
            {!creating && (
              <>
                <Action run={async () => download(`${kind}-${id}.json`, draft)}>Export</Action>
                <Action
                  disabled={busy}
                  run={async () => {
                    if (!window.confirm(`Delete this ${meta.singular}?`)) return;
                    if (kind === 'models') await api('/api/v1/models/model/delete', { id });
                    else await remove(`${resourcePath(kind, id)}/delete`);
                    if (kind === 'models' || kind === 'functions') await refresh();
                    await navigate(`/workspace/${kind}`);
                  }}
                >
                  Delete
                </Action>
              </>
            )}
          </>
        ) : (
          <Link className="button primary" to={`/workspace/${kind}/create`}>
            <Plus size={17} />
            New {meta.singular}
          </Link>
        )
      }
    >
      <nav className="tabs" aria-label="Workspace sections">
        {Object.entries(sections)
          .filter(([key]) => key !== 'functions' || user?.role === 'admin')
          .map(([key, section]) => (
            <NavLink key={key} to={`/workspace/${key}`} className={key === kind ? 'active' : ''}>
              <section.icon size={17} />
              {section.title}
            </NavLink>
          ))}
      </nav>
      <ErrorNotice
        error={error || detail.error || list.error}
        retry={id ? detail.reload : list.reload}
      />
      {list.loading || detail.loading ? (
        <Busy />
      ) : !id ? (
        <>
          <div className="search-box">
            <HomeframeInput
              aria-label={`Search ${meta.title}`}
              placeholder={`Search ${meta.title.toLowerCase()}…`}
              value={query}
              onChange={(event) => {
                setQuery(event.target.value);
                setPage(1);
              }}
            />
          </div>
          {visible.length ? (
            <div className="card-grid">
              {visible.map((item) => (
                <Link
                  key={item.id}
                  className="resource-card"
                  to={`/workspace/${kind}/${segment(item.id)}`}
                >
                  <meta.icon size={22} />
                  <h2>{item.name || item.title || item.id}</h2>
                  <p>
                    {item.description ||
                      text(object(item.meta).description) ||
                      (item.is_active === false ? 'Disabled' : 'Open to configure')}
                  </p>
                </Link>
              ))}
            </div>
          ) : (
            <Empty
              title={`Make your first ${meta.singular}`}
              to={`/workspace/${kind}/create`}
              action={`Create ${meta.singular}`}
            >
              {meta.description}
            </Empty>
          )}
          <div className="pagination">
            <button disabled={page === 1} onClick={() => setPage(page - 1)}>
              Previous
            </button>
            <span>Page {page}</span>
            <button disabled={!hasNext} onClick={() => setPage(page + 1)}>
              Next
            </button>
          </div>
        </>
      ) : (
        <div className="card stack">
          <Field label={kind === 'prompts' ? 'Title' : 'Name'}>
            <HomeframeInput
              value={text(draft.name)}
              onChange={(event) => edit('name', event.target.value)}
            />
          </Field>
          {creating && ['models', 'tools', 'skills', 'functions'].includes(kind) && (
            <Field label="Identifier" hint="A stable, unique name used to reference this item.">
              <HomeframeInput
                value={text(draft.id)}
                onChange={(event) => edit('id', event.target.value)}
              />
            </Field>
          )}
          {kind === 'models' && (
            <>
              <Field label="Base model">
                <HomeframeSelect
                  value={text(draft.base_model_id)}
                  onChange={(event) => edit('base_model_id', event.target.value || null)}
                >
                  <option value="">Use this model's identifier</option>
                  {models.map((model) => (
                    <option value={model.id} key={model.id}>
                      {model.name || model.id}
                    </option>
                  ))}
                </HomeframeSelect>
              </Field>
              <Field label="Description">
                <HomeframeTextarea
                  rows={2}
                  value={text(object(draft.meta).description)}
                  onChange={(event) =>
                    edit('meta', { ...object(draft.meta), description: event.target.value })
                  }
                />
              </Field>
              <Field label="System instructions">
                <HomeframeTextarea
                  rows={8}
                  value={text(object(draft.params).system)}
                  onChange={(event) =>
                    edit('params', { ...object(draft.params), system: event.target.value })
                  }
                />
              </Field>
              <fieldset>
                <legend>Capabilities</legend>
                {[
                  'vision',
                  'web_search',
                  'image_generation',
                  'code_interpreter',
                  'file_context',
                  'citations',
                ].map((capability) => (
                  <Toggle
                    key={capability}
                    label={capability.replaceAll('_', ' ')}
                    checked={object(object(draft.meta).capabilities)[capability] !== false}
                    onChange={(value) =>
                      edit('meta', {
                        ...object(draft.meta),
                        capabilities: {
                          ...object(object(draft.meta).capabilities),
                          [capability]: value,
                        },
                      })
                    }
                  />
                ))}
              </fieldset>
              <details>
                <summary>Generation parameters</summary>
                <JSONField
                  label="Parameters"
                  value={draft.params}
                  onChange={(value) => edit('params', value)}
                />
              </details>
            </>
          )}
          {kind === 'prompts' && (
            <Field label="Slash command" hint="Choose this prompt from Tools in a conversation.">
              <HomeframeInput
                value={text(draft.command)}
                placeholder="/summarize"
                onChange={(event) => edit('command', event.target.value)}
              />
            </Field>
          )}
          {['knowledge', 'skills', 'tools', 'functions'].includes(kind) && (
            <Field label="Description">
              <HomeframeTextarea
                rows={3}
                value={
                  ['tools', 'functions'].includes(kind)
                    ? text(object(draft.meta).description)
                    : text(draft.description)
                }
                onChange={(event) =>
                  ['tools', 'functions'].includes(kind)
                    ? edit('meta', { ...object(draft.meta), description: event.target.value })
                    : edit('description', event.target.value)
                }
              />
            </Field>
          )}
          {['tools', 'functions'].includes(kind) && (
            <p className="muted">This Python code runs on your server. Only save code you trust.</p>
          )}
          {['prompts', 'skills', 'tools', 'functions'].includes(kind) && (
            <Field label={['tools', 'functions'].includes(kind) ? 'Python source' : 'Instructions'}>
              <HomeframeTextarea
                className={['tools', 'functions'].includes(kind) ? 'code-input' : ''}
                rows={16}
                value={text(draft.content)}
                onChange={(event) => edit('content', event.target.value)}
              />
            </Field>
          )}
          {kind === 'knowledge' && !creating && <KnowledgeFiles id={id} />}
          {kind === 'models' && (
            <details>
              <summary>Model metadata & default tools</summary>
              <JSONField
                key={id}
                label="Model metadata"
                value={draft.meta}
                onChange={(value) => edit('meta', value)}
              />
            </details>
          )}
          {kind !== 'functions' && (
            <details>
              <summary>Sharing & permissions</summary>
              <AccessEditor
                label="Access grants"
                value={draft.access_grants ?? []}
                onChange={(value) => edit('access_grants', value)}
              />
            </details>
          )}
          {!creating && ['functions', 'skills', 'models'].includes(kind) && (
            <Action
              run={async () => {
                await api(
                  kind === 'models'
                    ? `/api/v1/models/model/toggle?id=${segment(id)}`
                    : `${resourcePath(kind, id)}/toggle`,
                  {},
                );
                if (kind === 'models' || kind === 'functions') await refresh();
                detail.reload();
              }}
            >
              {draft.is_active === false ? 'Enable' : 'Disable'} {meta.singular}
            </Action>
          )}
          {!creating && kind === 'functions' && (
            <Action
              run={async () => {
                await api(`${resourcePath(kind, id)}/toggle/global`, {});
                detail.reload();
              }}
            >
              {draft.is_global ? 'Disable global use' : 'Enable globally'}
            </Action>
          )}
          {!creating && ['tools', 'functions'].includes(kind) && (
            <ResourceValves kind={kind} id={id} />
          )}
          <p role="status" className="muted">
            {dirty ? 'Unsaved changes' : creating ? 'Ready when you are.' : 'Saved'}
          </p>
        </div>
      )}
    </Page>
  );
}
function ResourceValves({ kind, id }: { kind: string; id: string }) {
  const [open, setOpen] = useState(false),
    [draft, setDraft] = useState<unknown>({});
  const resource = useResource<unknown>(open ? `/api/v1/${kind}/id/${segment(id)}/valves` : null);
  useEffect(() => setDraft(resource.data ?? {}), [resource.data]);
  return (
    <details open={open} onToggle={(event) => setOpen(event.currentTarget.open)}>
      <summary>Tool configuration (valves)</summary>
      <ErrorNotice error={resource.error} retry={resource.reload} />
      {resource.loading ? (
        <Busy />
      ) : (
        resource.data !== null && (
          <>
            <ConfigFields value={object(draft)} onChange={setDraft} />
            <Action
              run={async () => {
                await api(`/api/v1/${kind}/id/${segment(id)}/valves/update`, draft);
                resource.reload();
              }}
            >
              Save configuration
            </Action>
          </>
        )
      )}
    </details>
  );
}

function KnowledgeFiles({ id }: { id: string }) {
  const files = useResource<unknown>(`/api/v1/knowledge/${segment(id)}/files`);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  return (
    <section className="stack">
      <h2>Documents</h2>
      <Field label="Add documents">
        <HomeframeInput
          type="file"
          multiple
          disabled={busy}
          onChange={(event) => {
            const selection = Array.from(event.target.files ?? []);
            setBusy(true);
            setError('');
            void (async () => {
              for (const file of selection) {
                const saved = await upload(file);
                await api(`/api/v1/knowledge/${segment(id)}/file/add`, { file_id: saved.id });
              }
              files.reload();
            })()
              .catch((reason) => setError(errorMessage(reason)))
              .finally(() => setBusy(false));
          }}
        />
      </Field>
      <ErrorNotice error={error || files.error} />
      {busy && <Busy label="Processing documents…" />}
      {items<Dict>(files.data).map((file) => (
        <div className="list-row" key={text(file.id)}>
          <FileText size={18} />
          <span>{text(file.filename) || text(object(file.file).filename) || text(file.id)}</span>
        </div>
      ))}
    </section>
  );
}
