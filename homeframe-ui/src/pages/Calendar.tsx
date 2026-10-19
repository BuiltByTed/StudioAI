import { AccessEditor } from '../components/AccessEditor';
import { useState } from 'react';
import {
  HomeframeInput,
  HomeframeSelect,
  HomeframeTextarea,
  Link,
  useNavigate,
} from '@builtbyted/homeframe';
import { CalendarDays, ChevronLeft, ChevronRight, Plus } from 'lucide-react';
import { api, errorMessage, remove, segment } from '../lib/api';
import { useResource } from '../lib/useResource';
import { items, object, text, type Dict } from '../lib/types';
import { Action, Busy, Empty, ErrorNotice, Field, JSONField, Page, Toggle } from '../components/ui';

interface Calendar extends Dict {
  id: string;
  name: string;
  is_system?: boolean;
}
interface CalendarEvent extends Dict {
  id: string;
  title: string;
  start_at: number;
  end_at?: number;
  description?: string;
  location?: string;
  calendar_id: string;
}
export function CalendarPage() {
  const navigate = useNavigate();
  const [error, setError] = useState('');
  const [month, setMonth] = useState(
    () => new Date(new Date().getFullYear(), new Date().getMonth(), 1),
  );
  const end = new Date(month.getFullYear(), month.getMonth() + 1, 1);
  const calendars = useResource<Calendar[]>('/api/v1/calendars/');
  const events = useResource<unknown>(
    `/api/v1/calendars/events?start=${encodeURIComponent(month.toISOString())}&end=${encodeURIComponent(end.toISOString())}`,
  );
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState<Partial<CalendarEvent>>({});
  const [start, setStart] = useState('');
  const [finish, setFinish] = useState('');
  const [name, setName] = useState('');
  const list = items<CalendarEvent>(events.data).sort((a, b) => a.start_at - b.start_at);
  const toInput = (value: number) => {
    const date = new Date(value / 1000000);
    return new Date(date.getTime() - date.getTimezoneOffset() * 60000).toISOString().slice(0, 16);
  };
  return (
    <Page
      eyebrow="MAKE TIME FOR IT"
      title="Calendar"
      actions={
        <button
          className="primary"
          onClick={() => {
            setDraft({});
            setStart('');
            setFinish('');
            setEditing(true);
          }}
        >
          <Plus size={16} />
          New event
        </button>
      }
    >
      <ErrorNotice error={error || events.error || calendars.error} retry={events.reload} />
      <div className="month-heading">
        <button
          aria-label="Previous month"
          onClick={() => setMonth(new Date(month.getFullYear(), month.getMonth() - 1, 1))}
        >
          <ChevronLeft size={18} />
        </button>
        <h2>{month.toLocaleDateString(undefined, { month: 'long', year: 'numeric' })}</h2>
        <button aria-label="Next month" onClick={() => setMonth(end)}>
          <ChevronRight size={18} />
        </button>
      </div>
      <details>
        <summary>Manage calendars</summary>
        <div className="card inline-form">
          <Field label="Calendar name">
            <HomeframeInput
              placeholder="Personal"
              value={name}
              onChange={(event) => setName(event.target.value)}
            />
          </Field>
          <Action
            disabled={!name.trim()}
            run={async () => {
              await api('/api/v1/calendars/create', { name, color: '#356a54' });
              setName('');
              calendars.reload();
            }}
          >
            Create calendar
          </Action>
        </div>
        <CalendarSettings
          calendars={calendars.data ?? []}
          reload={() => {
            calendars.reload();
            events.reload();
          }}
        />
      </details>
      {editing && (
        <div className="card stack" data-validation-scope>
          {draft.rrule ? (
            <p className="muted">Changes apply to the entire recurring series.</p>
          ) : null}
          <Field label="Event title">
            <HomeframeInput
              required
              value={draft.title ?? ''}
              onChange={(event) => setDraft({ ...draft, title: event.target.value })}
            />
          </Field>
          <Field label="Calendar">
            <HomeframeSelect
              value={draft.calendar_id ?? ''}
              onChange={(event) => setDraft({ ...draft, calendar_id: event.target.value })}
            >
              <option value="">Choose a calendar</option>
              {calendars.data
                ?.filter((calendar) => !calendar.is_system)
                .map((calendar) => (
                  <option key={calendar.id} value={calendar.id}>
                    {calendar.name}
                  </option>
                ))}
            </HomeframeSelect>
          </Field>
          <Toggle
            label="All-day event"
            checked={draft.all_day === true}
            onChange={(value) => setDraft({ ...draft, all_day: value })}
          />
          <div className="settings-grid">
            <Field label="Starts">
              <HomeframeInput
                type={draft.all_day ? 'date' : 'datetime-local'}
                required
                value={draft.all_day ? start.slice(0, 10) : start}
                onChange={(event) => setStart(event.target.value)}
              />
            </Field>
            <Field label="Ends">
              <HomeframeInput
                type={draft.all_day ? 'date' : 'datetime-local'}
                value={draft.all_day ? finish.slice(0, 10) : finish}
                min={draft.all_day ? start.slice(0, 10) : start}
                onChange={(event) => setFinish(event.target.value)}
              />
            </Field>
          </div>
          <Field label="Location">
            <HomeframeInput
              value={draft.location ?? ''}
              onChange={(event) => setDraft({ ...draft, location: event.target.value })}
            />
          </Field>
          <Field label="Description">
            <HomeframeTextarea
              rows={3}
              value={draft.description ?? ''}
              onChange={(event) => setDraft({ ...draft, description: event.target.value })}
            />
          </Field>
          <Field
            label="Recurrence rule"
            hint="Leave empty for a one-time event. Recurring changes apply to the whole series."
          >
            <HomeframeInput
              value={text(draft.rrule)}
              placeholder="FREQ=WEEKLY;BYDAY=MO"
              onChange={(event) => setDraft({ ...draft, rrule: event.target.value || null })}
            />
          </Field>
          <details>
            <summary>Attendees</summary>
            <JSONField
              key={draft.id ?? 'new'}
              label="Event attendees"
              value={draft.attendees ?? []}
              onChange={(value) => setDraft({ ...draft, attendees: value })}
            />
          </details>
          <div className="actions">
            {draft.id && (
              <Action
                run={async () => {
                  if (
                    !window.confirm(
                      draft.rrule ? 'Delete this entire recurring series?' : 'Delete this event?',
                    )
                  )
                    return;
                  await remove(`/api/v1/calendars/events/${segment(draft.id!)}/delete`);
                  setEditing(false);
                  events.reload();
                }}
              >
                Delete event
              </Action>
            )}
            <button onClick={() => setEditing(false)}>Cancel</button>
            <Action
              className="primary"
              disabled={
                !draft.title ||
                !draft.calendar_id ||
                !start ||
                (!!finish && new Date(finish) < new Date(start))
              }
              run={async () => {
                await api(
                  draft.id
                    ? `/api/v1/calendars/events/${segment(draft.id)}/update`
                    : '/api/v1/calendars/events/create',
                  {
                    ...draft,
                    start_at:
                      new Date(start.length === 10 ? start + 'T00:00' : start).getTime() * 1000000,
                    end_at: finish
                      ? new Date(finish.length === 10 ? finish + 'T00:00' : finish).getTime() *
                        1000000
                      : null,
                  },
                );
                setEditing(false);
                events.reload();
              }}
            >
              Save event
            </Action>
          </div>
        </div>
      )}
      {events.loading ? (
        <Busy />
      ) : list.length ? (
        <div className="list-card">
          {list.map((event) => (
            <button
              key={`${event.id}-${event.start_at}`}
              className="list-row calendar-event"
              onClick={() => {
                const automation = text(object(event.meta).automation_id);
                if (automation) {
                  void navigate(`/automations/${segment(automation)}`);
                  return;
                }
                setError('');
                void api<CalendarEvent>(`/api/v1/calendars/events/${segment(event.id)}`)
                  .then((saved) => {
                    setDraft(saved);
                    setStart(toInput(saved.start_at));
                    setFinish(saved.end_at ? toInput(saved.end_at) : '');
                    setEditing(true);
                  })
                  .catch((reason) => setError(errorMessage(reason)));
              }}
            >
              <CalendarDays size={20} />
              <div>
                <strong>{event.title}</strong>
                <small>
                  {event.all_day
                    ? new Date(event.start_at / 1000000).toLocaleDateString() + ' · All day'
                    : new Date(event.start_at / 1000000).toLocaleString()}{' '}
                  {event.location && `· ${event.location}`}
                </small>
              </div>
            </button>
          ))}
        </div>
      ) : (
        <Empty title="A little breathing room">No events this month.</Empty>
      )}
    </Page>
  );
}

function CalendarSettings({ calendars, reload }: { calendars: Calendar[]; reload: () => void }) {
  const [draft, setDraft] = useState<Calendar | null>(null);
  return (
    <div className="stack">
      {calendars
        .filter((c) => !c.is_system)
        .map((calendar) => (
          <div className="list-row" key={calendar.id}>
            <strong>{calendar.name}</strong>
            {calendar.is_default ? <span className="badge">Default</span> : null}
            <button onClick={() => setDraft({ ...calendar })}>Edit calendar</button>
          </div>
        ))}
      {draft && (
        <div className="card stack" data-validation-scope>
          <Field label="Calendar title">
            <HomeframeInput
              required
              value={draft.name}
              onChange={(e) => setDraft({ ...draft, name: e.target.value })}
            />
          </Field>
          <Field label="Calendar color">
            <HomeframeInput
              type="color"
              value={text(draft.color) || '#356a54'}
              onChange={(e) => setDraft({ ...draft, color: e.target.value })}
            />
          </Field>
          <details>
            <summary>Calendar sharing</summary>
            <AccessEditor
              label="Calendar access grants"
              value={draft.access_grants ?? []}
              onChange={(value) => setDraft({ ...draft, access_grants: value })}
            />
          </details>
          <div className="actions">
            <Action
              run={async () => {
                await api(`/api/v1/calendars/${segment(draft.id)}/update`, {
                  name: draft.name,
                  color: draft.color,
                  access_grants: draft.access_grants,
                });
                setDraft(null);
                reload();
              }}
            >
              Save calendar
            </Action>
            {!draft.is_default && (
              <>
                <Action
                  run={async () => {
                    await api(`/api/v1/calendars/${segment(draft.id)}/default`, {});
                    setDraft(null);
                    reload();
                  }}
                >
                  Make default
                </Action>
                <Action
                  run={async () => {
                    if (!window.confirm('Delete this calendar and its events?')) return;
                    await remove(`/api/v1/calendars/${segment(draft.id)}/delete`);
                    setDraft(null);
                    reload();
                  }}
                >
                  Delete calendar
                </Action>
              </>
            )}
            <button onClick={() => setDraft(null)}>Cancel</button>
          </div>
        </div>
      )}
    </div>
  );
}
