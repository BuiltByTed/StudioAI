import { useState } from 'react';
import { HomeframeInput, HomeframeSelect, HomeframeTextarea } from '@builtbyted/homeframe';
import { CalendarDays, ChevronLeft, ChevronRight, Plus } from 'lucide-react';
import { api, segment } from '../lib/api';
import { useResource } from '../lib/useResource';
import { items, text, type Dict } from '../lib/types';
import { Action, Busy, Empty, ErrorNotice, Field, Page } from '../components/ui';

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
      <ErrorNotice error={events.error || calendars.error} retry={events.reload} />
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
      </details>
      {editing && (
        <div className="card stack">
          <Field label="Event title">
            <HomeframeInput
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
          <div className="settings-grid">
            <Field label="Starts">
              <HomeframeInput
                type="datetime-local"
                value={start}
                onChange={(event) => setStart(event.target.value)}
              />
            </Field>
            <Field label="Ends">
              <HomeframeInput
                type="datetime-local"
                value={finish}
                min={start}
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
          <div className="actions">
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
                    start_at: new Date(start).getTime() * 1000000,
                    end_at: finish ? new Date(finish).getTime() * 1000000 : null,
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
              key={event.id}
              className="list-row calendar-event"
              onClick={() => {
                setDraft(event);
                setStart(toInput(event.start_at));
                setFinish(event.end_at ? toInput(event.end_at) : '');
                setEditing(true);
              }}
            >
              <CalendarDays size={20} />
              <div>
                <strong>{event.title}</strong>
                <small>
                  {new Date(event.start_at / 1000000).toLocaleString()}{' '}
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
