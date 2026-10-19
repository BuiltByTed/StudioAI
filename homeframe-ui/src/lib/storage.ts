import { object, text } from './types';

// Additive migration: never clear or rename upstream keys. Rollback reads the same
// session and preferences. Drafts are scoped to the authenticated account.
export function migratePreferences(storage: Storage): void {
  if (storage.getItem('studio:migration') === '1') return;
  const oldTheme = storage.getItem('theme');
  if (!storage.getItem('studio:theme') && oldTheme)
    storage.setItem(
      'studio:theme',
      oldTheme === 'light' ? 'light' : oldTheme === 'system' ? 'system' : 'dark',
    );
  storage.setItem('studio:migration', '1');
}
export function readJSON<T>(key: string, fallback: T): T {
  try {
    const value = localStorage.getItem(key);
    return value ? (JSON.parse(value) as T) : fallback;
  } catch {
    return fallback;
  }
}
export function writeJSON(key: string, value: unknown): boolean {
  try {
    localStorage.setItem(key, JSON.stringify(value));
    return true;
  } catch {
    return false;
  }
}
export function draftKey(userId: string, chatId: string) {
  return `studio:draft:${userId}:${chatId || 'new'}`;
}
export function readDraft(userId: string, chatId: string): string {
  const current = readJSON<unknown>(draftKey(userId, chatId), null);
  if (typeof current === 'string') return current;
  // The upstream draft stays untouched until its replacement is sent successfully.
  let legacy: unknown = null;
  try {
    legacy = JSON.parse(
      sessionStorage.getItem(`chat-input${chatId ? `-${chatId}` : ''}`) ?? 'null',
    );
  } catch {
    /* Leave unavailable or malformed upstream data untouched. */
  }
  return typeof legacy === 'string' ? legacy : text(object(legacy).prompt);
}
export function purgeAccountDrafts(userId: string) {
  const prefix = `studio:draft:${userId}:`;
  for (const key of Object.keys(localStorage))
    if (key.startsWith(prefix)) localStorage.removeItem(key);
}
