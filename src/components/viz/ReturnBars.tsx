import type { Asset } from '../../domain/types';
import { formatPct } from '../../utils/format';
import { Icon } from '../Icon';
import { assetColor } from './assetColors';

interface Props {
  assets: ReadonlyArray<Asset>;
  returnsPct: Record<string, number>;
  /** Largest absolute return to scale against, so bars are comparable across rounds. */
  scalePct: number;
  caption: string;
}

/**
 * Asset returns for one scenario as a table with diverging bars around zero. The table carries the
 * numbers; bar direction and an arrow carry the sign, so colour is never the only cue.
 */
export function ReturnBars({ assets, returnsPct, scalePct, caption }: Props) {
  const scale = Math.max(scalePct, 1);
  return (
    <table className="return-table">
      <caption>{caption}</caption>
      <thead className="visually-hidden">
        <tr>
          <th scope="col">Asset</th>
          <th scope="col">Return</th>
          <th scope="col">Bar</th>
        </tr>
      </thead>
      <tbody>
        {assets.map((asset, index) => {
          const value = returnsPct[asset.id] ?? 0;
          const width = (Math.min(Math.abs(value), scale) / scale) * 50;
          const tone = value > 0 ? 'gain' : value < 0 ? 'loss' : 'flat';
          return (
            <tr key={asset.id}>
              <th scope="row">
                <span className="swatch" style={{ background: assetColor(index) }} aria-hidden="true" />
                {asset.name}
              </th>
              <td className={`return-value change-${tone}`}>
                <Icon name={value > 0 ? 'up' : value < 0 ? 'down' : 'flat'} size={12} />
                {formatPct(value, 2, true)}
              </td>
              <td className="return-track" aria-hidden="true">
                <span className={`return-bar return-bar-${tone}`} style={value >= 0 ? { left: '50%', width: `${width}%` } : { right: '50%', width: `${width}%` }} />
              </td>
            </tr>
          );
        })}
      </tbody>
    </table>
  );
}
