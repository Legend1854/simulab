import { directionWord, formatCurrency, formatReturn } from '../utils/format';

/** A money or percentage change shown with a symbol and a word, so it never relies on colour alone. */
export function Change({ value, kind, suffix }: { value: number; kind: 'currency' | 'fraction'; suffix?: string }) {
  const word = directionWord(value);
  const symbol = value > 0 ? '▲' : value < 0 ? '▼' : '■';
  const text = kind === 'currency' ? formatCurrency(Math.abs(value)) : formatReturn(Math.abs(value), 2, false);
  const tone = value > 0 ? 'change-gain' : value < 0 ? 'change-loss' : 'change-flat';
  return (
    <span className={`change ${tone} num`}>
      <span aria-hidden="true">{symbol} </span>
      {word === 'no change' ? 'No change' : `${text} ${word}`}
      {suffix ? ` ${suffix}` : ''}
    </span>
  );
}
