import { useEffect, useState } from 'react';
import {
  HomeframeInput,
  HomeframeTextarea,
  Link,
  useHomeframeUpdate,
  useNavigate,
  useRouterSnapshot,
  useStateCheckpoint,
} from '@builtbyted/homeframe';
import { FileText, Plus, Save } from 'lucide-react';
import { api, errorMessage, segment } from '../lib/api';
import { useResource } from '../lib/useResource';
import { object, text, type Resource } from '../lib/types';
import { Busy, Empty, ErrorNotice, Field, Page } from '../components/ui';
import { Markdown } from '../components/Markdown';
import { useSession } from '../lib/session';

export function NotesPage() {
  const route = useRouterSnapshot();
  const navigate = useNavigate();
  const { user } = useSession();
  const id = route.url.pathname.split('/')[2] ?? '';
  const list = useResource<Resource[]>(!id ? '/api/v1/notes/' : null);
  const note = useResource<Resource>(id && id !== 'new' ? `/api/v1/notes/${segment(id)}` : null);
  const [title, setTitle] = useState('');
  const [content, setContent] = useState('');
  const [dirty, setDirty] = useState(false);
  const [preview, setPreview] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [checkpoint, setCheckpoint] = useStateCheckpoint<{
    title: string;
    content: string;
    baseVersion: unknown;
  } | null>({ key: `note:${user?.id}:${id}`, initialValue: null, storage: 'local' });
  const update = useHomeframeUpdate();
  useEffect(() => {
    setTitle(checkpoint?.title ?? note.data?.title ?? '');
    setContent(checkpoint?.content ?? text(object(note.data?.data?.content).md));
    setDirty(!!checkpoint);
    setError('');
  }, [id, note.data]);
  useEffect(() => update.registerGuard(() => !dirty && !busy), [dirty, busy, update.registerGuard]);
  const save = async () => {
    setBusy(true);
    setError('');
    try {
      if (id !== 'new') {
        const latest = await api<Resource>(`/api/v1/notes/${segment(id)}`);
        const expected = checkpoint?.baseVersion ?? note.data?.updated_at;
        if (expected && latest.updated_at !== expected)
          throw new Error(
            'This note changed in another session. Your draft is saved locally. Copy your changes before reloading the server version.',
          );
      }
      const saved = await api<Resource>(
        id === 'new' ? '/api/v1/notes/create' : `/api/v1/notes/${segment(id)}/update`,
        {
          title: title || 'Untitled note',
          data: {
            ...note.data?.data,
            // Upstream falls back to markdown when rich representations are absent.
            // Retaining old HTML/JSON would show stale content after rollback.
            content: { md: content, html: null, json: null },
          },
        },
      );
      setDirty(false);
      setCheckpoint(null);
      if (id === 'new') await navigate(`/notes/${saved.id}`, { replace: true });
      else note.reload();
    } catch (reason) {
      setError(errorMessage(reason));
    } finally {
      setBusy(false);
    }
  };
  if (!id)
    return (
      <Page
        eyebrow="A PLACE TO KEEP THINGS"
        title="Notes"
        description="The good ideas deserve somewhere to stay."
        actions={
          <Link to="/notes/new" className="button primary">
            <Plus size={17} />
            New note
          </Link>
        }
      >
        <ErrorNotice error={list.error} retry={list.reload} />
        {list.loading ? (
          <Busy />
        ) : list.data?.length ? (
          <div className="card-grid">
            {list.data.map((item) => (
              <Link className="resource-card" to={`/notes/${segment(item.id)}`} key={item.id}>
                <FileText size={22} />
                <h2>{item.title || 'Untitled note'}</h2>
                <p>{text(object(item.data?.content).md).slice(0, 160) || 'Open note'}</p>
              </Link>
            ))}
          </div>
        ) : (
          <Empty title="Start with a blank page" to="/notes/new" action="Write a note">
            Save ideas, drafts, and the things you want to remember.
          </Empty>
        )}
      </Page>
    );
  return (
    <Page
      eyebrow="NOTES"
      title={id === 'new' ? 'A new page' : title || 'Untitled note'}
      actions={
        <>
          {dirty && (
            <button
              onClick={() => {
                if (!window.confirm('Discard the locally saved changes to this note?')) return;
                setCheckpoint(null);
                setDirty(false);
                setTitle(note.data?.title ?? '');
                setContent(text(object(note.data?.data?.content).md));
                if (id !== 'new') note.reload();
              }}
            >
              Discard draft
            </button>
          )}
          <button onClick={() => setPreview(!preview)}>{preview ? 'Edit' : 'Preview'}</button>
          <button
            className="primary"
            disabled={busy || (!dirty && id !== 'new')}
            onClick={() => void save()}
          >
            <Save size={16} />
            {busy ? 'Saving…' : 'Save'}
          </button>
        </>
      }
    >
      <ErrorNotice error={error || note.error} retry={note.error ? note.reload : undefined} />
      {note.loading ? (
        <Busy />
      ) : (
        <div className="card stack">
          <Field label="Title">
            <HomeframeInput
              value={title}
              onChange={(event) => {
                setTitle(event.target.value);
                setCheckpoint({
                  title: event.target.value,
                  content,
                  baseVersion: checkpoint?.baseVersion ?? note.data?.updated_at,
                });
                setDirty(true);
              }}
            />
          </Field>
          {preview ? (
            <Markdown>{content}</Markdown>
          ) : (
            <Field label="Note">
              <HomeframeTextarea
                className="note-editor"
                rows={20}
                value={content}
                onChange={(event) => {
                  setContent(event.target.value);
                  setCheckpoint({
                    title,
                    content: event.target.value,
                    baseVersion: checkpoint?.baseVersion ?? note.data?.updated_at,
                  });
                  setDirty(true);
                }}
                placeholder="Start writing… Markdown is welcome."
              />
            </Field>
          )}
          <p className="muted" role="status">
            {dirty ? 'Unsaved changes' : 'All changes saved'}
          </p>
        </div>
      )}
    </Page>
  );
}
