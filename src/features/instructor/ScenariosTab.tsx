import { useEffect, useState } from 'react';
import { useConfirm } from '../../components/ConfirmDialog';
import { LIMITS } from '../../domain/constants';
import { addScenario, moveScenario, removeScenario, updateScenario, updateScenarioReturn } from '../../domain/configEdits';
import type { SimulationConfig } from '../../domain/types';
import { formatPct } from '../../utils/format';
import { NumberField, TextField } from './fields';

interface Props {
  config: SimulationConfig;
  errors: Record<string, string>;
  onChange: (config: SimulationConfig) => void;
}

export function ScenariosTab({ config, errors, onChange }: Props) {
  const { confirm, dialog } = useConfirm();
  const [selected, setSelected] = useState(0);
  const scenario = config.scenarios[selected];

  useEffect(() => {
    if (selected >= config.scenarios.length) setSelected(Math.max(0, config.scenarios.length - 1));
  }, [config.scenarios.length, selected]);

  const rowHasError = (index: number) => Object.keys(errors).some((path) => path.startsWith(`scenarios[${index}]`));

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
      <section className="panel" aria-labelledby="scenarios-title">
        <div className="panel-section">
          <div className="section-title">
            <h2 id="scenarios-title">Scenarios and round order</h2>
            <p>Each scenario is one round, played in this order. Returns are percentage points.</p>
          </div>
          <div className="table-wrap">
            <table className="table">
              <thead>
                <tr>
                  <th scope="col">Round</th>
                  <th scope="col">Title</th>
                  {config.assets.map((asset) => (
                    <th scope="col" className="num" key={asset.id}>{asset.name}</th>
                  ))}
                  <th scope="col"><span className="visually-hidden">Actions</span></th>
                </tr>
              </thead>
              <tbody>
                {config.scenarios.map((item, index) => (
                  <tr key={item.id} data-selected={index === selected}>
                    <th scope="row">{index + 1}</th>
                    <td>
                      {item.title || <em className="muted">Untitled</em>}
                      {item.phase && <span className="muted small"> ({item.phase})</span>}
                      {rowHasError(index) && <span className="badge badge-warn" style={{ marginLeft: 8 }}>⚠ Needs attention</span>}
                    </td>
                    {config.assets.map((asset) => {
                      const value = item.returnsPct[asset.id];
                      return (
                        <td className="num" key={asset.id}>
                          {typeof value === 'number' && Number.isFinite(value) ? formatPct(value, 2, true) : '?'}
                        </td>
                      );
                    })}
                    <td>
                      <div className="row-actions">
                        <button type="button" className="btn" aria-pressed={index === selected} onClick={() => setSelected(index)}>
                          Edit<span className="visually-hidden"> round {index + 1}</span>
                        </button>
                        <button type="button" className="btn" disabled={index === 0} onClick={() => move(index, -1)}>
                          Move up<span className="visually-hidden"> round {index + 1}</span>
                        </button>
                        <button type="button" className="btn" disabled={index === config.scenarios.length - 1} onClick={() => move(index, 1)}>
                          Move down<span className="visually-hidden"> round {index + 1}</span>
                        </button>
                        <button type="button" className="btn btn-danger" disabled={config.scenarios.length <= LIMITS.minRounds} onClick={() => remove(index)}>
                          Delete<span className="visually-hidden"> round {index + 1}</span>
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <div className="row" style={{ marginTop: 16 }}>
            <button
              type="button"
              className="btn"
              disabled={config.scenarios.length >= LIMITS.maxRounds}
              onClick={() => {
                const added = addScenario(config);
                onChange(added.config);
                setSelected(added.index);
              }}
            >
              Add scenario
            </button>
            <p className="hint">{config.scenarios.length} of {LIMITS.maxRounds} rounds. New scenarios are added as the last round with 0% returns.</p>
          </div>
        </div>

        {scenario && (
          <div className="panel-section scenario-editor" aria-labelledby="scenario-editor-title">
            <div className="section-title">
              <h2 id="scenario-editor-title">Editing round {selected + 1}: {scenario.title || 'Untitled'}</h2>
              <p>ID <span className="code">{scenario.id}</span></p>
            </div>
            <div className="form-grid">
              <TextField label="Title" value={scenario.title} maxLength={80} error={errors[`scenarios[${selected}].title`]} onChange={(title) => onChange(updateScenario(config, selected, { title }))} />
              <TextField label="Phase" hint="Short label, for example Market shock." value={scenario.phase} maxLength={80} error={errors[`scenarios[${selected}].phase`]} onChange={(phase) => onChange(updateScenario(config, selected, { phase }))} />
            </div>
            <div className="form-grid" style={{ marginTop: 16 }}>
              <TextField multiline label="Description" value={scenario.description} maxLength={400} error={errors[`scenarios[${selected}].description`]} onChange={(description) => onChange(updateScenario(config, selected, { description }))} />
              <TextField multiline label="Learning focus" value={scenario.lesson} maxLength={400} error={errors[`scenarios[${selected}].lesson`]} onChange={(lesson) => onChange(updateScenario(config, selected, { lesson }))} />
            </div>
            <fieldset style={{ marginTop: 16 }}>
              <legend>Asset returns in this round (percentage points, -100 to 500)</legend>
              <div className="form-grid">
                {config.assets.map((asset) => (
                  <NumberField
                    key={asset.id}
                    label={asset.name}
                    suffix="%"
                    value={scenario.returnsPct[asset.id] ?? Number.NaN}
                    error={errors[`scenarios[${selected}].returnsPct.${asset.id}`]}
                    onChange={(value) => onChange(updateScenarioReturn(config, selected, asset.id, value))}
                  />
                ))}
              </div>
              {errors[`scenarios[${selected}].returnsPct`] && <p className="field-error" style={{ marginTop: 8 }}>{errors[`scenarios[${selected}].returnsPct`]}</p>}
            </fieldset>
          </div>
        )}
      </section>
      {dialog}
    </div>
  );
}
