import { useConfirm } from '../../components/ConfirmDialog';
import { Icon } from '../../components/Icon';
import { assetColor } from '../../components/viz/assetColors';
import { LIMITS } from '../../domain/constants';
import { addAsset, removeAsset, updateAsset } from '../../domain/configEdits';
import type { SimulationConfig } from '../../domain/types';
import { fieldId, NumberField, TextField } from './fields';

interface Props {
  config: SimulationConfig;
  errors: Record<string, string>;
  onChange: (config: SimulationConfig) => void;
}

export function AssetsTab({ config, errors, onChange }: Props) {
  const { confirm, dialog } = useConfirm();
  const canAdd = config.assets.length < LIMITS.maxAssets;
  const canRemove = config.assets.length > LIMITS.minAssets;

  const remove = async (assetId: string, name: string) => {
    const ok = await confirm({
      title: `Remove ${name || assetId}?`,
      body: `This removes the asset and its return in all ${config.scenarios.length} scenarios from your unsaved changes.`,
      confirmLabel: 'Remove asset',
      tone: 'danger',
    });
    if (ok) onChange(removeAsset(config, assetId));
  };

  return (
    <section className="sheet" aria-labelledby="assets-title">
      <div className="sheet-section sheet-head-only">
        <div className="row-between">
          <h2 id="assets-title">Assets</h2>
          <button type="button" className="btn btn-sm" disabled={!canAdd} onClick={() => onChange(addAsset(config))}>
            <Icon name="plus" size={14} />
            Add asset
          </button>
        </div>
        <p className="muted small">
          {config.assets.length} of {LIMITS.maxAssets} assets (at least {LIMITS.minAssets}). A risk rating of 0 means no modelled risk and 100 the highest; portfolio
          risk is the allocation-weighted average of these ratings. A new asset starts with a 0% return in every scenario.
        </p>
      </div>
      <div className="sheet-section">
        <div className="table-wrap" id={fieldId('assets')} tabIndex={-1}>
          <table className="table edit-table">
            <thead>
              <tr>
                <th scope="col">ID</th>
                <th scope="col">Name</th>
                <th scope="col">Description</th>
                <th scope="col" className="num">Risk rating (0 to 100)</th>
                <th scope="col"><span className="visually-hidden">Actions</span></th>
              </tr>
            </thead>
            <tbody>
              {config.assets.map((asset, index) => (
                <tr key={asset.id}>
                  <td>
                    <span className="swatch" style={{ background: assetColor(index) }} aria-hidden="true" />
                    <span className="ref">{asset.id}</span>
                  </td>
                  <td className="col-name"><TextField layout="cell" path={`assets[${index}].name`} label={`Name of asset ${asset.id}`} value={asset.name} maxLength={60} error={errors[`assets[${index}].name`]} onChange={(name) => onChange(updateAsset(config, index, { name }))} /></td>
                  <td className="col-text"><TextField layout="cell" path={`assets[${index}].description`} label={`Description of asset ${asset.id}`} value={asset.description} maxLength={400} error={errors[`assets[${index}].description`]} onChange={(description) => onChange(updateAsset(config, index, { description }))} /></td>
                  <td className="col-number">
                    <NumberField layout="cell" path={`assets[${index}].riskRating`} label={`Risk rating of asset ${asset.id}`} value={asset.riskRating} error={errors[`assets[${index}].riskRating`]} onChange={(riskRating) => onChange(updateAsset(config, index, { riskRating }))} />
                    <div className="risk-scale" aria-hidden="true">
                      <span style={{ width: `${Math.min(100, Math.max(0, Number.isFinite(asset.riskRating) ? asset.riskRating : 0))}%` }} />
                    </div>
                  </td>
                  <td>
                    <button type="button" className="btn btn-sm btn-danger" disabled={!canRemove} onClick={() => remove(asset.id, asset.name)}>
                      <Icon name="trash" size={14} />
                      Remove<span className="visually-hidden"> {asset.name}</span>
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        {errors.assets && (
          <p className="field-error">
            <Icon name="alert" size={14} />
            {errors.assets}
          </p>
        )}
      </div>
      {dialog}
    </section>
  );
}
