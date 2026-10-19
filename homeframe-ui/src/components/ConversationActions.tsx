import { useState } from 'react';
import { HomeframeInput, HomeframeSelect, Link, useNavigate } from '@builtbyted/homeframe';
import { MoreHorizontal } from 'lucide-react';
import { useChat } from '../lib/chat';
import { api, download, errorMessage, remove, segment } from '../lib/api';
import { useResource } from '../lib/useResource';
import { type Chat, type Folder } from '../lib/types';
import { Action, ErrorNotice, Field } from './ui';
export function ConversationActions() {
  const state = useChat(),
    navigate = useNavigate();
  const chat = state.chat;
  const [open, setOpen] = useState(false),
    [title, setTitle] = useState(''),
    [share, setShare] = useState(''),
    [error, setError] = useState('');
  const folders = useResource<Folder[]>(open ? '/api/v1/folders/' : null);
  if (!chat?.id) return null;
  return (
    <details
      className="chat-menu"
      open={open}
      onToggle={(event) => {
        setOpen(event.currentTarget.open);
        if (event.currentTarget.open) setTitle(chat.title);
      }}
    >
      <summary aria-label="Conversation actions">
        <MoreHorizontal size={21} />
      </summary>
      <div className="stack" data-validation-scope>
        <ErrorNotice error={error} />
        <Field label="Conversation title">
          <HomeframeInput value={title} onChange={(event) => setTitle(event.target.value)} />
        </Field>
        <Action disabled={!title.trim()} run={() => state.updateChat({ title: title.trim() })}>
          Rename
        </Action>
        <Action run={async () => download(`${chat.title}.json`, chat)}>Export conversation</Action>
        <Action
          run={async () => {
            await api(`/api/v1/chats/${segment(chat.id)}/pin`, {});
            await state.refreshList();
            await state.refreshChat();
          }}
        >
          {chat.pinned ? 'Unpin' : 'Pin'} conversation
        </Action>
        <Action
          run={async () => {
            await api(`/api/v1/chats/${segment(chat.id)}/archive`, {});
            await state.refreshList();
            await state.refreshChat();
          }}
        >
          {chat.archived ? 'Restore from archive' : 'Archive conversation'}
        </Action>
        <Field label="Folder">
          <HomeframeSelect
            value={chat.folder_id ?? ''}
            onChange={(event) =>
              void api(`/api/v1/chats/${segment(chat.id)}/folder`, {
                folder_id: event.target.value || null,
              })
                .then(() => Promise.all([state.refreshChat(), state.refreshList()]))
                .then(() => setError(''))
                .catch((reason) => setError(errorMessage(reason)))
            }
          >
            <option value="">No folder</option>
            {folders.data?.map((folder) => (
              <option key={folder.id} value={folder.id}>
                {folder.name}
              </option>
            ))}
          </HomeframeSelect>
        </Field>
        <Action
          disabled={state.busy}
          run={async () => {
            const copy = await api<Chat>(`/api/v1/chats/${segment(chat.id)}/clone`, {});
            await state.refreshList();
            setOpen(false);
            await navigate(`/c/${segment(copy.id)}`);
          }}
        >
          Duplicate conversation
        </Action>
        <Action
          run={async () => {
            if (
              !chat.share_id &&
              !window.confirm(
                'Create a shared snapshot of this conversation? Anyone permitted by your workspace sharing settings may read it.',
              )
            )
              return;
            const saved = await api<Chat>(`/api/v1/chats/${segment(chat.id)}/share`, {
              share_mode: chat.chat.share_mode === 'continue' ? 'continue' : null,
            });
            setShare(`${location.origin}/s/${saved.share_id}`);
            await state.refreshChat();
          }}
        >
          {chat.share_id ? 'Update shared snapshot' : 'Share conversation'}
        </Action>
        {(share || chat.share_id) && (
          <>
            <Field label="Shared conversation link">
              <HomeframeInput readOnly value={share || `${location.origin}/s/${chat.share_id}`} />
            </Field>
            <Action
              run={() =>
                navigator.clipboard.writeText(share || `${location.origin}/s/${chat.share_id}`)
              }
            >
              Copy link
            </Action>
            <Link to={`/s/${chat.share_id}`}>View shared conversation</Link>
            <Action
              run={async () => {
                await remove(`/api/v1/chats/${segment(chat.id)}/share`);
                setShare('');
                await state.refreshChat();
              }}
            >
              Remove shared link
            </Action>
          </>
        )}
        <Action
          disabled={state.busy}
          run={async () => {
            if (!window.confirm('Permanently delete this conversation?')) return;
            await remove(`/api/v1/chats/${segment(chat.id)}`);
            await state.refreshList();
            setOpen(false);
            await navigate('/');
          }}
        >
          Delete conversation
        </Action>
      </div>
    </details>
  );
}
