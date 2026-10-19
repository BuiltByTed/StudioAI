import { useState } from 'react';
import { HomeframeInput, HomeframeSelect, HomeframeTextarea } from '@builtbyted/homeframe';
import { useResource } from '../lib/useResource';
import { useSession } from '../lib/session';
import { items, object, text, type Resource } from '../lib/types';
import { promptFields, fillPrompt, promptBuiltins } from '../lib/prompts';
import { ErrorNotice, Field } from './ui';
export function PromptPicker({ draft, apply }: { draft: string; apply: (value: string) => void }) {
  const resource = useResource<Resource[]>('/api/v1/prompts/'),
    { user } = useSession();
  const [id, setId] = useState(''),
    [values, setValues] = useState<Record<string, string>>({});
  const selected = resource.data?.find((p) => p.id === id),
    template = selected?.content ?? '',
    builtins = promptBuiltins(user, draft),
    fields = promptFields(template, builtins);
  return (
    <div className="stack">
      <strong>Saved prompts</strong>
      <ErrorNotice error={resource.error} />
      <Field label="Saved prompt">
        <HomeframeSelect
          value={id}
          onChange={(e) => {
            setId(e.target.value);
            setValues({});
          }}
        >
          <option value="">Choose a prompt</option>
          {resource.data?.map((p) => (
            <option key={p.id} value={p.id}>
              {text(p.command)} · {p.name || p.title}
            </option>
          ))}
        </HomeframeSelect>
      </Field>
      {Object.entries(fields).map(([name, field]) => (
        <Field key={name} label={name} hint={text(field.description)}>
          {field.type === 'select' ? (
            <HomeframeSelect
              value={values[name] ?? text(field.default)}
              onChange={(e) => setValues({ ...values, [name]: e.target.value })}
            >
              <option value="">Choose</option>
              {items(field.options).map((option, index) => (
                <option key={index} value={String(option)}>
                  {String(option)}
                </option>
              ))}
            </HomeframeSelect>
          ) : field.type === 'textarea' ? (
            <HomeframeTextarea
              rows={3}
              value={values[name] ?? text(field.default)}
              onChange={(e) => setValues({ ...values, [name]: e.target.value })}
            />
          ) : (
            <HomeframeInput
              type={
                ['number', 'date', 'email', 'time'].includes(text(field.type))
                  ? text(field.type)
                  : 'text'
              }
              value={values[name] ?? text(field.default)}
              onChange={(e) => setValues({ ...values, [name]: e.target.value })}
            />
          )}
        </Field>
      ))}
      {selected && (
        <button
          type="button"
          disabled={Object.entries(fields).some(
            ([name, field]) => field.required && !text(values[name] ?? field.default).trim(),
          )}
          onClick={() => {
            const inputs = Object.fromEntries(
              Object.entries(fields).map(([name, field]) => [
                name,
                values[name] ?? text(field.default),
              ]),
            );
            apply(fillPrompt(template, { ...inputs, ...builtins }));
            setId('');
          }}
        >
          Use prompt
        </button>
      )}
    </div>
  );
}
