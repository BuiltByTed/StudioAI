import { useEffect, useState } from 'react';
import {
  HomeframeInput,
  HomeframeTextarea,
  Link,
  useHomeframeUpdate,
  useNavigate,
  useRouterSnapshot,
} from '@builtbyted/homeframe';
import { FileText, Plus, Save } from 'lucide-react';
import { api, errorMessage, segment } from '../lib/api';
import { useResource } from '../lib/useResource';
import { object, text, type Resource } from '../lib/types';
import { Busy, Empty, ErrorNotice, Field, Page } from '../components/ui';
import { Markdown } from '../components/Markdown';

export function NotesPage() {
  const route = useRouterSnapshot();
  const navigate = useNavigate();
  const id = route.url.pathname.split('/')[2] ?? '';
  const list = useResource<Resource[]>(!id ? '/api/v1/notes/' : null);
  const note = useResource<Resource>(id && id !== 'new' ? `/api/v1/notes/${segment(id)}` : null);
  const [title, setTitle] = useState('');
  const [content, setContent] = useState('');
  const [dirty, setDirty] = useState(false);
  const [preview, setPreview] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const update = useHomeframeUpdate();
  useEffect(() => {
    setTitle(note.data?.title ?? '');
    setContent(text(object(note.data?.data?.content).md));
    setDirty(false);
    setError('');
  }, [id, note.data]);
  useEffect(() => update.registerGuard(() => !dirty && !busy), [dirty, busy, update.registerGuard]);
  const save = async () => {
    setBusy(true);
    setError('');
    try {
      const saved = await api<Resource>(
        id === 'new' ? '/api/v1/notes/create' : `/api/v1/notes/${segment(id)}/update`,
        {
          title: title || 'Untitled note',
          data: {
            ...note.data?.data,
            content: { ...object(note.data?.data?.content), md: content },
          },
        },
      );
      setDirty(false);
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
