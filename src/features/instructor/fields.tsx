import { useId, type ReactNode } from 'react';
import { NumberInput } from '../../components/NumberInput';

interface BaseProps {
  label: string;
  error?: string | undefined;
  hint?: ReactNode;
  /** Hide the visible label (inside tables where the column header labels the input). */
  hideLabel?: boolean;
}

export function TextField({ label, value, onChange, error, hint, maxLength, multiline, hideLabel }: BaseProps & { value: string; onChange: (value: string) => void; maxLength?: number; multiline?: boolean }) {
  const id = useId();
  const describedBy = [error ? `${id}-error` : '', hint ? `${id}-hint` : ''].filter(Boolean).join(' ') || undefined;
  const common = {
    id,
    value,
    maxLength,
    'aria-invalid': error ? ('true' as const) : ('false' as const),
    'aria-describedby': describedBy,
  };
  return (
    <div className="field">
      <label htmlFor={id} className={hideLabel ? 'visually-hidden' : undefined}>{label}</label>
      {multiline ? (
        <textarea {...common} className="textarea" onChange={(event) => onChange(event.target.value)} />
      ) : (
        <input {...common} className="input" onChange={(event) => onChange(event.target.value)} />
      )}
      {hint && <p id={`${id}-hint`} className="hint">{hint}</p>}
      {error && <p id={`${id}-error`} className="field-error">{error}</p>}
    </div>
  );
}

export function NumberField({ label, value, onChange, error, hint, suffix, hideLabel }: BaseProps & { value: number; onChange: (value: number) => void; suffix?: string }) {
  const id = useId();
  const describedBy = [error ? `${id}-error` : '', hint ? `${id}-hint` : ''].filter(Boolean).join(' ') || undefined;
  return (
    <div className="field">
      <label htmlFor={id} className={hideLabel ? 'visually-hidden' : undefined}>{label}</label>
      <div className="input-affix">
        <NumberInput id={id} value={value} onValueChange={onChange} aria-invalid={error ? 'true' : 'false'} aria-describedby={describedBy} />
        {suffix && <span className="affix" aria-hidden="true">{suffix}</span>}
      </div>
      {hint && <p id={`${id}-hint`} className="hint">{hint}</p>}
      {error && <p id={`${id}-error`} className="field-error">{error}</p>}
    </div>
  );
}
