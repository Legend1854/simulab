/** Display formatting. Rounding happens here (and in exports), never inside the calculation engine. */

const currency = new Intl.NumberFormat('en-AU', { style: 'currency', currency: 'AUD', minimumFractionDigits: 2, maximumFractionDigits: 2 });
const currencyWhole = new Intl.NumberFormat('en-AU', { style: 'currency', currency: 'AUD', maximumFractionDigits: 0 });

export const formatCurrency = (value: number): string => currency.format(value);
export const formatCurrencyWhole = (value: number): string => currencyWhole.format(value);

/** Avoids "-0.00": values that round to zero are shown without a sign. */
function signed(text: string, value: number, showPlus: boolean): string {
  if (Number(text) === 0) return text.replace('-', '');
  return value > 0 && showPlus ? `+${text}` : text;
}

/** Decimal fraction -> percentage string, e.g. 0.0725 -> "+7.25%". */
export function formatReturn(fraction: number, digits = 2, showPlus = true): string {
  const pct = fraction * 100;
  return `${signed(pct.toFixed(digits), pct, showPlus)}%`;
}

/** Percentage points -> string, e.g. -14 -> "-14%". Shows up to `maxDigits` decimals without trailing zeros. */
export function formatPct(pct: number, maxDigits = 2, showPlus = false): string {
  const text = String(Number(pct.toFixed(maxDigits)));
  return `${signed(text, pct, showPlus)}%`;
}

export const formatScore = (score: number, digits = 1): string => score.toFixed(digits);

export const formatNumber = (value: number, maxDigits = 4): string => String(Number(value.toFixed(maxDigits)));

export function formatDateTime(iso: string): string {
  const date = new Date(iso);
  return Number.isNaN(date.getTime())
    ? 'Unknown time'
    : new Intl.DateTimeFormat('en-AU', { dateStyle: 'medium', timeStyle: 'short' }).format(date);
}

/** A word for the direction of a change, so gains and losses are never shown by colour alone. */
export const directionWord = (value: number): 'gain' | 'loss' | 'no change' => (value > 0 ? 'gain' : value < 0 ? 'loss' : 'no change');
