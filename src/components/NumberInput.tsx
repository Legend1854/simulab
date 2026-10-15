import { useEffect, useState, type InputHTMLAttributes } from 'react';

type Props = Omit<InputHTMLAttributes<HTMLInputElement>, 'value' | 'onChange' | 'type'> & {
  value: number;
  /** Receives NaN when the text is empty or not a number, so validation can report it. */
  onValueChange: (value: number) => void;
};

export function parseNumber(text: string): number {
  const trimmed = text.trim();
  return trimmed === '' ? Number.NaN : Number(trimmed);
}

const display = (value: number): string => (Number.isFinite(value) ? String(value) : '');

/**
 * A numeric input that keeps the user's text while they type (so "-", "" or "1." are allowed mid-edit)
 * and reports the parsed number upwards. Invalid text becomes NaN and is caught by validation.
 */
export function NumberInput({ value, onValueChange, className, ...rest }: Props) {
  const [text, setText] = useState(display(value));

  useEffect(() => {
    // Resync when the value changes from outside (e.g. "Discard changes"), but not while it matches.
    setText((current) => (Object.is(parseNumber(current), value) || (Number.isNaN(value) && Number.isNaN(parseNumber(current))) ? current : display(value)));
  }, [value]);

  return (
    <input
      {...rest}
      type="text"
      inputMode="decimal"
      autoComplete="off"
      className={`input input-num ${className ?? ''}`}
      value={text}
      onChange={(event) => {
        setText(event.target.value);
        onValueChange(parseNumber(event.target.value));
      }}
    />
  );
}
