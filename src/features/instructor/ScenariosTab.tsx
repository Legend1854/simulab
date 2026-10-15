import { useEffect, useState } from 'react';
import { useConfirm } from '../../components/ConfirmDialog';
import { Icon } from '../../components/Icon';
import { assetColor } from '../../components/viz/assetColors';
import { LIMITS } from '../../domain/constants';
import { addScenario, moveScenario, removeScenario, updateScenario, updateScenarioReturn } from '../../domain/configEdits';
import type { SimulationConfig } from '../../domain/types';
import { fieldId, NumberField, TextField } from './fields';

interface Props {
  config: SimulationConfig;
  errors: Record<string, string>;
  onChange: (config: SimulationConfig) => void;
  /** Set by the validation summary: the path of a field to bring into view. */
  focusPath?: string | null;
}

/** A small sign marker inside a return input, so positive and negative values differ by shape too. */
function SignMarker({ value }: { value: number }) {
  if (!Number.isFinite(value) || value === 0) return <span className="sign sign-flat" aria-hidden="true" />;
  return <Icon name={value > 0 ? 'up' : 'down'} size={12} className={`sign ${value > 0 ? 'sign-gain' : 'sign-loss'}`} />;
}

export function ScenariosTab({ config, errors, onChange, focusPath }: Props) {
  const { confirm, dialog } = useConfirm();
  const [selected, setSelected] = useState(0);
  const scenario = config.scenarios[selected];

  useEffect(() => {
    if (selected >= config.scenarios.length) setSelected(Math.max(0, config.scenarios.length - 1));
  }, [config.scenarios.length, selected]);

  // When the validation summary points at a scenario's detail field, open that scenario's details.
  useEffect(() => {
    const match = focusPath ? /^scenarios\[(\d+)\]/.exec(focusPath) : null;
    if (match) setSelected(Number(match[1]));
  }, [focusPath]);

  // Messages are too long for a table cell, so cells only turn red and the full messages are listed under the table.
  const matrixErrors = Object.entries(errors).filter(([path]) => /^scenarios\[\d+\]\.(title|returnsPct)/.test(path));
  const rowErrors = (index: number) => Object.keys(errors).filter((path) => path.startsWith(`scenarios[${index}]`)).length;

  const move = (index: number, delta: -1 | 1) => {
    onChange(moveScenario(config, index, delta));
    if (selected === index) setSelected(index + delta);
    else if (selected === index + delta) setSelected(index);
  };

  const remove = async (index: number) => {
    const target = config.scenarios[index];
    const ok = await confirm({
      title: `Delete round ${index + 1}?`,
      body: `"${target?.title ?? ''}" and its returns will be removed from your unsaved changes. Later rounds move up by one.`,
      confirmLabel: 'Delete scenario',
      tone: 'danger',
    });
    if (ok) {
      onChange(removeScenario(config, index));
      setSelected(Math.max(0, Math.min(index, config.scenarios.length - 2)));
    }
  };

  return (
    <div className="stack">
      <section className="sheet" aria-labelledby="scenarios-title">
        <div className="sheet-section sheet-head-only">
          <div className="row-between">
            <h2 id="scenarios-title">Scenarios and returns</h2>
            <button
              type="button"
              className="btn btn-sm"
              disabled={config.scenarios.length >= LIMITS.maxRounds}
              onClick={() => {
                const added = addScenario(config);
                onChange(added.config);
                setSelected(added.index);
              }}
            >
              <Icon name="plus" size={14} />
              Add scenario
            </button>
          </div>
          <p className="muted small">
            One row per round, played top to bottom. Returns are percentage points from −100 to 500 (type 8 for 8%). {config.scenarios.length} of {LIMITS.maxRounds} rounds.
          </p>
        </div>
        <div className="sheet-section matrix-section">
          <p className="hint scroll-hint">The table scrolls sideways: swipe it to see every asset and the row actions.</p>
          <div className="table-wrap">
            <table className="table matrix">
              <thead>
                <tr>
                  <th scope="col" className="matrix-round">Round</th>
                  <th scope="col">Title</th>
                  {config.assets.map((asset, index) => (
                    <th scope="col" key={asset.id} className="matrix-asset">
                      <span className="swatch" style={{ background: assetColor(index) }} aria-hidden="true" />
                      {asset.name}
                    </th>
                  ))}
                  <th scope="col"><span className="visually-hidden">Order and actions</span></th>
                </tr>
              </thead>
              <tbody>
                {config.scenarios.map((item, index) => {
                  const problems = rowErrors(index);
                  return (
                    <tr key={item.id} data-selected={index === selected} id={fieldId(`scenarios[${index}].returnsPct`)} tabIndex={-1}>
                      <th scope="row" className="matrix-round">
                        <span className="round-n">{index + 1}</span>
                        {problems > 0 && <Icon name="alert" size={14} label={`${problems} ${problems === 1 ? 'problem' : 'problems'} in round ${index + 1}`} className="matrix-alert" />}
                      </th>
                      <td className="col-name">
                        <TextField layout="cell" quietError path={`scenarios[${index}].title`} label={`Round ${index + 1} title`} value={item.title} maxLength={80} error={errors[`scenarios[${index}].title`]} onChange={(title) => onChange(updateScenario(config, index, { title }))} />
                      </td>
                      {config.assets.map((asset) => {
                        const value = item.returnsPct[asset.id] ?? Number.NaN;
                        return (
                          <td key={asset.id} className="col-number">
                            <NumberField
                              layout="cell"
                              quietError
                              path={`scenarios[${index}].returnsPct.${asset.id}`}
                              label={`Round ${index + 1} ${asset.name} return`}
                              suffix="%"
                              prefix={<SignMarker value={value} />}
                              value={value}
                              error={errors[`scenarios[${index}].returnsPct.${asset.id}`]}
                              onChange={(next) => onChange(updateScenarioReturn(config, index, asset.id, next))}
                            />
                          </td>
                        );
                      })}
                      <td className="matrix-actions">
                        <div className="row-actions">
                          <button type="button" className="btn btn-sm icon-btn" aria-label={`Move round ${index + 1} up`} disabled={index === 0} onClick={() => move(index, -1)}>
                            <Icon name="chevronUp" size={16} />
                          </button>
                          <button type="button" className="btn btn-sm icon-btn" aria-label={`Move round ${index + 1} down`} disabled={index === config.scenarios.length - 1} onClick={() => move(index, 1)}>
                            <Icon name="chevronDown" size={16} />
                          </button>
                          <button type="button" className="btn btn-sm" aria-pressed={index === selected} aria-label={`Details of round ${index + 1}`} onClick={() => setSelected(index)}>
                            <Icon name="pencil" size={14} />
                            Details
                          </button>
                          <button type="button" className="btn btn-sm btn-danger icon-btn" aria-label={`Delete round ${index + 1}`} disabled={config.scenarios.length <= LIMITS.minRounds} onClick={() => remove(index)}>
                            <Icon name="trash" size={16} />
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
          {matrixErrors.length > 0 && (
            <ul className="matrix-row-errors" aria-label="Problems in the table">
              {matrixErrors.map(([path, message]) => (
                <li key={path} className="field-error">
                  <Icon name="alert" size={14} />
                  {message}
                </li>
              ))}
            </ul>
          )}
        </div>

        {scenario && (
          <div className="sheet-section scenario-details" aria-labelledby="scenario-details-title">
            <div className="row-between">
              <h3 id="scenario-details-title">Round {selected + 1} details: {scenario.title || 'Untitled'}</h3>
              <span className="muted small">
                ID <span className="ref">{scenario.id}</span>
              </span>
            </div>
            <div className="details-grid">
              <TextField path={`scenarios[${selected}].phase`} label="Phase" hint="A short label shown above the title, for example Market shock." value={scenario.phase} maxLength={80} error={errors[`scenarios[${selected}].phase`]} onChange={(phase) => onChange(updateScenario(config, selected, { phase }))} />
              <TextField multiline path={`scenarios[${selected}].description`} label="What happens in the market" value={scenario.description} maxLength={400} error={errors[`scenarios[${selected}].description`]} onChange={(description) => onChange(updateScenario(config, selected, { description }))} />
              <TextField multiline path={`scenarios[${selected}].lesson`} label="Learning focus" value={scenario.lesson} maxLength={400} error={errors[`scenarios[${selected}].lesson`]} onChange={(lesson) => onChange(updateScenario(config, selected, { lesson }))} />
            </div>
          </div>
        )}
      </section>
      {dialog}
    </div>
  );
}
