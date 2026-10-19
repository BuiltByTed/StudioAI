import { describe, expect, it } from 'vitest';
import { applyCompletion, branch, normalizeHistory, outputText } from './history';
import type { History, Message } from './types';
const message = (id: string, parentId: string | null): Message => ({
  id,
  parentId,
  childrenIds: [],
  role: 'assistant',
  content: id,
});
describe('upstream conversation compatibility', () => {
  it('keeps the selected branch and terminates on corrupt cycles', () => {
    const history: History = {
      currentId: 'answer2',
      messages: {
        user: message('user', null),
        answer1: message('answer1', 'user'),
        answer2: message('answer2', 'user'),
      },
    };
    expect(branch(history).map((item) => item.id)).toEqual(['user', 'answer2']);
    history.messages.user!.parentId = 'answer2';
    expect(branch(history)).toHaveLength(2);
  });
  it('converts old linear chats without dropping messages', () => {
    const history = normalizeHistory({
      messages: [
        { role: 'user', content: 'Question' },
        { role: 'assistant', content: 'Answer' },
      ],
    });
    expect(branch(history).map((item) => item.content)).toEqual(['Question', 'Answer']);
    expect(history.messages['legacy-0']?.childrenIds).toEqual(['legacy-1']);
  });
  it('accepts snapshot, delta, structured-output, and completion events', () => {
    let current = { ...message('a', null), content: '' };
    current = applyCompletion(current, { choices: [{ delta: { content: 'Hel' } }] });
    current = applyCompletion(current, { choices: [{ delta: { content: 'lo' } }] });
    expect(current.content).toBe('Hello');
    current = applyCompletion(current, { content: 'Hello world', done: true });
    expect(current.content).toBe('Hello world');
    expect(current.done).toBe(true);
    current = applyCompletion(current, {
      output: [{ type: 'message', content: [{ type: 'output_text', text: 'Structured answer' }] }],
    });
    expect(outputText(current)).toBe('Structured answer');
  });
});
