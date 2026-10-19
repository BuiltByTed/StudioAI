import { Link, useNavigate, useRouterSnapshot } from '@builtbyted/homeframe';
import { useResource } from '../lib/useResource';
import { useSession } from '../lib/session';
import { branch, normalizeHistory, outputText } from '../lib/history';
import { api, segment } from '../lib/api';
import type { Chat } from '../lib/types';
import { Action, Busy, ErrorNotice, Page } from '../components/ui';
import { Markdown } from '../components/Markdown';

export function SharedPage() {
  const route = useRouterSnapshot(),
    navigate = useNavigate();
  const { user } = useSession();
  const id = route.url.pathname.split('/')[2] ?? '';
  const resource = useResource<Chat>(`/api/v1/chats/share/${segment(id)}`);
  return (
    <Page eyebrow="SHARED CONVERSATION" title={resource.data?.title ?? 'A shared conversation'}>
      <ErrorNotice error={resource.error} retry={resource.reload} />
      {resource.loading ? (
        <Busy />
      ) : (
        resource.data && (
          <div className="conversation">
            {branch(normalizeHistory(resource.data.chat)).map((message) => (
              <article
                key={message.id}
                className={`message ${message.role === 'user' ? 'user-message' : 'assistant-message'}`}
              >
                <Markdown>{outputText(message)}</Markdown>
              </article>
            ))}
            {user && (
              <Action
                run={async () => {
                  const saved = await api<Chat>(`/api/v1/chats/${segment(id)}/clone/shared`, {});
                  await navigate(`/c/${segment(saved.id)}`);
                }}
              >
                Copy to my conversations
              </Action>
            )}
            {user && resource.data.chat.share_mode === 'continue' && (
              <Link className="button primary" to={`/c/${segment(resource.data.id)}`}>
                Continue conversation
              </Link>
            )}
          </div>
        )
      )}
    </Page>
  );
}
