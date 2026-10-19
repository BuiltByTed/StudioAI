import { useEffect, useState } from 'react';
import {
  HomeframeInput,
  HomeframeSelect,
  HomeframeTextarea,
  Link,
  useHomeframeUpdate,
  useNavigate,
  useRouterSnapshot,
} from '@builtbyted/homeframe';
import { api, remove, segment } from '../lib/api';
import { useResource } from '../lib/useResource';
import { useSession } from '../lib/session';
import { items, object, text, type Dict } from '../lib/types';
import { Action, Busy, Empty, ErrorNotice, Field, Page, Toggle } from '../components/ui';

export function AutomationsPage() {
  const route = useRouterSnapshot(),
    navigate = useNavigate();
  const { models, config, user } = useSession();
  const id = route.url.pathname.split('/')[2] ?? '',
    creating = id === 'new';
  const [page, setPage] = useState(1),
    [query, setQuery] = useState('');
  const enabled = !!config.features?.enable_automations;
  const resource = useResource<Dict>(
    enabled
      ? id
        ? creating
          ? null
          : `/api/v1/automations/${segment(id)}`
        : `/api/v1/automations/list?page=${page}&query=${segment(query)}`
      : null,
  );
  const runs = useResource<Dict[]>(
    enabled && id && !creating ? `/api/v1/automations/${segment(id)}/runs` : null,
  );
  const [draft, setDraft] = useState<Dict>({}),
    [dirty, setDirty] = useState(false);
  const update = useHomeframeUpdate();
  useEffect(() => {
    setDraft(
      resource.data ?? {
        name: '',
        is_active: false,
        data: {
          prompt: '',
          model_id: models[0]?.id ?? '',
          rrule: 'FREQ=DAILY;BYHOUR=9;BYMINUTE=0',
        },
      },
    );
    setDirty(false);
  }, [id, resource.data, models]);
  useEffect(() => update.registerGuard(() => !dirty), [dirty, update.registerGuard]);
  const data = object(draft.data);
  const rule = text(data.rrule);
  const frequency = /FREQ=(DAILY|WEEKLY)(?:;|$)/.exec(rule)?.[1] ?? 'CUSTOM';
  const hour = /BYHOUR=(\d+)/.exec(rule)?.[1] ?? '9',
    minute = /BYMINUTE=(\d+)/.exec(rule)?.[1] ?? '0';
  const day = /BYDAY=([A-Z,]+)/.exec(rule)?.[1] ?? 'MO';
  const edit = (patch: Dict) => {
    setDraft((previous) => ({ ...previous, ...patch }));
    setDirty(true);
  };
  const editData = (patch: Dict) => edit({ data: { ...data, ...patch } });
  const schedule = (
    freq: string,
    time = `${hour.padStart(2, '0')}:${minute.padStart(2, '0')}`,
    weekday = day,
  ) => {
    if (!/^\d{2}:\d{2}$/.test(time)) return;
    const [h, m] = time.split(':');
    editData({
      rrule: `FREQ=${freq};BYHOUR=${Number(h)};BYMINUTE=${Number(m)}${freq === 'WEEKLY' ? `;BYDAY=${weekday}` : ''}`,
    });
  };
  if (!enabled)
    return (
      <Empty title="Scheduled tasks are disabled">
        An administrator can enable scheduled tasks in server settings.
      </Empty>
    );
  return (
    <Page
      title={
        id
          ? creating
            ? 'New scheduled task'
            : text(draft.name) || 'Scheduled task'
          : 'Scheduled tasks'
      }
      description="Have your assistant work on a schedule."
      actions={
        id ? (
          <Link className="button" to="/automations">
            All tasks
          </Link>
        ) : (
          <Link className="button primary" to="/automations/new">
            New task
          </Link>
        )
      }
    >
      <ErrorNotice error={resource.error || runs.error} retry={resource.reload} />
      {resource.loading ? (
        <Busy />
      ) : id ? (
        <>
          <section className="card stack" data-validation-scope>
            <Field label="Task name">
              <HomeframeInput
                required
                value={text(draft.name)}
                onChange={(event) => edit({ name: event.target.value })}
              />
            </Field>
            <Field label="Instructions">
              <HomeframeTextarea
                required
                rows={6}
                value={text(data.prompt)}
                onChange={(event) => editData({ prompt: event.target.value })}
              />
            </Field>
            <Field label="Model">
              <HomeframeSelect
                required
                value={text(data.model_id)}
                onChange={(event) => editData({ model_id: event.target.value })}
              >
                <option value="">Choose a model</option>
                {models.map((model) => (
                  <option key={model.id} value={model.id}>
                    {model.name || model.id}
                  </option>
                ))}
              </HomeframeSelect>
            </Field>
            <Field label="Repeat">
              <HomeframeSelect
                value={frequency}
                onChange={(event) =>
                  event.target.value === 'CUSTOM'
                    ? editData({ rrule: 'FREQ=MONTHLY;BYMONTHDAY=1;BYHOUR=9;BYMINUTE=0' })
                    : schedule(event.target.value)
                }
              >
                <option value="DAILY">Daily</option>
                <option value="WEEKLY">Weekly</option>
                <option value="CUSTOM">Custom schedule</option>
              </HomeframeSelect>
            </Field>
            {frequency !== 'CUSTOM' && (
              <Field label="Time" hint={`Timezone: ${text(user?.timezone) || 'server timezone'}`}>
                <HomeframeInput
                  type="time"
                  required
                  value={`${hour.padStart(2, '0')}:${minute.padStart(2, '0')}`}
                  onChange={(event) => schedule(frequency, event.target.value)}
                />
              </Field>
            )}
            {frequency === 'WEEKLY' && (
              <Field label="Day">
                <HomeframeSelect
                  value={day}
                  onChange={(event) => schedule(frequency, undefined, event.target.value)}
                >
                  {[
                    ['MO', 'Monday'],
                    ['TU', 'Tuesday'],
                    ['WE', 'Wednesday'],
                    ['TH', 'Thursday'],
                    ['FR', 'Friday'],
                    ['SA', 'Saturday'],
                    ['SU', 'Sunday'],
                  ].map(([value, label]) => (
                    <option key={value} value={value}>
                      {label}
                    </option>
                  ))}
                </HomeframeSelect>
              </Field>
            )}
            <details open={frequency === 'CUSTOM'}>
              <summary>Advanced recurrence rule</summary>
              <Field label="Recurrence rule">
                <HomeframeTextarea
                  value={rule}
                  onChange={(event) => editData({ rrule: event.target.value })}
                />
              </Field>
            </details>
            <Toggle
              label="Task enabled"
              checked={draft.is_active === true}
              onChange={(value) => edit({ is_active: value })}
              hint="Disabled tasks remain saved without running."
            />
            <Action
              className="primary"
              disabled={!dirty && !creating}
              run={async () => {
                const saved = await api<Dict>(
                  creating
                    ? '/api/v1/automations/create'
                    : `/api/v1/automations/${segment(id)}/update`,
                  { ...draft, data },
                );
                setDirty(false);
                if (creating)
                  await navigate(`/automations/${segment(text(saved.id))}`, { replace: true });
                else resource.reload();
              }}
            >
              Save task
            </Action>
          </section>
          {!creating && (
            <>
              <div className="actions">
                <Action
                  disabled={dirty}
                  run={async () => {
                    if (!window.confirm('Run this task now?')) return;
                    await api(`/api/v1/automations/${segment(id)}/run`, {});
                    runs.reload();
                  }}
                >
                  Run now
                </Action>
                <Action
                  run={async () => {
                    if (!window.confirm('Delete this scheduled task?')) return;
                    await remove(`/api/v1/automations/${segment(id)}/delete`);
                    await navigate('/automations');
                  }}
                >
                  Delete task
                </Action>
              </div>
              <h2>Next scheduled runs</h2>
              {items<number>(resource.data?.next_runs).map((time) => (
                <p key={time}>{new Date(time / 1e6).toLocaleString()}</p>
              ))}
              <h2>Run history</h2>
              {items<Dict>(runs.data).map((run) => (
                <div className="list-row" key={text(run.id)}>
                  <span>{new Date(Number(run.created_at) / 1e6).toLocaleString()}</span>
                  <span>{text(run.status)}</span>
                  {run.chat_id ? (
                    <Link to={`/c/${segment(text(run.chat_id))}`}>Open conversation</Link>
                  ) : null}
                  {run.error ? <ErrorNotice error={text(run.error)} /> : null}
                </div>
              ))}
            </>
          )}
        </>
      ) : (
        <>
          <Field label="Find a task">
            <HomeframeInput
              type="search"
              value={query}
              onChange={(event) => {
                setQuery(event.target.value);
                setPage(1);
              }}
            />
          </Field>
          <div className="list-card">
            {items<Dict>(resource.data).map((task) => (
              <Link
                className="list-row"
                key={text(task.id)}
                to={`/automations/${segment(text(task.id))}`}
              >
                <div>
                  <strong>{text(task.name)}</strong>
                  <small>{text(object(task.data).prompt)}</small>
                </div>
                <span className="badge">{task.is_active ? 'Enabled' : 'Paused'}</span>
              </Link>
            ))}
          </div>
          {!items(resource.data).length && (
            <Empty title="No scheduled tasks yet" to="/automations/new" action="Create a task" />
          )}
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
        </>
      )}
    </Page>
  );
}
