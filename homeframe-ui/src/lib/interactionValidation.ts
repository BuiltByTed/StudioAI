import { object, text, items, type Dict } from './types';
export function interactionError(type: string, data: Dict, values: Dict): string {
  if (type === 'request:user_input') {
    for (const [index, question] of items<Dict>(data.questions).entries()) {
      const selected = object(values[text(question.id) || String(index)]);
      if (selected.type === 'option') {
        if (
          !Number.isInteger(selected.option_index) ||
          !items(question.options)[Number(selected.option_index)]
        )
          return 'Choose an answer for every question.';
      } else if (
        selected.type !== 'other' ||
        !text(selected.text).trim() ||
        question.allow_other === false ||
        data.allow_other === false
      )
        return 'Choose an answer for every question.';
    }
  }
  if (type === 'request:elicitation' && data.mode !== 'url') {
    const schema = object(data.requestedSchema);
    for (const [key, raw] of Object.entries(object(schema.properties))) {
      const field = object(raw),
        value = values[key],
        required = items<string>(schema.required).includes(key);
      const source = field.type === 'array' ? object(field.items) : field;
      const choices = Array.isArray(source.enum)
        ? source.enum
        : items<Dict>(source.oneOf ?? source.anyOf).map((item) => item.const);
      if (
        !['string', 'number', 'integer', 'boolean', 'array'].includes(text(field.type)) ||
        (field.type === 'array' && !choices.length)
      )
        return 'This tool requested a field that this form cannot safely submit. Cancel the request and ask for a simpler form.';
      const absent = value === undefined || value === '' || (Array.isArray(value) && !value.length);
      if (required && absent) return `Complete ${text(field.title) || key}.`;
      if (absent) continue;
      if (field.type === 'array') {
        if (!Array.isArray(value) || value.some((v) => !choices.includes(v)))
          return `Choose valid values for ${key}.`;
        if (typeof field.minItems === 'number' && value.length < field.minItems)
          return `Choose at least ${field.minItems} values for ${key}.`;
        if (typeof field.maxItems === 'number' && value.length > field.maxItems)
          return `Choose at most ${field.maxItems} values for ${key}.`;
      } else if (choices.length && !choices.includes(value))
        return `Choose a valid value for ${key}.`;
    }
  }
  return '';
}
