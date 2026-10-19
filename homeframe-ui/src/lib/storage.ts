import { object, text, type Attachment } from './types';

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
export const parametersKey = (userId: string, folderId: string) =>
  `studio:chat-params:${userId}:${folderId || 'new'}`;
export interface Draft {
  prompt: string;
  files: Attachment[];
  selectedToolIds: string[];
  selectedSkillIds: string[];
  selectedFilterIds: string[];
  webSearchEnabled?: boolean;
  imageGenerationEnabled?: boolean;
  codeInterpreterEnabled?: boolean;
}
export const emptyDraft = (): Draft => ({
  prompt: '',
  files: [],
  selectedToolIds: [],
  selectedSkillIds: [],
  selectedFilterIds: [],
});
const strings = (value: unknown) =>
  Array.isArray(value) ? value.filter((item): item is string => typeof item === 'string') : [];
export function normalizeDraft(value: unknown): Draft {
  const data = typeof value === 'string' ? { prompt: value } : object(value);
  const result: Draft = {
    ...emptyDraft(),
    prompt: text(data.prompt),
    files: Array.isArray(data.files)
      ? data.files.filter((file): file is Attachment => typeof object(file).type === 'string')
      : [],
    selectedToolIds: strings(data.selectedToolIds),
    selectedSkillIds: strings(data.selectedSkillIds),
    selectedFilterIds: strings(data.selectedFilterIds),
  };
  for (const key of [
    'webSearchEnabled',
    'imageGenerationEnabled',
    'codeInterpreterEnabled',
  ] as const)
    if (typeof data[key] === 'boolean') result[key] = data[key];
  // Do not restore tool approval modes from untrusted old draft state.
  return result;
}
const legacyKey = (chatId: string) => `chat-input${chatId ? `-${chatId}` : ''}`;
export function readDraft(userId: string, chatId: string): Draft {
  try {
    const current = localStorage.getItem(draftKey(userId, chatId));
    if (current !== null) return normalizeDraft(JSON.parse(current));
    const owner = sessionStorage.getItem('studio:legacy-draft-owner');
    if (owner && owner !== userId) return emptyDraft();
    sessionStorage.setItem('studio:legacy-draft-owner', userId);
    return normalizeDraft(JSON.parse(sessionStorage.getItem(legacyKey(chatId)) ?? 'null'));
  } catch {
    return emptyDraft();
  }
}
export function saveDraft(userId: string, chatId: string, draft: Draft): boolean {
  const saved = writeJSON(draftKey(userId, chatId), draft);
  // Mirror the upstream shape so an immediate rollback keeps unsent work.
  try {
    sessionStorage.setItem('studio:legacy-draft-owner', userId);
    sessionStorage.setItem(legacyKey(chatId), JSON.stringify(draft));
  } catch {
    /* The account-scoped durable draft is the primary copy. */
  }
  return saved;
}
export function purgeAccountDrafts(userId: string) {
  const prefix = `studio:draft:${userId}:`;
  try {
    for (const key of Object.keys(localStorage))
      if (key.startsWith(prefix) || key.startsWith(`studio:chat-params:${userId}:`))
        localStorage.removeItem(key);
    localStorage.removeItem(`studio:images:${userId}`);
    for (const key of Object.keys(sessionStorage))
      if (key === 'chat-input' || key.startsWith('chat-input-')) sessionStorage.removeItem(key);
    sessionStorage.removeItem('studio:legacy-draft-owner');
  } catch {
    /* Storage may be disabled. */
  }
}
