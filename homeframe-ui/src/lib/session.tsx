import { createContext, useCallback, useContext, useEffect, useState, type ReactNode } from 'react';
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
  const [models, setModels] = useState<Model[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const clearFrameworkState = useHomeframeLogout();
  const refresh = useCallback(async () => {
    setError('');
    setLoading(true);
    try {
      try {
        migratePreferences(localStorage);
      } catch {
        /* Storage can be disabled; session cookies still work. */
      }
      const server = await api<ServerConfig>('/api/config');
      setConfig(server);
      let account: User;
      try {
        account = await api<User>('/api/v1/auths/');
      } catch (reason) {
        if (reason instanceof ApiError && [401, 403].includes(reason.status)) {
          setUser(null);
          return;
        }
        throw reason;
      }
      setUser(account);
      const [prefs, catalog] = await Promise.all([
        api<Dict>('/api/v1/users/user/settings'),
        api<{ data: Model[] }>('/api/models'),
      ]);
      setSettings(prefs ?? {});
      setModels(catalog.data ?? []);
    } catch (reason) {
      setError(errorMessage(reason));
    } finally {
      setLoading(false);
    }
  }, []);
  useEffect(() => {
    void refresh();
  }, [refresh]);
  const signedIn = async (account: User) => {
    if (account.token) localStorage.setItem('token', account.token);
    await refresh();
  };
  const logout = async () => {
    await api('/api/v1/auths/signout', {});
    if (user) purgeAccountDrafts(user.id);
    localStorage.removeItem('token');
    setUser(null);
    setModels([]);
    setSettings({});
    await clearFrameworkState();
  };
  const saveSettings = async (next: Dict) => {
    // Preserve unknown upstream keys; updating one preference must not reset others.
    const merged = { ...settings, ...next, ui: { ...object(settings.ui), ...object(next.ui) } };
    const saved = await api<Dict>('/api/v1/users/user/settings/update', merged);
    setSettings(saved);
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
