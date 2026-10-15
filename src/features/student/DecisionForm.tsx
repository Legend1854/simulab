import { useId } from 'react';
import type { AllocationValidation } from '../../domain/validation';
import type { RoundOutcome, SimulationConfig } from '../../domain/types';
import { formatCurrency, formatScore } from '../../utils/format';
import { parseNumber } from '../../components/NumberInput';
import { Notice } from '../../components/Notice';

interface Props {
  config: SimulationConfig;
  round: number;
  texts: Record<string, string>;
  riskProfileId: string;
  check: AllocationValidation;
  submitting: boolean;
  error: string | null;
  /** Live projection for the current draft, or null while the draft is invalid. */
  projection: RoundOutcome | null;
  onTextChange: (assetId: string, text: string) => void;
  onProfileChange: (profileId: string) => void;
  onSubmit: () => void;
}

export function DecisionForm(props: Props) {
  const { config, round, texts, riskProfileId, check, submitting, error, projection } = props;
  const baseId = useId();
  const total = Number.isFinite(check.total) ? check.total : 0;
  const over = total > 100;

  return (
    <form
      className="panel panel-body"
      noValidate
      aria-labelledby={`${baseId}-title`}
      onSubmit={(event) => {
        event.preventDefault();
        props.onSubmit();
      }}
    >
      <h2 id={`${baseId}-title`}>Your decision for round {round}</h2>

      <fieldset style={{ marginTop: 16 }}>
        <legend>Risk profile</legend>
        <div className="profile-options">
          {config.riskProfiles.map((profile) => (
            <label key={profile.id} className="profile-option">
              <input
                type="radio"
                name={`${baseId}-profile`}
                value={profile.id}
                checked={riskProfileId === profile.id}
                onChange={() => props.onProfileChange(profile.id)}
              />
              <strong>{profile.name}</strong>
              <span>Target risk {profile.targetRisk}. {profile.description}</span>
            </label>
          ))}
        </div>
      </fieldset>

      <fieldset style={{ marginTop: 24 }}>
        <legend>Allocation</legend>
        <p className="hint">Whole percentages from 0 to 100. Together they must total exactly 100%.</p>
        <div className="alloc-list">
          {config.assets.map((asset) => {
            const inputId = `${baseId}-${asset.id}`;
            const errorId = `${inputId}-error`;
            const descId = `${inputId}-desc`;
            const fieldError = check.fieldErrors[asset.id];
            const parsed = parseNumber(texts[asset.id] ?? '');
            const sliderValue = Number.isFinite(parsed) ? Math.min(100, Math.max(0, Math.round(parsed))) : 0;
            return (
              <div className="alloc-row" key={asset.id}>
                <div className="alloc-name">
                  <label htmlFor={inputId}>{asset.name}</label>
                  <span id={descId}>{asset.description} Risk rating {asset.riskRating}.</span>
                </div>
                <input
                  type="range"
                  min={0}
                  max={100}
                  step={1}
                  value={sliderValue}
                  aria-label={`${asset.name} slider`}
                  aria-describedby={descId}
                  onChange={(event) => props.onTextChange(asset.id, event.target.value)}
                />
                <div className="input-affix">
                  <input
                    id={inputId}
                    className="input input-num"
                    type="text"
                    inputMode="numeric"
                    autoComplete="off"
                    value={texts[asset.id] ?? ''}
                    aria-invalid={fieldError ? 'true' : 'false'}
                    aria-describedby={fieldError ? `${errorId} ${descId}` : descId}
                    onChange={(event) => props.onTextChange(asset.id, event.target.value)}
                  />
                  <span className="affix" aria-hidden="true">%</span>
                </div>
                {fieldError && <p id={errorId} className="field-error">{fieldError}</p>}
              </div>
            );
          })}
        </div>
      </fieldset>

      <div className="total-meter">
        <div className="total-line">
          <span>Total allocated</span>
          <strong>{Number.isInteger(total) ? total : total.toFixed(1)}%</strong>
        </div>
        <div className="meter" data-over={over} aria-hidden="true">
          <div className="meter-fill" style={{ width: `${Math.min(100, Math.max(0, total))}%` }} />
        </div>
        <p className="total-status" data-valid={check.valid} role="status" aria-live="polite">
          <span aria-hidden="true">{check.valid ? '✓ ' : '⚠ '}</span>
          {check.message}
        </p>
      </div>

      <div className="submit-area">
        {error && <Notice tone="error" role="alert" title="This round was not submitted">{error}</Notice>}
        {projection && (
          <p className="small" data-testid="projection-summary">
            <span className="badge badge-warn">Projection</span>{' '}
            Ending balance <strong className="num">{formatCurrency(projection.endingBalance)}</strong>, round score{' '}
            <strong className="num">{formatScore(projection.scores.overall)}</strong>. Not recorded until you submit.
          </p>
        )}
        <button type="submit" className="btn btn-primary btn-large btn-block" disabled={!check.valid || submitting}>
          {submitting ? 'Submitting…' : `Submit round ${round}`}
        </button>
        <p className="hint">
          {check.valid ? 'Submitting records this decision permanently and calculates the result.' : 'You can submit once your allocation is valid and totals 100%.'}
        </p>
      </div>
    </form>
  );
}
