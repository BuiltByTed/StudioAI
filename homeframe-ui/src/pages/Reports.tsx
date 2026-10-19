import { useState } from 'react';
import { HomeframeInput, HomeframeSelect, Link, useRouterSnapshot } from '@builtbyted/homeframe';
import { useResource } from '../lib/useResource';
import { useSession } from '../lib/session';
import { download } from '../lib/api';
import { items, object, text, type Dict } from '../lib/types';
import { Action, Busy, Empty, ErrorNotice, Field, Page } from '../components/ui';
import { AdminNav } from '../components/AdminNav';
export function ReportsPage() {
  const { user } = useSession();
  const route = useRouterSnapshot();
  const evaluation = route.url.pathname.includes('evaluations');
  const [start, setStart] = useState(''),
    [end, setEnd] = useState(''),
    [page, setPage] = useState(1);
  const tab = route.url.pathname.split('/')[3] || (evaluation ? 'leaderboard' : 'models');
  const params = new URLSearchParams();
  if (start) params.set('start_date', String(new Date(`${start}T00:00:00`).getTime() / 1000));
  if (end) params.set('end_date', String(new Date(`${end}T23:59:59`).getTime() / 1000));
  const summary = useResource<Dict>(
    user?.role === 'admin' && !evaluation ? `/api/v1/analytics/summary?${params}` : null,
  );
  const resource = useResource<Dict>(
    user?.role === 'admin'
      ? evaluation
        ? `/api/v1/evaluations/${tab === 'feedback' ? `feedbacks/list?page=${page}` : 'leaderboard'}`
        : `/api/v1/analytics/${['models', 'users', 'tokens', 'daily'].includes(tab) ? tab : 'models'}?${params}`
      : null,
  );
  if (user?.role !== 'admin') return <Empty title="Administrator access required" />;
  const columns = evaluation
    ? tab === 'feedback'
      ? ['Model', 'Rating', 'Comment', 'Created']
      : ['Model', 'Rating', 'Wins', 'Losses', 'Comparisons']
    : tab === 'users'
      ? ['Person', 'Messages', 'Input tokens', 'Output tokens']
      : tab === 'tokens'
        ? ['Model', 'Messages', 'Input tokens', 'Output tokens', 'Total tokens']
        : tab === 'daily'
          ? ['Date', 'Model', 'Messages']
          : ['Model', 'Messages', 'People', 'Conversations'];
  let rows: unknown[][] = [];
  if (evaluation)
    rows =
      tab === 'feedback'
        ? items<Dict>(resource.data?.items ?? resource.data).map((item) => {
            const data = object(item.data);
            return [
              data.model_id,
              data.rating,
              data.comment,
              new Date(Number(item.created_at) * 1000).toLocaleString(),
            ];
          })
        : items<Dict>(resource.data?.entries).map((item) => [
            item.model_id,
            item.rating,
            item.won,
            item.lost,
            item.count,
          ]);
  else if (tab === 'daily')
    rows = items<Dict>(resource.data?.data).flatMap((item) =>
      Object.entries(object(item.models)).map(([model, count]) => [item.date, model, count]),
    );
  else if (tab === 'users')
    rows = items<Dict>(resource.data?.users).map((item) => [
      item.name || item.email,
      item.count,
      item.input_tokens,
      item.output_tokens,
    ]);
  else if (tab === 'tokens')
    rows = items<Dict>(resource.data?.models).map((item) => [
      item.model_id,
      item.message_count,
      item.input_tokens,
      item.output_tokens,
      item.total_tokens,
    ]);
  else
    rows = items<Dict>(resource.data?.models).map((item) => [
      item.model_id,
      item.count,
      item.unique_users,
      item.unique_chats,
    ]);
  return (
    <Page
      title={evaluation ? 'Evaluations' : 'Usage analytics'}
      description={
        evaluation
          ? 'Model comparisons and feedback from this workspace.'
          : 'See how your workspace and models are being used.'
      }
      actions={
        <Action
          run={async () =>
            download(`${evaluation ? 'evaluations' : 'analytics'}-${tab}.json`, resource.data)
          }
        >
          Export report
        </Action>
      }
    >
      <AdminNav />
      <nav className="tabs">
        {(evaluation ? ['leaderboard', 'feedback'] : ['models', 'users', 'tokens', 'daily']).map(
          (value) => (
            <Link key={value} to={`/admin/${evaluation ? 'evaluations' : 'analytics'}/${value}`}>
              {value.charAt(0).toUpperCase() + value.slice(1)}
            </Link>
          ),
        )}
      </nav>
      {!evaluation && (
        <div className="inline-form">
          <Field label="From">
            <HomeframeInput
              type="date"
              value={start}
              onChange={(event) => setStart(event.target.value)}
            />
          </Field>
          <Field label="Through">
            <HomeframeInput
              type="date"
              value={end}
              onChange={(event) => setEnd(event.target.value)}
            />
          </Field>
        </div>
      )}
      <ErrorNotice
        error={resource.error || summary.error}
        retry={() => {
          resource.reload();
          summary.reload();
        }}
      />
      {summary.data && (
        <div className="card-grid">
          {Object.entries(summary.data).map(([key, value]) => (
            <div className="card" key={key}>
              <p className="muted">{key.replaceAll('_', ' ')}</p>
              <h2>{Number(value).toLocaleString()}</h2>
            </div>
          ))}
        </div>
      )}
      {resource.loading ? (
        <Busy />
      ) : rows.length ? (
        <div className="table-scroll">
          <table>
            <thead>
              <tr>
                {columns.map((column) => (
                  <th key={column}>{column}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {rows.map((row, i) => (
                <tr key={i}>
                  {row.map((value, j) => (
                    <td key={j}>
                      {typeof value === 'number' ? value.toLocaleString() : String(value ?? '—')}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : (
        <Empty title="No activity for this view" />
      )}
      {evaluation && tab === 'feedback' && (
        <div className="pagination">
          <button disabled={page === 1} onClick={() => setPage(page - 1)}>
            Previous
          </button>
          <span>Page {page}</span>
          <button
            disabled={page * 30 >= Number(resource.data?.total ?? 0)}
            onClick={() => setPage(page + 1)}
          >
            Next
          </button>
        </div>
      )}
    </Page>
  );
}
