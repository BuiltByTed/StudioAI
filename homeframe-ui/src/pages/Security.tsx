import { useState } from 'react';
import { HomeframeInput, Link } from '@builtbyted/homeframe';
import { api, ApiError, remove } from '../lib/api';
import { useSession } from '../lib/session';
import { useResource } from '../lib/useResource';
import { text, type Dict } from '../lib/types';
import { Action, Busy, ErrorNotice, Field, Page, Toggle } from '../components/ui';

export function SecurityPage() {
  const { config, refresh } = useSession();
  const [password, setPassword] = useState(''),
    [next, setNext] = useState('');
  const [saved, setSaved] = useState(false),
    [key, setKey] = useState(''),
    [reveal, setReveal] = useState(false);
  const mfa = useResource<Dict>('/api/v1/auths/mfa/status');
  const [code, setCode] = useState(''),
    [recovery, setRecovery] = useState(false);
  const [codes, setCodes] = useState<string[]>([]),
    [setup, setSetup] = useState<Dict | null>(null),
    [challenge, setChallenge] = useState('');
  return (
    <Page
      title="Account security"
      description="Manage your password, API access and two-factor authentication."
      actions={
        <Link className="button" to="/settings">
          Settings
        </Link>
      }
    >
      <div className="settings-grid">
        {config.features?.enable_change_user_password !== false && (
          <section className="card stack" data-validation-scope>
            <h2>Password</h2>
            <Field label="Current password">
              <HomeframeInput
                type="password"
                autoComplete="current-password"
                value={password}
                onChange={(event) => setPassword(event.target.value)}
              />
            </Field>
            <Field label="New password">
              <HomeframeInput
                type="password"
                autoComplete="new-password"
                value={next}
                onChange={(event) => setNext(event.target.value)}
              />
            </Field>
            <Action
              disabled={!password || !next}
              run={async () => {
                await api('/api/v1/auths/update/password', { password, new_password: next });
                setPassword('');
                setNext('');
                setSaved(true);
                await refresh();
              }}
            >
              Change password
            </Action>
            {saved && <p role="status">Password changed.</p>}
          </section>
        )}
        {config.features?.enable_api_keys && (
          <section className="card stack">
            <h2>API access</h2>
            <p className="muted">
              Use your personal key with compatible applications. Replacing a key disconnects
              clients using the old one.
            </p>
            {key && (
              <>
                <Field label="API key">
                  <HomeframeInput
                    type={reveal ? 'text' : 'password'}
                    value={key}
                    readOnly
                    autoComplete="off"
                  />
                </Field>
                <Toggle label="Show key" checked={reveal} onChange={setReveal} />
                <Action run={() => navigator.clipboard.writeText(key)}>Copy key</Action>
              </>
            )}
            <Action
              run={async () => {
                try {
                  setKey(text((await api<Dict>('/api/v1/auths/api_key')).api_key));
                } catch (reason) {
                  if (reason instanceof ApiError && reason.status === 404)
                    throw new Error('No API key exists. Create one below.');
                  throw reason;
                }
              }}
            >
              Load existing key
            </Action>
            <Action
              run={async () => {
                if (
                  !window.confirm(
                    'Create a new API key? This replaces any existing key and disconnects clients using it.',
                  )
                )
                  return;
                setKey(text((await api<Dict>('/api/v1/auths/api_key', {})).api_key));
              }}
            >
              Create or replace key
            </Action>
            <Action
              run={async () => {
                if (!window.confirm('Revoke your API key? Applications using it will lose access.'))
                  return;
                await remove('/api/v1/auths/api_key');
                setKey('');
              }}
            >
              Revoke key
            </Action>
          </section>
        )}
        <section className="card stack">
          <h2>Two-factor authentication</h2>
          <ErrorNotice error={mfa.error} retry={mfa.reload} />
          {mfa.loading ? (
            <Busy />
          ) : (
            mfa.data && (
              <>
                <p>
                  {mfa.data.enabled ? 'Authenticator enabled' : 'Authenticator is not enabled'}
                  {mfa.data.required ? ' · Required by this server' : ''}
                </p>
                {mfa.data.enabled ? (
                  <>
                    <p className="muted">
                      {Number(mfa.data.recovery_codes_remaining)} recovery codes remaining.
                    </p>
                    <Field label={recovery ? 'Recovery code' : 'Authenticator code'}>
                      <HomeframeInput
                        value={code}
                        autoComplete="one-time-code"
                        onChange={(event) => setCode(event.target.value)}
                      />
                    </Field>
                    <Toggle label="Use a recovery code" checked={recovery} onChange={setRecovery} />
                    <Action
                      disabled={!code}
                      run={async () => {
                        if (
                          !window.confirm(
                            'Replace your recovery codes? Previously issued codes will stop working.',
                          )
                        )
                          return;
                        const result = await api<Dict>('/api/v1/auths/mfa/recovery/codes', {
                          code,
                          recovery,
                        });
                        setCodes(result.recovery_codes as string[]);
                        setCode('');
                        mfa.reload();
                      }}
                    >
                      Replace recovery codes
                    </Action>
                    <Action
                      disabled={!code}
                      run={async () => {
                        const result = await api<Dict>('/api/v1/auths/mfa/replace', {
                          code,
                          recovery,
                        });
                        const token = text(result.challenge_token);
                        setChallenge(token);
                        setSetup(
                          await api<Dict>('/api/v1/auths/mfa/enroll/start', {
                            challenge_token: token,
                          }),
                        );
                        setCode('');
                      }}
                    >
                      Replace authenticator
                    </Action>
                  </>
                ) : (
                  <p className="muted">
                    Authenticator enrollment follows the server's sign-in policy. Your administrator
                    can require it for the next sign-in.
                  </p>
                )}
              </>
            )
          )}
          {setup && (
            <>
              <img
                className="qr-code"
                src={text(setup.qr_code)}
                alt="Scan with your authenticator"
              />
              <Field label="Authenticator setup key">
                <HomeframeInput value={text(setup.manual_key)} readOnly />
              </Field>
              <Field label="New authenticator code">
                <HomeframeInput value={code} onChange={(event) => setCode(event.target.value)} />
              </Field>
              <Action
                disabled={!code}
                run={async () => {
                  const result = await api<Dict>('/api/v1/auths/mfa/enroll/confirm', {
                    challenge_token: challenge,
                    code,
                  });
                  setCodes(result.recovery_codes as string[]);
                  setSetup(null);
                  setChallenge('');
                  setCode('');
                  mfa.reload();
                  await refresh();
                }}
              >
                Confirm authenticator
              </Action>
            </>
          )}
          {codes.length > 0 && (
            <>
              <p>Save these codes privately. Each works once.</p>
              <pre className="selectable">{codes.join('\n')}</pre>
              <Action run={() => navigator.clipboard.writeText(codes.join('\n'))}>
                Copy recovery codes
              </Action>
              <button onClick={() => setCodes([])}>I have saved my codes</button>
            </>
          )}
        </section>
      </div>
    </Page>
  );
}
