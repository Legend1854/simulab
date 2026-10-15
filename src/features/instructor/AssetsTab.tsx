import { useConfirm } from '../../components/ConfirmDialog';
import { LIMITS } from '../../domain/constants';
import { addAsset, removeAsset, updateAsset } from '../../domain/configEdits';
import type { SimulationConfig } from '../../domain/types';
import { NumberField, TextField } from './fields';

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
    <section className="panel" aria-labelledby="assets-title">
      <div className="panel-section">
        <div className="section-title">
          <h2 id="assets-title">Assets</h2>
          <p>Risk rating: 0 means no modelled risk, 100 the highest. Portfolio risk is the allocation-weighted average.</p>
        </div>
        <div className="table-wrap">
          <table className="table">
            <thead>
              <tr>
                <th scope="col">ID</th>
                <th scope="col">Name</th>
                <th scope="col">Description</th>
                <th scope="col" className="num">Risk rating</th>
                <th scope="col"><span className="visually-hidden">Actions</span></th>
              </tr>
            </thead>
            <tbody>
              {config.assets.map((asset, index) => (
                <tr key={asset.id}>
                  <td><span className="code">{asset.id}</span></td>
                  <td style={{ minWidth: 180 }}><TextField hideLabel label={`Name of asset ${asset.id}`} value={asset.name} maxLength={60} error={errors[`assets[${index}].name`]} onChange={(name) => onChange(updateAsset(config, index, { name }))} /></td>
                  <td style={{ minWidth: 220 }}><TextField hideLabel label={`Description of asset ${asset.id}`} value={asset.description} maxLength={400} error={errors[`assets[${index}].description`]} onChange={(description) => onChange(updateAsset(config, index, { description }))} /></td>
                  <td style={{ minWidth: 110 }}><NumberField hideLabel label={`Risk rating of asset ${asset.id}`} value={asset.riskRating} error={errors[`assets[${index}].riskRating`]} onChange={(riskRating) => onChange(updateAsset(config, index, { riskRating }))} /></td>
                  <td>
                    <div className="row-actions">
                      <button type="button" className="btn btn-danger" disabled={!canRemove} onClick={() => remove(asset.id, asset.name)}>
                        Remove<span className="visually-hidden"> {asset.name}</span>
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <div className="row" style={{ marginTop: 16 }}>
          <button type="button" className="btn" disabled={!canAdd} onClick={() => onChange(addAsset(config))}>Add asset</button>
          <p className="hint">
            {config.assets.length} of {LIMITS.maxAssets} assets (minimum {LIMITS.minAssets}). A new asset starts with a 0% return in every scenario; set its returns on the Scenarios tab.
          </p>
        </div>
        {errors.assets && <p className="field-error">{errors.assets}</p>}
      </div>
      {dialog}
    </section>
  );
}
