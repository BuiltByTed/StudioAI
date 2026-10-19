import { errorMessage } from './api';
import { items, object, text } from './types';

// SSE may split a UTF-8 character, JSON record, or CRLF across network chunks.
export async function consumeCompletion(response: Response, append: (text: string) => void) {
  if (!response.body) throw new Error('The model returned an empty response.');
  const reader = response.body.getReader(),
    decoder = new TextDecoder();
  let pending = '';
  const process = (line: string) => {
    if (!line.startsWith('data:')) return false;
    const data = line.slice(5).trim();
    if (!data) return false;
    if (data === '[DONE]') return true;
    const result = object(JSON.parse(data));
    if (result.error) throw new Error(errorMessage(result.error));
    const choice = object(items(result.choices)[0]);
    append(text(object(choice.delta).content) || text(choice.text));
    return false;
  };
  try {
    while (true) {
      const { value, done } = await reader.read();
      pending += decoder.decode(value, { stream: !done });
      const lines = pending.split(/\r?\n/);
      pending = lines.pop() ?? '';
      for (const line of lines) if (process(line)) return;
      if (done) {
        if (pending) process(pending);
        return;
      }
    }
  } finally {
    await reader.cancel().catch(() => {});
    reader.releaseLock();
  }
}
