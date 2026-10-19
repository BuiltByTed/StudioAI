import { AccessEditor } from '../components/AccessEditor';
import { useEffect, useState } from 'react';
import {
  HomeframeInput,
  HomeframeTextarea,
  useHomeframeUpdate,
  HomeframeSelect,
  Link,
  useNavigate,
  useRouterSnapshot,
} from '@builtbyted/homeframe';
import { FolderOpen, MessageSquare, Plus } from 'lucide-react';
import { api, errorMessage, remove, segment, upload } from '../lib/api';
import { useResource } from '../lib/useResource';
import { useSession } from '../lib/session';
import { object, text, items, type Dict, type ChatSummary, type Folder } from '../lib/types';
import { Action, Busy, Empty, ErrorNotice, Field, JSONField, Page } from '../components/ui';

export function FoldersPage() {
  const route = useRouterSnapshot();
  const navigate = useNavigate();
  const id = route.url.pathname.split('/')[2] ?? '';
  const folders = useResource<Folder[]>('/api/v1/folders/');
  const detail = useResource<Folder>(id ? `/api/v1/folders/${segment(id)}` : null);
  const folder = detail.data ?? folders.data?.find((item) => item.id === id);
  const chats = useResource<ChatSummary[]>(id ? `/api/v1/chats/folder/${segment(id)}/list` : null);
  const allChats = useResource<ChatSummary[]>(
    id ? '/api/v1/chats/?include_folders=true&include_pinned=true' : null,
  );
  const [name, setName] = useState('');
  const [selectedChat, setSelectedChat] = useState('');
  return (
    <Page
      eyebrow="A PLACE FOR EVERY PROJECT"
      title={folder?.name ?? 'Folders'}
      description="Keep related conversations together."
      actions={
        id && (
          <Link className="button primary" to={`/?folder=${segment(id)}`}>
            New conversation in this folder
          </Link>
        )
      }
    >
      <ErrorNotice error={detail.error || folders.error || chats.error} retry={folders.reload} />
      {!id && (
        <form className="card inline-form" onSubmit={(event) => event.preventDefault()}>
          <Field label="New folder">
            <HomeframeInput
              value={name}
              onChange={(event) => setName(event.target.value)}
              placeholder="A project, a topic, a big idea…"
            />
          </Field>
          <Action
            className="primary"
            disabled={!name.trim()}
            run={async () => {
              const created = await api<Folder>('/api/v1/folders/', { name: name.trim() });
              setName('');
              folders.reload();
              await navigate(`/folders/${created.id}`);
            }}
          >
            <Plus size={16} />
            Create folder
          </Action>
        </form>
      )}
      {folders.loading || chats.loading ? (
        <Busy />
      ) : id ? (
        <>
          {detail.data && (
            <FolderSettings
              key={id}
              folder={detail.data}
              reload={() => {
                detail.reload();
                folders.reload();
              }}
            />
          )}
          <div className="card inline-form">
            <Field label="Add a conversation">
              <HomeframeSelect
                value={selectedChat}
                onChange={(event) => setSelectedChat(event.target.value)}
              >
                <option value="">Choose a conversation</option>
                {allChats.data
                  ?.filter((chat) => chat.folder_id !== id)
                  .map((chat) => (
                    <option key={chat.id} value={chat.id}>
                      {chat.title}
                    </option>
                  ))}
              </HomeframeSelect>
            </Field>
            <Action
              disabled={!selectedChat}
              run={async () => {
                await api(`/api/v1/chats/${segment(selectedChat)}/folder`, { folder_id: id });
                setSelectedChat('');
                chats.reload();
                allChats.reload();
              }}
            >
              Move here
            </Action>
          </div>
          {chats.data?.length ? (
            <div className="list-card">
              {chats.data.map((chat) => (
                <div key={chat.id} className="list-row">
                  <MessageSquare size={18} />
                  <Link to={`/c/${segment(chat.id)}`}>{chat.title}</Link>
                  <Action
                    run={async () => {
                      await api(`/api/v1/chats/${segment(chat.id)}/folder`, { folder_id: null });
                      chats.reload();
                    }}
                  >
                    Move out
                  </Action>
                </div>
              ))}
            </div>
          ) : (
            <Empty title="Room for a new idea">Add a conversation to keep it here.</Empty>
          )}
        </>
      ) : (
        <div className="card-grid">
          {folders.data?.map((item) => (
            <Link key={item.id} to={`/folders/${segment(item.id)}`} className="resource-card">
              <FolderOpen size={23} />
              <h2>{item.name}</h2>
            </Link>
          ))}
        </div>
      )}
    </Page>
  );
}

function FolderSettings({ folder, reload }: { folder: Folder; reload: () => void }) {
  const { models, user } = useSession(),
    navigate = useNavigate(),
    update = useHomeframeUpdate();
  const [draft, setDraft] = useState<Folder>(folder),
    [dirty, setDirty] = useState(false),
    [busy, setBusy] = useState(false),
    [error, setError] = useState('');
  useEffect(() => {
    setDraft(folder);
    setDirty(false);
  }, [folder]);
  useEffect(() => update.registerGuard(() => !dirty && !busy), [dirty, busy, update.registerGuard]);
  const data = object(draft.data),
    edit = (patch: Dict) => {
      setDraft({ ...draft, ...patch });
      setDirty(true);
    },
    editData = (patch: Dict) => edit({ data: { ...data, ...patch } });
  const files = items<Dict>(data.files),
    writable = folder.write_access !== false;
  return (
    <details className="card stack">
      <summary>Folder settings</summary>
      <div className="stack" data-validation-scope>
        <ErrorNotice error={error} />
        <Field label="Folder name">
          <HomeframeInput
            required
            value={draft.name}
            disabled={!writable}
            onChange={(e) => edit({ name: e.target.value })}
          />
        </Field>
        <Field
          label="Folder instructions"
          hint="Applied by the server to conversations in this folder."
        >
          <HomeframeTextarea
            rows={5}
            value={text(data.system_prompt)}
            disabled={!writable}
            onChange={(e) => editData({ system_prompt: e.target.value })}
          />
        </Field>
        <Field label="Folder default model">
          <HomeframeSelect
            value={text(items(data.model_ids)[0])}
            disabled={!writable}
            onChange={(e) => editData({ model_ids: e.target.value ? [e.target.value] : [] })}
          >
            <option value="">Use workspace default</option>
            {models.map((model) => (
              <option key={model.id} value={model.id}>
                {model.name || model.id}
              </option>
            ))}
          </HomeframeSelect>
        </Field>
        <Field label="Add folder documents">
          <HomeframeInput
            type="file"
            multiple
            disabled={!writable || busy}
            onChange={(event) => {
              const selected = Array.from(event.target.files ?? []);
              setBusy(true);
              setError('');
              void Promise.all(
                selected.map(async (file) => {
                  const saved = await upload(file);
                  return {
                    type: 'file',
                    id: text(saved.id),
                    name: file.name,
                    file: saved,
                    status: 'uploaded',
                  };
                }),
              )
                .then((added) => editData({ files: [...files, ...added] }))
                .catch((reason) => setError(errorMessage(reason)))
                .finally(() => setBusy(false));
            }}
          />
        </Field>
        {files.map((file, index) => (
          <div className="list-row" key={text(file.id) || index}>
            <span>{text(file.name) || text(file.id)}</span>
            <button
              disabled={!writable}
              onClick={() => editData({ files: files.filter((_, i) => i !== index) })}
            >
              Remove document
            </button>
          </div>
        ))}
        <Action
          disabled={!dirty || busy || !writable}
          run={async () => {
            await api(`/api/v1/folders/${segment(folder.id)}/update`, {
              name: draft.name,
              data: object(draft.data),
              meta: object(draft.meta),
            });
            if (
              (user?.role === 'admin' || folder.user_id === user?.id) &&
              JSON.stringify(draft.access_grants) !== JSON.stringify(folder.access_grants)
            ) {
              await api(`/api/v1/folders/${segment(folder.id)}/access/update`, {
                access_grants: draft.access_grants ?? [],
                share_mode: data.share_mode === 'continue' ? 'continue' : null,
              });
            }
            setDirty(false);
            reload();
          }}
        >
          Save folder
        </Action>
        {(user?.role === 'admin' || folder.user_id === user?.id) && (
          <>
            <details>
              <summary>Folder sharing</summary>
              <AccessEditor
                label="Folder access grants"
                value={draft.access_grants ?? []}
                onChange={(value) => edit({ access_grants: value })}
              />
            </details>
            <Action
              run={async () => {
                if (
                  !window.confirm(
                    'Remove this folder and its subfolders? Conversations will be kept outside the folders.',
                  )
                )
                  return;
                await remove(`/api/v1/folders/${segment(folder.id)}?delete_contents=false`);
                await navigate('/folders');
              }}
            >
              Remove folder, keep conversations
            </Action>
          </>
        )}
      </div>
    </details>
  );
}
