import { type Dict, object, text } from './types';
// Prompt placeholder syntax is compatible with the upstream prompt editor.
function split(value: string, delimiter: string) {
  const result: string[] = [];
  let part = '',
    depth = 0,
    quoted = false,
    escaped = false;
  for (const char of value) {
    if (escaped) {
      part += char;
      escaped = false;
      continue;
    }
    if (char === '\\') {
      part += char;
      escaped = true;
      continue;
    }
    if (char === '"') quoted = !quoted;
    if (!quoted) {
      if (char === '[' || char === '{') depth++;
      if (char === ']' || char === '}') depth--;
      if (char === delimiter && depth === 0) {
        result.push(part.trim());
        part = '';
        continue;
      }
    }
    part += char;
  }
  if (part.trim()) result.push(part.trim());
  return result;
}
export function promptFields(template: string, builtins: Record<string, string> = {}) {
  const result: Record<string, Dict> = {};
  for (const match of template.matchAll(/{{\s*([^|}\s]+)\s*(?:\|\s*([^}]+))?\s*}}/g)) {
    const name = match[1]!;
    if (name in builtins) continue;
    const [type = 'text', ...props] = split(match[2] ?? 'text', ':');
    const field: Dict = { type: type.replace(/^type=/, '') };
    for (const prop of props) {
      const [key, ...parts] = split(prop, '=');
      if (!key) continue;
      const raw = parts.join('=');
      try {
        field[key] = parts.length ? JSON.parse(raw) : true;
      } catch {
        field[key] = raw;
      }
    }
    result[name] = { ...result[name], ...field };
  }
  return result;
}
export function fillPrompt(template: string, values: Record<string, string>) {
  return template.replace(
    /{{\s*([^|}\s]+)\s*(?:\|\s*([^}]+))?\s*}}/g,
    (original: string, key: string) => values[key] ?? original,
  );
}
export function promptBuiltins(
  user: Dict | null,
  content: string,
  now = new Date(),
): Record<string, string> {
  const localDate = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;
  return {
    USER_NAME: text(user?.name),
    USER_EMAIL: text(user?.email),
    USER_LOCATION: text(object(user?.info).location) || 'Unknown',
    CURRENT_DATE: localDate,
    CURRENT_TIME: now.toLocaleTimeString(),
    CURRENT_DATETIME: now.toLocaleString(),
    CURRENT_WEEKDAY: now.toLocaleDateString('en-US', { weekday: 'long' }),
    CURRENT_TIMEZONE: Intl.DateTimeFormat().resolvedOptions().timeZone,
    USER_LANGUAGE: navigator.language,
    prompt: content,
  };
}
