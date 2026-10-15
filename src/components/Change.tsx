import { directionWord, formatCurrency, formatReturn } from '../utils/format';
import { Icon } from './Icon';

/** A money or percentage change shown with an arrow and a word, so it never relies on colour alone. */
export function Change({ value, kind, suffix }: { value: number; kind: 'currency' | 'fraction'; suffix?: string }) {
  const word = directionWord(value);
  const text = kind === 'currency' ? formatCurrency(Math.abs(value)) : formatReturn(Math.abs(value), 2, false);
  const tone = value > 0 ? 'change-gain' : value < 0 ? 'change-loss' : 'change-flat';
  return (
    <span className={`change ${tone}`}>
      <Icon name={value > 0 ? 'up' : value < 0 ? 'down' : 'flat'} size={14} />
      {word === 'no change' ? 'No change' : `${text} ${word}`}
      {suffix ? ` ${suffix}` : ''}
    </span>
  );
}
