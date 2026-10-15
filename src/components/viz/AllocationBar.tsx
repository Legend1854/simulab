import type { Asset } from '../../domain/types';
import { formatNumber } from '../../utils/format';
import { assetColor } from './assetColors';

interface Props {
  assets: ReadonlyArray<Pick<Asset, 'id' | 'name'>>;
  /** Percentages by asset id. Non-numbers count as 0. */
  allocationPct: Record<string, number>;
  /** Show the legend with names and percentages under the bar. */
  legend?: boolean;
  size?: 'regular' | 'slim';
}

const value = (allocation: Record<string, number>, id: string): number => {
  const v = allocation[id];
  return typeof v === 'number' && Number.isFinite(v) ? Math.max(0, v) : 0;
};

/**
 * A stacked bar of the portfolio split, drawn from the actual allocation. Under 100% the remainder is
 * shown as an unallocated (hatched) segment; over 100% the bar is scaled to fit and marked as over.
 */
export function AllocationBar({ assets, allocationPct, legend = true, size = 'regular' }: Props) {
  const parts = assets.map((asset, index) => ({ asset, index, pct: value(allocationPct, asset.id) }));
  const total = parts.reduce((sum, part) => sum + part.pct, 0);
  const scale = total > 100 ? 100 / total : 1;
  const unallocated = Math.max(0, 100 - total);
  const summary = `${parts.map((part) => `${part.asset.name} ${formatNumber(part.pct, 1)}%`).join(', ')}. Total ${formatNumber(total, 1)}%${total > 100 ? `, ${formatNumber(total - 100, 1)}% over` : unallocated > 0 ? `, ${formatNumber(unallocated, 1)}% unallocated` : ''}.`;

  return (
    <div className={`alloc alloc-${size}`}>
      <div className="alloc-bar" data-over={total > 100} role="img" aria-label={`Allocation: ${summary}`}>
        {parts
          .filter((part) => part.pct > 0)
          .map((part) => (
            <span key={part.asset.id} className="alloc-segment" style={{ width: `${part.pct * scale}%`, background: assetColor(part.index) }} />
          ))}
        {unallocated > 0 && <span className="alloc-segment alloc-unallocated" style={{ width: `${unallocated}%` }} />}
      </div>
      {legend && (
        <ul className="alloc-legend" aria-hidden="true">
          {parts.map((part) => (
            <li key={part.asset.id}>
              <span className="swatch" style={{ background: assetColor(part.index) }} />
              <span className="alloc-legend-name">{part.asset.name}</span>
              <span className="num">{formatNumber(part.pct, 1)}%</span>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
