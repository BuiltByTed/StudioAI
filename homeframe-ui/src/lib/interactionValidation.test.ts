import { describe, it, expect } from 'vitest';
import { interactionError } from './interactionValidation';
describe('interactive tool answers', () => {
  it('does not acknowledge an empty custom answer or forged choice', () => {
    const data = { questions: [{ id: 'tone', options: [{ label: 'Warm' }] }] };
    expect(
      interactionError('request:user_input', data, { tone: { type: 'other', text: '  ' } }),
    ).not.toBe('');
    expect(
      interactionError('request:user_input', data, { tone: { type: 'option', option_index: 8 } }),
    ).not.toBe('');
    expect(
      interactionError('request:user_input', data, { tone: { type: 'option', option_index: 0 } }),
    ).toBe('');
  });
  it('refuses unsupported schemas and enforces array cardinality without rejecting false', () => {
    expect(
      interactionError(
        'request:elicitation',
        { requestedSchema: { properties: { nested: { type: 'object' } } } },
        {},
      ),
    ).toContain('cannot safely submit');
    const data = {
      requestedSchema: {
        required: ['choices', 'enabled'],
        properties: {
          choices: {
            type: 'array',
            items: { type: 'string', enum: ['a', 'b', 'c'] },
            minItems: 2,
            maxItems: 2,
          },
          enabled: { type: 'boolean' },
        },
      },
    };
    expect(
      interactionError('request:elicitation', data, { choices: ['a'], enabled: false }),
    ).toContain('at least 2');
    expect(
      interactionError('request:elicitation', data, { choices: ['a', 'b'], enabled: false }),
    ).toBe('');
  });
});
