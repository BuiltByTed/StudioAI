import { object, text, type History, type Message } from './types';

export function branch(history: History, currentId = history.currentId): Message[] {
  const result: Message[] = [];
  const visited = new Set<string>();
  let id = currentId;
  while (id && !visited.has(id)) {
    visited.add(id);
    const message = history.messages[id];
    if (!message) break;
    result.push(message);
    id = message.parentId;
  }
  return result.reverse();
}
export function normalizeHistory(value: unknown): History {
  const data = object(value);
  const history = object(data.history);
  if (history.messages && typeof history.messages === 'object')
    return {
      messages: history.messages as Record<string, Message>,
      currentId: text(history.currentId) || null,
    };
  const messages: Record<string, Message> = {};
  let previous: string | null = null;
  if (Array.isArray(data.messages))
    for (const [index, item] of data.messages.entries()) {
      const msg = object(item);
      const id = text(msg.id) || `legacy-${index}`;
      messages[id] = {
        ...msg,
        id,
        role: msg.role === 'user' || msg.role === 'system' ? msg.role : 'assistant',
        content: text(msg.content),
        parentId: previous,
        childrenIds: [],
        done: true,
      };
      if (previous) messages[previous]?.childrenIds.push(id);
      previous = id;
    }
  return { messages, currentId: previous };
}
export function latestLeaf(history: History, startId: string): string {
  const seen = new Set<string>();
  let id = startId;
  while (!seen.has(id)) {
    seen.add(id);
    const child = history.messages[id]?.childrenIds.at(-1);
    if (!child || !history.messages[child] || seen.has(child)) break;
    id = child;
  }
  return id;
}
export function outputText(message: Message): string {
  if (!message.output?.length) return message.content;
  const blocks = message.output
    .filter((item) => item.type === 'message')
    .flatMap((item) => (Array.isArray(item.content) ? item.content : []));
  const content = blocks.map((block) => text(object(block).text)).join('');
  return content || message.content;
}
export function applyCompletion(message: Message, raw: unknown): Message {
  const data = object(raw);
  const choices = Array.isArray(data.choices) ? data.choices : [];
  const delta = object(object(choices[0]).delta);
  return {
    ...message,
    content:
      typeof data.content === 'string'
        ? data.content
        : message.content +
          (text(delta.content) || text(object(object(choices[0]).message).content)),
    ...(Array.isArray(data.output) ? { output: data.output as Record<string, unknown>[] } : {}),
    ...(Array.isArray(data.sources) ? { sources: data.sources as Record<string, unknown>[] } : {}),
    ...(data.usage ? { usage: data.usage } : {}),
    ...(data.done === true ? { done: true } : {}),
    ...(data.error ? { error: data.error, done: true } : {}),
  };
}
