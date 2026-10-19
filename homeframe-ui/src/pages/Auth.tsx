import { useEffect, useState, type FormEvent } from 'react';
import { HomeframeInput, useNavigate, useRouterSnapshot } from '@builtbyted/homeframe';
import { ArrowRight, ShieldCheck, Sparkles } from 'lucide-react';
import { api, errorMessage } from '../lib/api';
import { useSession } from '../lib/session';
import { text, type Dict, type User } from '../lib/types';
import { Busy, ErrorNotice, Field } from '../components/ui';

export function AuthPage() {
  const session = useSession();
  const [mode, setMode] = useState('signin');
  const navigate = useNavigate();
  const route = useRouterSnapshot();
  useEffect(() => {
    if (!session.user || route.url.pathname !== '/auth') return;
    const redirect = route.url.searchParams.get('redirect') || '/';
    void navigate(
      redirect.startsWith('/') &&
        !redirect.startsWith('//') &&
        !redirect.includes('\\') &&
        !redirect.startsWith('/auth')
        ? redirect
        : '/',
      { replace: true },
    );
  }, [session.user, route.url.pathname, navigate]);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [name, setName] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [challenge, setChallenge] = useState<Dict | null>(null);
  const [setup, setSetup] = useState<Dict | null>(null);
  const [code, setCode] = useState('');
  const [recovery, setRecovery] = useState(false);
  const [recoveryCodes, setRecoveryCodes] = useState<string[]>([]);
  const [pendingAccount, setPendingAccount] = useState<User | null>(null);
  const finish = async (result: Dict) => {
    if (result.next_step === 'pending') {
      setError('Your account is waiting for administrator approval.');
      return;
    }
    if (result.next_step) {
      setChallenge(result);
      setCode('');
      if (result.next_step === 'enroll')
        setSetup(
          await api<Dict>('/api/v1/auths/mfa/enroll/start', {
            challenge_token: result.challenge_token,
          }),
        );
      return;
    }
    if (Array.isArray(result.recovery_codes)) {
      setRecoveryCodes(result.recovery_codes as string[]);
      setPendingAccount(result as User);
      return;
    }
    await session.signedIn(result as User);
  };
  const submit = async (event: FormEvent) => {
    event.preventDefault();
    setBusy(true);
    setError('');
    try {
      if (challenge) {
        const step =
          challenge.next_step === 'enroll'
            ? 'enroll/confirm'
            : challenge.next_step === 'recover'
              ? 'recover'
              : 'verify';
        await finish(
          await api<Dict>(`/api/v1/auths/mfa/${step}`, {
            challenge_token: challenge.challenge_token,
            ...(step === 'recover' ? { reset_token: code } : { code, recovery }),
          }),
        );
      } else await finish(await api<Dict>(`/api/v1/auths/${mode}`, { email, password, name }));
    } catch (reason) {
      setError(errorMessage(reason));
    } finally {
      setBusy(false);
    }
  };
  return (
    <div className="auth-page">
      <div className="auth-card">
        <Sparkles className="auth-logo" aria-hidden="true" />
        <p className="eyebrow">YOUR PERSONAL AI WORKSPACE</p>
        <h1>{challenge ? 'Secure your session' : 'Welcome to Studio AI'}</h1>
        <p className="muted">A little room for big ideas.</p>
        <ErrorNotice
          error={error || session.error}
          retry={session.error ? () => void session.refresh() : undefined}
        />
        {recoveryCodes.length ? (
          <div className="stack">
            <h2>Save your recovery codes</h2>
            <p>Keep these somewhere private. Each code can be used once.</p>
            <pre className="selectable">{recoveryCodes.join('\n')}</pre>
            <button
              className="primary"
              onClick={() => {
                if (pendingAccount) void session.signedIn(pendingAccount);
              }}
            >
              I have saved my codes
            </button>
          </div>
        ) : (
          <form onSubmit={submit} className="stack">
            {challenge ? (
              <>
                <ShieldCheck size={32} />
                {setup && (
                  <>
                    <img
                      className="qr-code"
                      src={text(setup.qr_code)}
                      alt="Authenticator enrollment QR code"
                    />
                    <Field label="Authenticator setup key">
                      <HomeframeInput readOnly value={text(setup.manual_key)} />
                    </Field>
                  </>
                )}
                <Field
                  label={
                    challenge.next_step === 'recover'
                      ? 'Reset token'
                      : recovery
                        ? 'Recovery code'
                        : 'Authenticator code'
                  }
                >
                  <HomeframeInput
                    autoComplete="one-time-code"
                    inputMode={recovery ? 'text' : 'numeric'}
                    value={code}
                    onChange={(event) => setCode(event.target.value)}
                    required
                  />
                </Field>
                {challenge.next_step === 'verify' && (
                  <button
                    type="button"
                    className="text-button"
                    onClick={() => setRecovery(!recovery)}
                  >
                    {recovery ? 'Use authenticator' : 'Use a recovery code'}
                  </button>
                )}
              </>
            ) : (
              <>
                {mode === 'signup' && (
                  <Field label="Your name">
                    <HomeframeInput
                      autoComplete="name"
                      value={name}
                      onChange={(event) => setName(event.target.value)}
                      required
                    />
                  </Field>
                )}
                <Field label="Email address">
                  <HomeframeInput
                    type="email"
                    autoComplete="username"
                    value={email}
                    onChange={(event) => setEmail(event.target.value)}
                    required
                  />
                </Field>
                <Field label="Password">
                  <HomeframeInput
                    type="password"
                    autoComplete={mode === 'signup' ? 'new-password' : 'current-password'}
                    value={password}
                    onChange={(event) => setPassword(event.target.value)}
                    required
                  />
                </Field>
              </>
            )}
            <button className="primary" disabled={busy}>
              {busy ? (
                <Busy label="Signing in…" />
              ) : (
                <>
                  {challenge ? 'Verify' : mode === 'signup' ? 'Create account' : 'Sign in'}
                  <ArrowRight size={18} />
                </>
              )}
            </button>
            {!challenge && session.config.features?.enable_signup && (
              <button
                type="button"
                className="text-button"
                onClick={() => setMode(mode === 'signin' ? 'signup' : 'signin')}
              >
                {mode === 'signin' ? 'Create an account' : 'Already have an account? Sign in'}
              </button>
            )}
          </form>
        )}
        {!challenge &&
          Object.entries(session.config.oauth?.providers ?? {}).map(([id, label]) => (
            <a key={id} className="button oauth" href={`/oauth/${encodeURIComponent(id)}/login`}>
              Continue with {label}
            </a>
          ))}
        <small className="auth-attribution">Built by Ted</small>
      </div>
    </div>
  );
}
