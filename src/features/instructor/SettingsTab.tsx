import { updateProfile } from '../../domain/configEdits';
import type { SimulationConfig } from '../../domain/types';
import { formatNumber } from '../../utils/format';
import { NumberField, TextField } from './fields';

interface Props {
  config: SimulationConfig;
  errors: Record<string, string>;
  onChange: (config: SimulationConfig) => void;
}

export function SettingsTab({ config, errors, onChange }: Props) {
  const { scoring } = config;
  const weightTotal = scoring.weights.performancePct + scoring.weights.riskFitPct + scoring.weights.diversificationPct;
  const weightsValid = Number.isFinite(weightTotal) && Math.abs(weightTotal - 100) < 1e-9;
  const setScoring = (patch: Partial<SimulationConfig['scoring']>) => onChange({ ...config, scoring: { ...scoring, ...patch } });
  const setWeight = (key: keyof SimulationConfig['scoring']['weights'], value: number) => setScoring({ weights: { ...scoring.weights, [key]: value } });

  return (
    <div className="stack">
      <section className="panel" aria-labelledby="general-title">
        <div className="panel-section">
          <div className="section-title">
            <h2 id="general-title">Simulation</h2>
            <p>The fee is charged each round on that round's starting balance.</p>
          </div>
          <div className="form-grid">
            <TextField label="Simulation name" value={config.name} maxLength={60} error={errors.name} onChange={(name) => onChange({ ...config, name })} />
            <NumberField label="Starting balance" suffix="AUD" value={config.startingBalance} error={errors.startingBalance} onChange={(startingBalance) => onChange({ ...config, startingBalance })} />
            <NumberField label="Annual management fee" suffix="%" hint="0 to 10. Use 0 to match the original MarketLab workbook." value={config.annualFeePct} error={errors.annualFeePct} onChange={(annualFeePct) => onChange({ ...config, annualFeePct })} />
          </div>
        </div>
      </section>

      <section className="panel" aria-labelledby="scoring-title">
        <div className="panel-section">
          <div className="section-title">
            <h2 id="scoring-title">Score weights</h2>
            <p className="weights-total" data-valid={weightsValid} role="status">
              <span aria-hidden="true">{weightsValid ? '✓ ' : '⚠ '}</span>
              Weights total {Number.isFinite(weightTotal) ? formatNumber(weightTotal) : '?'}%{weightsValid ? '' : ' (must be exactly 100%)'}
            </p>
          </div>
          <div className="form-grid">
            <NumberField label="Performance weight" suffix="%" value={scoring.weights.performancePct} error={errors['scoring.weights.performancePct']} onChange={(v) => setWeight('performancePct', v)} />
            <NumberField label="Risk-fit weight" suffix="%" value={scoring.weights.riskFitPct} error={errors['scoring.weights.riskFitPct']} onChange={(v) => setWeight('riskFitPct', v)} />
            <NumberField label="Diversification weight" suffix="%" value={scoring.weights.diversificationPct} error={errors['scoring.weights.diversificationPct']} onChange={(v) => setWeight('diversificationPct', v)} />
          </div>
          {errors['scoring.weights'] && <p className="field-error" style={{ marginTop: 8 }}>{errors['scoring.weights']}</p>}
        </div>
        <div className="panel-section">
          <div className="section-title">
            <h2>Score parameters</h2>
            <p>Performance = clamp(base + points × net return %, 0, 100). Risk fit = clamp(100 − penalty × distance, 0, 100).</p>
          </div>
          <div className="form-grid">
            <NumberField label="Performance base score" hint="Score at a 0% net return." value={scoring.performanceBaseScore} error={errors['scoring.performanceBaseScore']} onChange={(v) => setScoring({ performanceBaseScore: v })} />
            <NumberField label="Performance points per 1% net return" value={scoring.performancePointsPerReturnPct} error={errors['scoring.performancePointsPerReturnPct']} onChange={(v) => setScoring({ performancePointsPerReturnPct: v })} />
            <NumberField label="Risk-fit penalty per risk point" value={scoring.riskFitPenaltyPerRiskPoint} error={errors['scoring.riskFitPenaltyPerRiskPoint']} onChange={(v) => setScoring({ riskFitPenaltyPerRiskPoint: v })} />
          </div>
        </div>
      </section>

      <section className="panel" aria-labelledby="profiles-title">
        <div className="panel-section">
          <div className="section-title">
            <h2 id="profiles-title">Risk profiles</h2>
            <p>Target risk uses the same 0 to 100 scale as asset risk ratings.</p>
          </div>
          <div className="table-wrap">
            <table className="table">
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
                    <td><span className="code">{profile.id}</span></td>
                    <td><TextField hideLabel label={`Name of profile ${profile.id}`} value={profile.name} maxLength={60} error={errors[`riskProfiles[${index}].name`]} onChange={(name) => onChange(updateProfile(config, index, { name }))} /></td>
                    <td><TextField hideLabel label={`Description of profile ${profile.id}`} value={profile.description} maxLength={400} error={errors[`riskProfiles[${index}].description`]} onChange={(description) => onChange(updateProfile(config, index, { description }))} /></td>
                    <td style={{ minWidth: 110 }}><NumberField hideLabel label={`Target risk of profile ${profile.id}`} value={profile.targetRisk} error={errors[`riskProfiles[${index}].targetRisk`]} onChange={(targetRisk) => onChange(updateProfile(config, index, { targetRisk }))} /></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <p className="hint" style={{ marginTop: 8 }}>To add or remove risk profiles, edit the RiskProfiles sheet of the workbook and import it.</p>
        </div>
      </section>
    </div>
  );
}
