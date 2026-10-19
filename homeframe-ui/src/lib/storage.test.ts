import { describe, expect, it } from 'vitest';
import { migratePreferences, draftKey, normalizeDraft } from './storage';
function storage(data: Record<string, string>): Storage {
  return {
    getItem: (key) => data[key] ?? null,
    setItem: (key, value) => {
      data[key] = value;
    },
    removeItem: (key) => {
      delete data[key];
    },
    clear: () => {
      throw new Error('Never clear upstream storage');
    },
    key: (index) => Object.keys(data)[index] ?? null,
    get length() {
      return Object.keys(data).length;
    },
  };
}
describe('additive browser migration', () => {
  it('is repeatable and preserves existing sessions and upstream preferences', () => {
    const state = { token: 'existing-session', theme: 'oled-dark', settings: '{"memory":false}' };
    const store = storage(state);
    migratePreferences(store);
    migratePreferences(store);
    expect(store.getItem('token')).toBe('existing-session');
    expect(store.getItem('theme')).toBe('oled-dark');
    expect(store.getItem('settings')).toBe('{"memory":false}');
    expect(store.getItem('studio:theme')).toBe('dark');
  });
  it('preserves a preference already chosen in Studio AI', () => {
    const store = storage({ theme: 'dark', 'studio:theme': 'light' });
    migratePreferences(store);
    expect(store.getItem('studio:theme')).toBe('light');
  });
  it('partitions drafts by account and conversation', () => {
    expect(draftKey('first', 'chat')).not.toBe(draftKey('second', 'chat'));
    expect(draftKey('first', '')).not.toBe(draftKey('first', 'chat'));
  });
  it('migrates full upstream drafts without restoring approval modes', () => {
    const file = { type: 'file', id: 'document', name: 'Draft.txt' };
    const draft = normalizeDraft({
      prompt: 'Keep my work',
      files: [file],
      selectedToolIds: ['search'],
      selectedSkillIds: ['writing'],
      selectedFilterIds: ['format'],
      webSearchEnabled: true,
      codeInterpreterEnabled: false,
      approvalMode: 'always',
    });
    expect(draft.prompt).toBe('Keep my work');
    expect(draft.files).toEqual([file]);
    expect(draft.selectedToolIds).toEqual(['search']);
    expect(draft.selectedSkillIds).toEqual(['writing']);
    expect(draft.selectedFilterIds).toEqual(['format']);
    expect(draft.webSearchEnabled).toBe(true);
    expect(draft.codeInterpreterEnabled).toBe(false);
    expect(draft).not.toHaveProperty('approvalMode');
  });
  it('supports previous text-only drafts and rejects malformed selections', () => {
    expect(normalizeDraft('saved text').prompt).toBe('saved text');
    const malformed = normalizeDraft({
      files: [null, 17, {}],
      selectedToolIds: [12, 'valid'],
      webSearchEnabled: 'true',
    });
    expect(malformed.files).toEqual([]);
    expect(malformed.selectedToolIds).toEqual(['valid']);
    expect(malformed.webSearchEnabled).toBeUndefined();
  });
});
