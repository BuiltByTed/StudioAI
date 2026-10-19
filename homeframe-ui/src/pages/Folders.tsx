import { useState } from 'react';
import {
  HomeframeInput,
  HomeframeSelect,
  Link,
  useNavigate,
  useRouterSnapshot,
} from '@builtbyted/homeframe';
import { FolderOpen, MessageSquare, Plus } from 'lucide-react';
import { api, segment } from '../lib/api';
import { useResource } from '../lib/useResource';
import type { ChatSummary, Folder } from '../lib/types';
import { Action, Busy, Empty, ErrorNotice, Field, Page } from '../components/ui';

export function FoldersPage() {
  const route = useRouterSnapshot();
  const navigate = useNavigate();
  const id = route.url.pathname.split('/')[2] ?? '';
  const folders = useResource<Folder[]>('/api/v1/folders/');
  const folder = folders.data?.find((item) => item.id === id);
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
    >
      <ErrorNotice error={folders.error || chats.error} retry={folders.reload} />
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
