import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useRef,
  useState,
  type ReactNode,
} from 'react';
import { useHomeframeLogout } from '@builtbyted/homeframe';
import { api, ApiError, errorMessage } from './api';
import { migratePreferences, purgeAccountDrafts } from './storage';
import { object, type Dict, type Model, type ServerConfig, type User } from './types';

interface Session {
  user: User | null;
  config: ServerConfig;
  settings: Dict;
  models: Model[];
  loading: boolean;
  error: string;
  refresh: () => Promise<void>;
  signedIn: (user: User) => Promise<void>;
  logout: () => Promise<void>;
  saveSettings: (settings: Dict) => Promise<void>;
}
const Context = createContext<Session | null>(null);
export const useSession = () => {
  const session = useContext(Context);
  if (!session) throw new Error('Missing session provider');
  return session;
};
export function SessionProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [config, setConfig] = useState<ServerConfig>({});
  const [settings, setSettings] = useState<Dict>({});
  const preferences = useRef(settings);
  preferences.current = settings;
  const settingsQueue = useRef<Promise<unknown>>(Promise.resolve());
  const [models, setModels] = useState<Model[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const generation = useRef(0);
  const authCallbackHandled = useRef(false);
  const clearFrameworkState = useHomeframeLogout();
  const refresh = useCallback(async () => {
    const version = ++generation.current;
    setError('');
    setLoading(true);
    try {
      try {
        migratePreferences(localStorage);
        if (!authCallbackHandled.current && window.location.pathname === '/auth') {
          authCallbackHandled.current = true;
          const params = new URLSearchParams(window.location.search);
          if (params.has('mfa') || params.has('pending')) localStorage.removeItem('token');
          else if (params.get('state') !== 'logout') {
            // OAuth returns a fresh cookie; an old Authorization header must not
            // override it and silently restore the account used before SSO.
            const cookie = document.cookie.match(/(?:^|;\s*)token=([^;]*)/);
            if (cookie?.[1]) localStorage.setItem('token', decodeURIComponent(cookie[1]));
          }
        }
      } catch {
        /* Storage can be disabled; session cookies still work. */
      }
      const server = await api<ServerConfig>('/api/config');
      if (version !== generation.current) return;
      setConfig(server);
      let account: User;
      try {
        account = await api<User>('/api/v1/auths/');
      } catch (reason) {
        if (reason instanceof ApiError && [401, 403].includes(reason.status)) {
          if (version === generation.current) {
            setUser(null);
            setSettings({});
            setModels([]);
          }
          return;
        }
        throw reason;
      }
      if (version !== generation.current) return;
      if (account.role === 'pending') {
        setUser(account);
        setSettings({});
        setModels([]);
        return;
      }
      const [prefs, catalog] = await Promise.all([
        api<Dict>('/api/v1/users/user/settings'),
        api<{ data: Model[] }>('/api/models'),
      ]);
      if (version !== generation.current) return;
      setUser(account);
      setSettings(prefs ?? {});
      setModels(catalog.data ?? []);
    } catch (reason) {
      if (version === generation.current) setError(errorMessage(reason));
    } finally {
      if (version === generation.current) setLoading(false);
    }
  }, []);
  useEffect(() => {
    void refresh();
    const changed = (event: StorageEvent) => {
      if (event.key === 'token') void refresh();
    };
    let checkingSession = false;
    const expired = () => {
      if (checkingSession) return;
      checkingSession = true;
      const version = generation.current;
      // Some legacy routes use 401 for an item-level permission failure. Confirm
      // the account itself expired before clearing a valid workspace session.
      void api<User>('/api/v1/auths/')
        .catch((reason) => {
          if (version !== generation.current) return;
          if (!(reason instanceof ApiError) || ![401, 403].includes(reason.status)) return;
          generation.current++;
          setUser(null);
          setSettings({});
          setModels([]);
          setLoading(false);
          setError('');
          try {
            localStorage.removeItem('token');
          } catch {
            /* Session storage may be disabled. */
          }
        })
        .finally(() => {
          checkingSession = false;
        });
    };
    window.addEventListener('storage', changed);
    window.addEventListener('studio:session-expired', expired);
    return () => {
      generation.current++;
      window.removeEventListener('storage', changed);
      window.removeEventListener('studio:session-expired', expired);
    };
  }, [refresh]);
  const signedIn = async (account: User) => {
    try {
      if (account.token) localStorage.setItem('token', account.token);
    } catch {
      /* The server also sets a session cookie. */
    }
    await refresh();
  };
  const logout = async () => {
    await api('/api/v1/auths/signout', {});
    generation.current++;
    if (user) purgeAccountDrafts(user.id);
    try {
      localStorage.removeItem('token');
    } catch {
      /* Cookies were revoked by the server. */
    }
    setUser(null);
    setModels([]);
    setSettings({});
    await clearFrameworkState();
  };
  const saveSettings = (next: Dict): Promise<void> => {
    const version = generation.current;
    const work = settingsQueue.current
      .catch(() => undefined)
      .then(async () => {
        if (version !== generation.current)
          throw new Error('Your session changed. Please try again.');
        // Preserve unknown upstream keys; updating one preference must not reset others.
        const merged = {
          ...preferences.current,
          ...next,
          ui: { ...object(preferences.current.ui), ...object(next.ui) },
        };
        const saved = await api<Dict>('/api/v1/users/user/settings/update', merged);
        if (version !== generation.current) return;
        preferences.current = saved;
        setSettings(saved);
      });
    settingsQueue.current = work;
    return work;
  };
  return (
    <Context.Provider
      value={{
        user,
        config,
        settings,
        models,
        loading,
        error,
        refresh,
        signedIn,
        logout,
        saveSettings,
      }}
    >
      {children}
    </Context.Provider>
  );
}
