import { LIMITS } from '../../domain/constants';

/**
 * Each asset keeps one identity colour everywhere it appears (allocation bar, return bars, tables),
 * taken from the validated series tokens in tokens.css in a fixed order. The configuration allows at
 * most eight assets, so colours are never cycled or generated.
 */
export function assetColor(index: number): string {
  if (index < 0 || index >= LIMITS.maxAssets) throw new RangeError(`No colour for asset ${index + 1}; the limit is ${LIMITS.maxAssets}.`);
  return `var(--series-${index + 1})`;
}
