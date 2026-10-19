import { it, expect } from 'vitest';
import { promptFields, fillPrompt } from './prompts';
it('preserves punctuation inside custom prompt options and inserts variable text literally', () => {
  const template =
    'Hello {{USER_NAME}}. {{tone|select:options=["brief: warm","long"]:required}} {{topic}}';
  expect(promptFields(template, { USER_NAME: 'Ted' })).toEqual({
    tone: { type: 'select', options: ['brief: warm', 'long'], required: true },
    topic: { type: 'text' },
  });
  expect(
    fillPrompt('Answer {{topic}} for {{USER_NAME}}', { topic: '$& is literal', USER_NAME: 'Ted' }),
  ).toBe('Answer $& is literal for Ted');
});
