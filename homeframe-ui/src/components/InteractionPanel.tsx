import { useEffect, useState } from 'react';
import {
  HomeframeInput,
  HomeframeSelect,
  HomeframeTextarea,
  SidePanel,
} from '@builtbyted/homeframe';
import { cancelledInteraction, useChat, type Interaction } from '../lib/chat';
import { items, object, text, type Dict } from '../lib/types';
import { errorMessage } from '../lib/api';
import { ErrorNotice, Field } from './ui';
import { interactionError } from '../lib/interactionValidation';

export function InteractionPanel() {
  const { interaction, respond } = useChat();
  const cancel = () => {
    if (interaction) respond(interaction.id, cancelledInteraction(interaction.type));
  };
  return (
    <SidePanel
      open={!!interaction}
      onOpenChange={(open) => {
        if (!open) cancel();
      }}
      aria-label="Tool request"
      header={<strong>{text(interaction?.data.title) || 'Your assistant needs input'}</strong>}
    >
      {interaction && (
        <InteractionForm
          key={interaction.id}
          item={interaction}
          answer={(value) => respond(interaction.id, value)}
          cancel={cancel}
        />
      )}
    </SidePanel>
  );
}
function InteractionForm({
  item,
  answer,
  cancel,
}: {
  item: Interaction;
  answer: (value: unknown) => void;
  cancel: () => void;
}) {
  const { data, type } = item;
  const schema = object(data.requestedSchema);
  const fields = Object.entries(object(schema.properties));
  const [values, setValues] = useState<Dict>(() =>
    Object.fromEntries(fields.map(([key, field]) => [key, object(field).default])),
  );
  const [input, setInput] = useState(text(data.value));
  const [error, setError] = useState('');
  const [executing, setExecuting] = useState(false);
  const questions = items<Dict>(data.questions);
  useEffect(() => {
    const timeout = typeof data.timeout_ms === 'number' ? data.timeout_ms : 0;
    if (!timeout) return;
    const timer = setTimeout(cancel, timeout);
    return () => clearTimeout(timer);
  }, [item.id]);
  const validation = interactionError(type, data, values);
  const submit = async () => {
    if (validation) {
      setError(validation);
      return;
    }
    if (type === 'request:user_input') {
      answer({ status: 'answered', answers: values });
      return;
    }
    if (type === 'request:elicitation') {
      answer({ action: 'accept', content: values });
      return;
    }
    if (type === 'input') {
      answer(input);
      return;
    }
    if (type === 'execute') {
      setExecuting(true);
      try {
        // Compatibility with trusted workspace tools. Unlike the upstream handler,
        // arbitrary page-context JavaScript requires explicit approval here.
        const execute = new Function(`return (async () => { ${text(data.code)} })()`);
        answer(await execute());
      } catch (reason) {
        answer({ error: errorMessage(reason) });
      } finally {
        setExecuting(false);
      }
      return;
    }
    answer(true);
  };
  const url = text(data.url);
  const safeUrl = /^https?:\/\//i.test(url);
  return (
    <form
      className="page stack"
      onSubmit={(event) => {
        event.preventDefault();
        void submit().catch((reason) => setError(errorMessage(reason)));
      }}
    >
      <p>{text(data.message)}</p>
      {data.tool_call ? (
        <pre className="code-input">{JSON.stringify(data.tool_call, null, 2)}</pre>
      ) : null}
      {type === 'request:user_input' &&
        questions.map((question, index) => {
          const id = text(question.id) || String(index);
          const selected = object(values[id]);
          return (
            <fieldset key={id} className="stack">
              <legend>{text(question.question)}</legend>
              {items<Dict>(question.options).map((option, i) => (
                <label key={i} className="toggle-row">
                  <span>
                    {text(option.label)}
                    <small>{text(option.description)}</small>
                  </span>
                  <HomeframeInput
                    type="radio"
                    name={id}
                    checked={selected.type === 'option' && selected.option_index === i}
                    onChange={() =>
                      setValues((previous) => ({
                        ...previous,
                        [id]: {
                          type: 'option',
                          option_index: i,
                          label: option.label,
                          description: option.description,
                        },
                      }))
                    }
                  />
                </label>
              ))}
              {question.allow_other !== false && data.allow_other !== false && (
                <Field label="Your answer">
                  <HomeframeTextarea
                    value={text(selected.text)}
                    onChange={(event) =>
                      setValues((previous) => ({
                        ...previous,
                        [id]: { type: 'other', text: event.target.value },
                      }))
                    }
                  />
                </Field>
              )}
            </fieldset>
          );
        })}
      {type === 'request:elicitation' &&
        (data.mode === 'url' ? (
          safeUrl ? (
            <a
              href={url}
              target="_blank"
              rel="noreferrer"
              onClick={() => answer({ action: 'accept' })}
            >
              Continue with {text(data.server_name) || 'this service'}
            </a>
          ) : (
            <ErrorNotice error="The service returned an unsupported link." />
          )
        ) : (
          fields.map(([key, raw]) => {
            const field = object(raw),
              isArray = field.type === 'array',
              source = isArray ? object(field.items) : field;
            const options = Array.isArray(source.enum)
              ? source.enum.map((value, index) => ({
                  value,
                  label: Array.isArray(source.enumNames)
                    ? String(source.enumNames[index] ?? value)
                    : String(value),
                }))
              : items<Dict>(source.oneOf ?? source.anyOf).map((value) => ({
                  value: value.const,
                  label: text(value.title) || String(value.const),
                }));
            const required = Array.isArray(schema.required) && schema.required.includes(key);
            const change = (value: unknown) =>
              setValues((previous) => ({ ...previous, [key]: value }));
            if (
              !['string', 'number', 'integer', 'boolean', 'array'].includes(text(field.type)) ||
              (isArray && !options.length)
            )
              return (
                <ErrorNotice key={key} error={`Unsupported field: ${text(field.title) || key}`} />
              );
            return (
              <Field key={key} label={text(field.title) || key} hint={text(field.description)}>
                {field.type === 'boolean' ? (
                  <HomeframeSelect
                    required={required}
                    value={values[key] === undefined ? '' : String(values[key])}
                    onChange={(event) =>
                      change(event.target.value === '' ? undefined : event.target.value === 'true')
                    }
                  >
                    <option value="">Choose</option>
                    <option value="true">Yes</option>
                    <option value="false">No</option>
                  </HomeframeSelect>
                ) : options.length ? (
                  <HomeframeSelect
                    multiple={isArray}
                    required={required}
                    value={isArray ? items(values[key]).map(String) : String(values[key] ?? '')}
                    onChange={(event) =>
                      change(
                        isArray
                          ? Array.from(event.target.selectedOptions).map(
                              (option) =>
                                options.find((item) => String(item.value) === option.value)?.value,
                            )
                          : options.find((item) => String(item.value) === event.target.value)
                              ?.value,
                      )
                    }
                  >
                    {!isArray && <option value="">Choose</option>}
                    {options.map((option, i) => (
                      <option key={i} value={String(option.value)}>
                        {option.label}
                      </option>
                    ))}
                  </HomeframeSelect>
                ) : (
                  <HomeframeInput
                    required={required}
                    type={
                      field.type === 'number' || field.type === 'integer'
                        ? 'number'
                        : ['email', 'date', 'url'].includes(text(field.format))
                          ? text(field.format)
                          : 'text'
                    }
                    min={typeof field.minimum === 'number' ? field.minimum : undefined}
                    max={typeof field.maximum === 'number' ? field.maximum : undefined}
                    step={field.type === 'integer' ? 1 : 'any'}
                    minLength={typeof field.minLength === 'number' ? field.minLength : undefined}
                    maxLength={typeof field.maxLength === 'number' ? field.maxLength : undefined}
                    value={String(values[key] ?? '')}
                    onChange={(event) =>
                      change(
                        field.type === 'number' || field.type === 'integer'
                          ? event.target.value === ''
                            ? undefined
                            : Number(event.target.value)
                          : event.target.value,
                      )
                    }
                  />
                )}
              </Field>
            );
          })
        ))}
      {type === 'input' && (
        <Field label="Your response">
          <HomeframeInput
            value={input}
            placeholder={text(data.placeholder)}
            type={object(data.input).type === 'password' ? 'password' : 'text'}
            onChange={(event) => setInput(event.target.value)}
            autoFocus
          />
        </Field>
      )}
      {type === 'execute' && (
        <>
          <p>
            This workspace tool will run JavaScript with access to this page. Review the code before
            allowing it.
          </p>
          <pre className="code-input">{text(data.code)}</pre>
        </>
      )}
      <ErrorNotice error={error} />
      {validation && <small className="muted">{validation}</small>}
      <div className="actions">
        <button type="button" onClick={cancel} disabled={executing}>
          Cancel
        </button>
        <button
          className="primary"
          disabled={
            executing || !!validation || (type === 'request:elicitation' && data.mode === 'url')
          }
        >
          {type === 'confirmation' || type === 'execute' ? 'Allow' : 'Submit'}
        </button>
      </div>
    </form>
  );
}
