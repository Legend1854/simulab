import { useId, type ReactNode } from 'react';
import { Icon } from '../../components/Icon';
import { NumberInput } from '../../components/NumberInput';

/**
 * Element id for the input that edits a configuration path such as `scenarios[1].returnsPct.cash`.
 * The validation summary uses the same function to jump to the field that needs attention.
 */
export const fieldId = (path: string): string => `field-${path.replace(/[^a-zA-Z0-9]+/g, '-').replace(/-+$/, '')}`;

type Layout =
  /** Label above the control (forms). */
  | 'stacked'
  /** Label and hint in a left column, control on the right (settings lists). */
  | 'row'
  /** Inside a table cell: the column header gives context, the label is for assistive technology only. */
  | 'cell';

interface BaseProps {
  label: string;
  /** Model path of the value, used for the element id. */
  path?: string;
  error?: string | undefined;
  hint?: ReactNode;
  layout?: Layout;
  /** Keep the message for assistive technology but not on screen, when the surrounding view lists it instead (the scenario matrix). */
  quietError?: boolean;
}

function useIds(path: string | undefined) {
  const generated = useId();
  const id = path ? fieldId(path) : generated;
  return { id, hintId: `${id}-hint`, errorId: `${id}-error` };
}

function Message({ id, error, quiet = false }: { id: string; error: string; quiet?: boolean | undefined }) {
  if (quiet) return <span id={id} className="visually-hidden">{error}</span>;
  return (
    <p id={id} className="field-error">
      <Icon name="alert" size={14} />
      {error}
    </p>
  );
}

function Frame({ layout, id, label, hint, hintId, error, errorId, quietError, children }: { layout: Layout; id: string; label: string; hint?: ReactNode; hintId: string; error?: string | undefined; errorId: string; quietError?: boolean | undefined; children: ReactNode }) {
  if (layout === 'row') {
    return (
      <div className="field-row" data-invalid={error ? 'true' : undefined}>
        <div className="field-row-label">
          <label htmlFor={id}>{label}</label>
          {hint && <p id={hintId} className="hint">{hint}</p>}
        </div>
        <div className="field-row-control">
          {children}
          {error && <Message id={errorId} error={error} />}
        </div>
      </div>
    );
  }
  return (
    <div className="field">
      <label htmlFor={id} className={layout === 'cell' ? 'visually-hidden' : undefined}>{label}</label>
      {children}
      {hint && <p id={hintId} className="hint">{hint}</p>}
      {error && <Message id={errorId} error={error} quiet={quietError} />}
    </div>
  );
}

export function TextField({ label, path, value, onChange, error, hint, maxLength, multiline, layout = 'stacked', quietError }: BaseProps & { value: string; onChange: (value: string) => void; maxLength?: number; multiline?: boolean }) {
  const { id, hintId, errorId } = useIds(path);
  const describedBy = [error ? errorId : '', hint ? hintId : ''].filter(Boolean).join(' ') || undefined;
  const common = { id, value, maxLength, 'aria-invalid': error ? ('true' as const) : ('false' as const), 'aria-describedby': describedBy };
  return (
    <Frame layout={layout} id={id} label={label} hint={hint} hintId={hintId} error={error} errorId={errorId} quietError={quietError}>
      {multiline ? (
        <textarea {...common} className="textarea" onChange={(event) => onChange(event.target.value)} />
      ) : (
        <input {...common} className="input" onChange={(event) => onChange(event.target.value)} />
      )}
    </Frame>
  );
}

export function NumberField({ label, path, value, onChange, error, hint, suffix, prefix, layout = 'stacked', quietError }: BaseProps & { value: number; onChange: (value: number) => void; suffix?: string; prefix?: ReactNode }) {
  const { id, hintId, errorId } = useIds(path);
  const describedBy = [error ? errorId : '', hint ? hintId : ''].filter(Boolean).join(' ') || undefined;
  return (
    <Frame layout={layout} id={id} label={label} hint={hint} hintId={hintId} error={error} errorId={errorId} quietError={quietError}>
      <div className="input-affix">
        {prefix}
        <NumberInput id={id} value={value} onValueChange={onChange} aria-invalid={error ? 'true' : 'false'} aria-describedby={describedBy} />
        {suffix && <span className="affix" aria-hidden="true">{suffix}</span>}
      </div>
    </Frame>
  );
}
