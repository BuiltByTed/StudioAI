import { describe, expect, it } from 'vitest';
import { migratePreferences, draftKey } from './storage';
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
});
