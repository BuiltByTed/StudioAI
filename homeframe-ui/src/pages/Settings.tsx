import { useState } from 'react';
import { HomeframeInput, HomeframeSelect, HomeframeTextarea, Link } from '@builtbyted/homeframe';
import { Download, LogOut, Save } from 'lucide-react';
import { api, download, errorMessage } from '../lib/api';
import { useSession } from '../lib/session';
import { object, text, type Dict } from '../lib/types';
import { Action, ErrorNotice, Field, Page, Toggle } from '../components/ui';

export function SettingsPage() {
  const session = useSession();
  const ui = object(session.settings.ui);
  const [name, setName] = useState(session.user?.name ?? '');
  const [system, setSystem] = useState(text(object(ui.params).system));
  const [theme, setTheme] = useState(localStorage.getItem('studio:theme') ?? 'system');
  const [error, setError] = useState('');
  const [saved, setSaved] = useState(false);
  const preference = async (key: string, value: unknown) => {
    setError('');
    try {
      await session.saveSettings({ ui: { [key]: value } });
      return true;
    } catch (reason) {
      setError(errorMessage(reason));
      return false;
    }
  };
  return (
    <Page
      eyebrow="MAKE YOURSELF AT HOME"
      title="Settings"
      description="A workspace that works the way you do."
      actions={
        <>
          <Link className="button" to="/settings/security">
            Account security
          </Link>
          {session.config.features?.enable_memories && (
            <Link className="button" to="/settings/memories">
              Memories
            </Link>
          )}
        </>
      }
    >
      <ErrorNotice error={error} />
      <div className="settings-grid">
        <section className="card stack">
          <h2>Profile</h2>
          <Field label="Name">
            <HomeframeInput value={name} onChange={(event) => setName(event.target.value)} />
          </Field>
          <Field label="Email">
            <HomeframeInput type="email" value={session.user?.email ?? ''} readOnly />
          </Field>
          <Action
            run={async () => {
              await api('/api/v1/auths/update/profile', {
                name,
                profile_image_url: session.user?.profile_image_url ?? '/user.png',
                bio: session.user?.bio ?? null,
                gender: session.user?.gender ?? null,
                date_of_birth: session.user?.date_of_birth ?? null,
              });
              await session.refresh();
            }}
          >
            <Save size={16} />
            Save profile
          </Action>
        </section>
        <section className="card stack">
          <h2>Appearance</h2>
          <Field label="Theme">
            <HomeframeSelect
              value={theme}
              onChange={(event) => {
                const value = event.target.value;
                setTheme(value);
                localStorage.setItem('studio:theme', value);
                localStorage.setItem('theme', value);
                window.dispatchEvent(new Event('studio:theme'));
              }}
            >
              <option value="system">Follow device</option>
              <option value="light">Light</option>
              <option value="dark">Dark</option>
            </HomeframeSelect>
          </Field>
          <Field label="Default model">
            <HomeframeSelect
              value={
                Array.isArray(ui.models)
                  ? text(ui.models[0])
                  : (session.config.default_models?.split(',')[0] ?? '')
              }
              onChange={(event) => void preference('models', [event.target.value])}
            >
              <option value="">Server default</option>
              {session.models.map((model) => (
                <option key={model.id} value={model.id}>
                  {model.name ?? model.id}
                </option>
              ))}
            </HomeframeSelect>
          </Field>
        </section>
        <section className="card stack">
          <h2>Conversations</h2>
          <Toggle
            label="Search the web by default"
            checked={ui.webSearch === 'always'}
            onChange={(value) => void preference('webSearch', value ? 'always' : null)}
          />
          <Toggle
            label="Suggest follow-up questions"
            checked={ui.autoFollowUps !== false}
            onChange={(value) => void preference('autoFollowUps', value)}
          />
          <Toggle
            label="Use memories"
            checked={ui.memory === true}
            onChange={(value) => void preference('memory', value)}
            hint="Use saved personal context in conversations."
          />
          <Field
            label="Your instructions"
            hint="Applied to new conversations alongside your selected model's settings."
          >
            <HomeframeTextarea
              rows={5}
              value={system}
              onChange={(event) => {
                setSystem(event.target.value);
                setSaved(false);
              }}
            />
          </Field>
          <Action
            run={async () => {
              setSaved(await preference('params', { ...object(ui.params), system }));
            }}
          >
            {saved ? 'Saved' : 'Save instructions'}
          </Action>
        </section>
        <section className="card stack">
          <h2>Your data</h2>
          <p className="muted">
            Download your conversations as JSON. Your chats stay on this server.
          </p>
          <Action
            run={async () => download('studio-ai-chats.json', await api('/api/v1/chats/all'))}
          >
            <Download size={16} />
            Export conversations
          </Action>
          <Field label="Import conversations">
            <HomeframeInput
              type="file"
              accept="application/json,.json"
              onChange={(event) => {
                const file = event.target.files?.[0];
                if (!file) return;
                void file
                  .text()
                  .then(async (content) => {
                    const chats: unknown = JSON.parse(content);
                    if (!Array.isArray(chats))
                      throw new Error('Choose a Studio AI or Open WebUI conversation export.');
                    await api('/api/v1/chats/import', { chats });
                  })
                  .catch((reason) => setError(errorMessage(reason)));
              }}
            />
          </Field>
        </section>
        <section className="card stack">
          <h2>About this workspace</h2>
          <p>
            Studio AI is a maintained fork of Open WebUI, with a React interface built on Homeframe.
          </p>
          <div className="actions">
            <a href="https://github.com/BuiltByTed/StudioAI" target="_blank" rel="noreferrer">
              Source code
            </a>
            <a href="https://github.com/open-webui/open-webui" target="_blank" rel="noreferrer">
              Open WebUI
            </a>
            <a href="https://github.com/BuiltByTed/Homeframe" target="_blank" rel="noreferrer">
              Homeframe
            </a>
          </div>
          <Action run={session.logout}>
            <LogOut size={16} />
            Sign out
          </Action>
        </section>
      </div>
    </Page>
  );
}
