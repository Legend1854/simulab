import { Icon } from '../../components/Icon';
import { updateProfile } from '../../domain/configEdits';
import type { SimulationConfig } from '../../domain/types';
import { formatNumber } from '../../utils/format';
import { fieldId, NumberField, TextField } from './fields';

interface Props {
  config: SimulationConfig;
  errors: Record<string, string>;
  onChange: (config: SimulationConfig) => void;
}

export function SettingsTab({ config, errors, onChange }: Props) {
  const { scoring } = config;
  const { weights } = scoring;
  const weightTotal = weights.performancePct + weights.riskFitPct + weights.diversificationPct;
  const weightsValid = Number.isFinite(weightTotal) && Math.abs(weightTotal - 100) < 1e-9;
  const setScoring = (patch: Partial<SimulationConfig['scoring']>) => onChange({ ...config, scoring: { ...scoring, ...patch } });
  const setWeight = (key: keyof SimulationConfig['scoring']['weights'], value: number) => setScoring({ weights: { ...weights, [key]: value } });
  const safe = (value: number) => (Number.isFinite(value) && value > 0 ? value : 0);

  return (
    <div className="stack">
      <section className="sheet" aria-labelledby="general-title">
        <div className="sheet-section sheet-head-only">
          <h2 id="general-title">Simulation</h2>
          <p className="muted small">What every student starts with. The fee is charged each round on that round's starting balance.</p>
        </div>
        <div className="sheet-section field-rows">
          <TextField layout="row" path="name" label="Simulation name" hint="Shown on the start screen and in exports." value={config.name} maxLength={60} error={errors.name} onChange={(name) => onChange({ ...config, name })} />
          <NumberField layout="row" path="startingBalance" label="Starting balance" hint="Australian dollars, greater than 0." suffix="AUD" value={config.startingBalance} error={errors.startingBalance} onChange={(startingBalance) => onChange({ ...config, startingBalance })} />
          <NumberField layout="row" path="annualFeePct" label="Annual management fee" hint="0 to 10 percent. Use 0 to match the original MarketLab workbook." suffix="%" value={config.annualFeePct} error={errors.annualFeePct} onChange={(annualFeePct) => onChange({ ...config, annualFeePct })} />
        </div>
      </section>

      <section className="sheet" aria-labelledby="scoring-title">
        <div className="sheet-section sheet-head-only">
          <h2 id="scoring-title">Score weights</h2>
          <p className="muted small">How much each component counts towards a round score. The three must total exactly 100%.</p>
        </div>
        <fieldset className="sheet-section" id={fieldId('scoring.weights')} tabIndex={-1} aria-describedby="weights-status">
          <legend className="visually-hidden">Score weights</legend>
          <div className="weights-preview" aria-hidden="true">
            <span style={{ flexGrow: safe(weights.performancePct) }}>Performance</span>
            <span style={{ flexGrow: safe(weights.riskFitPct) }}>Risk fit</span>
            <span style={{ flexGrow: safe(weights.diversificationPct) }}>Diversification</span>
          </div>
          <div className="field-rows">
            <NumberField layout="row" path="scoring.weights.performancePct" label="Performance weight" hint="Rewards net return after the fee." suffix="%" value={weights.performancePct} error={errors['scoring.weights.performancePct']} onChange={(v) => setWeight('performancePct', v)} />
            <NumberField layout="row" path="scoring.weights.riskFitPct" label="Risk-fit weight" hint="Rewards staying close to the chosen profile's target." suffix="%" value={weights.riskFitPct} error={errors['scoring.weights.riskFitPct']} onChange={(v) => setWeight('riskFitPct', v)} />
            <NumberField layout="row" path="scoring.weights.diversificationPct" label="Diversification weight" hint="Rewards spreading money across assets." suffix="%" value={weights.diversificationPct} error={errors['scoring.weights.diversificationPct']} onChange={(v) => setWeight('diversificationPct', v)} />
          </div>
          <p id="weights-status" className="weights-total" data-valid={weightsValid} role="status">
            <Icon name={weightsValid ? 'check' : 'alert'} size={16} />
            Weights total {Number.isFinite(weightTotal) ? formatNumber(weightTotal) : '?'}%{weightsValid ? '' : ' (must be exactly 100%)'}
          </p>
          {errors['scoring.weights'] && (
            <p className="field-error">
              <Icon name="alert" size={14} />
              {errors['scoring.weights']}
            </p>
          )}
        </fieldset>
      </section>

      <section className="sheet" aria-labelledby="parameters-title">
        <div className="sheet-section sheet-head-only">
          <h2 id="parameters-title">Score parameters</h2>
          <p className="muted small">
            <span className="mono">performance = clamp(base + points × net return %, 0, 100)</span>
            <br />
            <span className="mono">risk fit = clamp(100 − penalty × |portfolio risk − target|, 0, 100)</span>
          </p>
        </div>
        <div className="sheet-section field-rows">
          <NumberField layout="row" path="scoring.performanceBaseScore" label="Performance base score" hint="The score for a 0% net return. 0 to 100." value={scoring.performanceBaseScore} error={errors['scoring.performanceBaseScore']} onChange={(v) => setScoring({ performanceBaseScore: v })} />
          <NumberField layout="row" path="scoring.performancePointsPerReturnPct" label="Points per 1% net return" hint="Greater than 0, up to 20." value={scoring.performancePointsPerReturnPct} error={errors['scoring.performancePointsPerReturnPct']} onChange={(v) => setScoring({ performancePointsPerReturnPct: v })} />
          <NumberField layout="row" path="scoring.riskFitPenaltyPerRiskPoint" label="Risk-fit penalty per risk point" hint="Greater than 0, up to 10." value={scoring.riskFitPenaltyPerRiskPoint} error={errors['scoring.riskFitPenaltyPerRiskPoint']} onChange={(v) => setScoring({ riskFitPenaltyPerRiskPoint: v })} />
        </div>
      </section>

      <section className="sheet" aria-labelledby="profiles-title">
        <div className="sheet-section sheet-head-only">
          <h2 id="profiles-title">Risk profiles</h2>
          <p className="muted small">Students pick one each round. Target risk uses the same 0 to 100 scale as asset risk ratings.</p>
        </div>
        <div className="sheet-section">
          <div className="table-wrap">
            <table className="table edit-table">
              <thead>
                <tr>
                  <th scope="col">ID</th>
                  <th scope="col">Name</th>
                  <th scope="col">Description</th>
                  <th scope="col" className="num">Target risk</th>
                </tr>
              </thead>
              <tbody>
                {config.riskProfiles.map((profile, index) => (
                  <tr key={profile.id}>
                    <td><span className="ref">{profile.id}</span></td>
                    <td className="col-name"><TextField layout="cell" path={`riskProfiles[${index}].name`} label={`Name of profile ${profile.id}`} value={profile.name} maxLength={60} error={errors[`riskProfiles[${index}].name`]} onChange={(name) => onChange(updateProfile(config, index, { name }))} /></td>
                    <td className="col-text"><TextField layout="cell" path={`riskProfiles[${index}].description`} label={`Description of profile ${profile.id}`} value={profile.description} maxLength={400} error={errors[`riskProfiles[${index}].description`]} onChange={(description) => onChange(updateProfile(config, index, { description }))} /></td>
                    <td className="col-number"><NumberField layout="cell" path={`riskProfiles[${index}].targetRisk`} label={`Target risk of profile ${profile.id}`} value={profile.targetRisk} error={errors[`riskProfiles[${index}].targetRisk`]} onChange={(targetRisk) => onChange(updateProfile(config, index, { targetRisk }))} /></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <p className="hint table-note">To add or remove risk profiles, edit the RiskProfiles sheet of a workbook and import it.</p>
        </div>
      </section>
    </div>
  );
}
