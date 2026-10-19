import {
  Children,
  cloneElement,
  isValidElement,
  useId,
  useEffect,
  useRef,
  useState,
  type ReactNode,
  type ReactElement,
  type ButtonHTMLAttributes,
} from 'react';
import { AlertCircle, ArrowRight, LoaderCircle } from 'lucide-react';
import { HomeframeInput, HomeframeSelect, HomeframeTextarea, Link } from '@builtbyted/homeframe';
import { errorMessage } from '../lib/api';

export function Page({
  title,
  eyebrow,
  description,
  actions,
  children,
}: {
  title: string;
  eyebrow?: string;
  description?: string | undefined;
  actions?: ReactNode;
  children: ReactNode;
}) {
  return (
    <section className="page" data-validation-scope>
      <div className="page-heading">
        <div>
          {eyebrow && <p className="eyebrow">{eyebrow}</p>}
          <h1>{title}</h1>
          {description && <p className="muted">{description}</p>}
        </div>
        {actions && <div className="actions">{actions}</div>}
      </div>
      {children}
    </section>
  );
}
export function Busy({ label = 'Loading…' }: { label?: string }) {
  return (
    <div className="loading" role="status">
      <LoaderCircle size={20} className="spin" />
      {label}
    </div>
  );
}
export function ErrorNotice({ error, retry }: { error: string; retry?: (() => void) | undefined }) {
  return error ? (
    <div className="notice error" role="alert">
      <AlertCircle size={18} />
      <span>{error}</span>
      {retry && <button onClick={retry}>Try again</button>}
    </div>
  ) : null;
}
export function Empty({
  title,
  children,
  to,
  action,
}: {
  title: string;
  children?: ReactNode;
  to?: string;
  action?: string;
}) {
  return (
    <div className="empty">
      <h2>{title}</h2>
      {children && <p className="muted">{children}</p>}
      {to && (
        <Link className="button primary" to={to}>
          {action ?? 'Get started'}
          <ArrowRight size={16} />
        </Link>
      )}
    </div>
  );
}
export function Field({
  label,
  children,
  hint,
}: {
  label: string;
  children: ReactNode;
  hint?: string;
}) {
  const id = useId();
  const hintId = `${id}-hint`;
  return (
    <div className="field">
      <label htmlFor={id}>{label}</label>
      {Children.map(children, (child) =>
        isValidElement(child) &&
        [HomeframeInput, HomeframeTextarea, HomeframeSelect].some((type) => type === child.type)
          ? cloneElement(
              child as ReactElement<{ id: string; 'aria-describedby'?: string | undefined }>,
              { id, 'aria-describedby': hint ? hintId : undefined },
            )
          : child,
      )}
      {hint && (
        <small id={hintId} className="muted">
          {hint}
        </small>
      )}
    </div>
  );
}
export function Toggle({
  label,
  checked,
  onChange,
  hint,
  disabled,
}: {
  label: string;
  checked: boolean;
  onChange: (value: boolean) => void;
  hint?: string;
  disabled?: boolean;
}) {
  return (
    <label className="toggle-row">
      <span>
        {label}
        {hint && <small className="muted">{hint}</small>}
      </span>
      <HomeframeInput
        type="checkbox"
        role="switch"
        checked={checked}
        onChange={(event) => onChange(event.target.checked)}
        disabled={disabled}
      />
    </label>
  );
}
export function Action({
  children,
  run,
  className = '',
  disabled = false,
  ...attributes
}: Omit<ButtonHTMLAttributes<HTMLButtonElement>, 'onClick'> & {
  children: ReactNode;
  run: () => Promise<unknown>;
  className?: string;
  disabled?: boolean;
}) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  return (
    <>
      <button
        {...attributes}
        type={attributes.type ?? 'button'}
        className={className}
        disabled={disabled || busy}
        onClick={(event) => {
          if (!validateFields(event.currentTarget)) return;
          setBusy(true);
          setError('');
          void run()
            .catch((reason) => setError(errorMessage(reason)))
            .finally(() => setBusy(false));
        }}
      >
        {busy && <LoaderCircle size={16} className="spin" />}
        {children}
      </button>
      {error && <ErrorNotice error={error} />}
    </>
  );
}
export function validateFields(element: HTMLElement) {
  const invalid = element
    .closest('[data-validation-scope]')
    ?.querySelector<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>(
      'input:invalid, textarea:invalid, select:invalid',
    );
  if (invalid) {
    invalid.reportValidity();
    return false;
  }
  return true;
}
export function JSONField({
  label,
  value,
  onChange,
}: {
  label: string;
  value: unknown;
  onChange: (value: unknown) => void;
}) {
  const serialized = JSON.stringify(value ?? {}, null, 2);
  const [draft, setDraft] = useState(serialized);
  const lastValue = useRef(serialized);
  const field = useRef<HTMLTextAreaElement>(null);
  const [error, setError] = useState('');
  useEffect(() => {
    if (serialized !== lastValue.current) {
      setDraft(serialized);
      setError('');
      field.current?.setCustomValidity('');
    }
    lastValue.current = serialized;
  }, [serialized]);
  return (
    <Field label={label}>
      <HomeframeTextarea
        ref={field}
        className="code-input"
        rows={12}
        value={draft}
        aria-invalid={!!error}
        onChange={(event) => {
          setDraft(event.target.value);
          try {
            const parsed: unknown = JSON.parse(event.target.value);
            lastValue.current = JSON.stringify(parsed, null, 2);
            onChange(parsed);
            setError('');
            event.target.setCustomValidity('');
          } catch {
            setError('Enter valid JSON before saving.');
            event.target.setCustomValidity('Enter valid JSON before saving.');
          }
        }}
      />
      {error && (
        <span role="alert" className="field-error">
          {error}
        </span>
      )}
    </Field>
  );
}
