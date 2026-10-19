import { useEffect, useState } from 'react';
import { HomeframeInput, Link, useNavigate, useRouterSnapshot } from '@builtbyted/homeframe';
import { Archive, MessageSquare, Search } from 'lucide-react';
import { api, segment } from '../lib/api';
import { useResource } from '../lib/useResource';
import type { ChatSummary } from '../lib/types';
import { Action, Busy, Empty, ErrorNotice, Page } from '../components/ui';

export function SearchPage({ archived = false }: { archived?: boolean }) {
  const route = useRouterSnapshot();
  const navigate = useNavigate();
  const query = route.url.searchParams.get('q') ?? '';
  const [draft, setDraft] = useState(query);
  const [page, setPage] = useState(1);
  useEffect(() => {
    setDraft(query);
    setPage(1);
  }, [query]);
  useEffect(() => {
    if (draft === query || archived) return;
    const timer = setTimeout(
      () => void navigate(`/search?q=${encodeURIComponent(draft)}`, { replace: true }),
      300,
    );
    return () => clearTimeout(timer);
  }, [draft, query, archived, navigate]);
  const resource = useResource<ChatSummary[]>(
    archived
      ? `/api/v1/chats/archived?page=${page}`
      : query
        ? `/api/v1/chats/search?text=${encodeURIComponent(query)}&page=${page}`
        : `/api/v1/chats/?include_pinned=true&include_folders=true&page=${page}`,
  );
  return (
    <Page
      eyebrow="YOUR CONVERSATIONS"
      title={archived ? 'The archive' : 'Find that thought.'}
      description={
        archived
          ? 'Out of the way, here when you need them.'
          : 'Search across your saved conversations.'
      }
    >
      {!archived && (
        <div className="search-box">
          <Search size={20} />
          <HomeframeInput
            aria-label="Search conversations"
            placeholder="Search your chats…"
            value={draft}
            onChange={(event) => setDraft(event.target.value)}
          />
        </div>
      )}
      <ErrorNotice error={resource.error} retry={resource.reload} />
      {resource.loading ? (
        <Busy />
      ) : !resource.data?.length ? (
        <Empty
          title={
            query
              ? 'No matching conversations'
              : archived
                ? 'Your archive is empty'
                : 'A fresh start'
          }
        >
          {query
            ? 'Try another phrase or a shorter search.'
            : 'Your conversations will appear here.'}
        </Empty>
      ) : (
        <div className="list-card">
          {resource.data.map((chat) => (
            <div className="list-row" key={chat.id}>
              <MessageSquare size={19} />
              <Link to={`/c/${segment(chat.id)}`}>
                <strong>{chat.title}</strong>
                {chat.snippet && <small>{chat.snippet}</small>}
                <small>
                  {chat.updated_at ? new Date(chat.updated_at * 1000).toLocaleDateString() : ''}
                </small>
              </Link>
              {archived && (
                <Action
                  run={async () => {
                    await api(`/api/v1/chats/${segment(chat.id)}/archive`, {});
                    resource.reload();
                  }}
                >
                  Restore
                </Action>
              )}
            </div>
          ))}
        </div>
      )}
      <div className="pagination">
        <button disabled={page === 1 || resource.loading} onClick={() => setPage(page - 1)}>
          Previous
        </button>
        <span>Page {page}</span>
        <button
          disabled={(resource.data?.length ?? 0) < 60 || resource.loading}
          onClick={() => setPage(page + 1)}
        >
          Next
        </button>
      </div>
    </Page>
  );
}
