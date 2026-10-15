import { useId } from 'react';
import { Icon } from '../../components/Icon';
import { parseNumber } from '../../components/NumberInput';
import { Notice } from '../../components/Notice';
import { AllocationBar } from '../../components/viz/AllocationBar';
import { assetColor } from '../../components/viz/assetColors';
import type { RoundOutcome, SimulationConfig } from '../../domain/types';
import type { AllocationValidation } from '../../domain/validation';
import { formatCurrency, formatNumber, formatScore } from '../../utils/format';

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
  const allocation = Object.fromEntries(Object.entries(texts).map(([id, text]) => [id, parseNumber(text)]));

  return (
    <form
      className="sheet decision"
      noValidate
      aria-labelledby={`${baseId}-title`}
      onSubmit={(event) => {
        event.preventDefault();
        props.onSubmit();
      }}
    >
      <div className="sheet-section">
        <h2 id={`${baseId}-title`}>Your decision for round {round}</h2>
        <p className="muted small">You choose two things each round. Everything else (returns, fee, scoring) is set by the scenario.</p>
      </div>

      <fieldset className="sheet-section">
        <legend className="decision-legend">
          <span className="decision-step" aria-hidden="true">1</span>
          Risk profile
        </legend>
        <p className="hint decision-hint">Sets the target your portfolio risk is scored against. Asset risk ratings run from 0 (none) to 100.</p>
        <div className="profile-options">
          {config.riskProfiles.map((profile) => (
            <label key={profile.id} className="profile-option">
              <input type="radio" name={`${baseId}-profile`} value={profile.id} checked={riskProfileId === profile.id} onChange={() => props.onProfileChange(profile.id)} />
              <span className="profile-name">{profile.name}</span>
              <span className="profile-target num">Target risk {formatNumber(profile.targetRisk)}</span>
              {profile.description && <span className="profile-desc">{profile.description}</span>}
            </label>
          ))}
        </div>
      </fieldset>

      <fieldset className="sheet-section">
        <legend className="decision-legend">
          <span className="decision-step" aria-hidden="true">2</span>
          Allocation
        </legend>
        <p className="hint decision-hint">Whole percentages from 0 to 100, typed or set with the slider. Together they must total exactly 100%.</p>
        <div className="alloc-list">
          {config.assets.map((asset, index) => {
            const inputId = `${baseId}-${asset.id}`;
            const errorId = `${inputId}-error`;
            const descId = `${inputId}-desc`;
            const fieldError = check.fieldErrors[asset.id];
            const parsed = parseNumber(texts[asset.id] ?? '');
            const sliderValue = Number.isFinite(parsed) ? Math.min(100, Math.max(0, Math.round(parsed))) : 0;
            return (
              <div className="alloc-row" key={asset.id} data-invalid={fieldError ? 'true' : undefined}>
                <div className="alloc-name">
                  <span className="swatch" style={{ background: assetColor(index) }} aria-hidden="true" />
                  <div>
                    <label htmlFor={inputId}>{asset.name}</label>
                    <span id={descId} className="alloc-desc">
                      {asset.description ? `${asset.description} ` : ''}Risk {formatNumber(asset.riskRating)}.
                    </span>
                  </div>
                </div>
                <input
                  type="range"
                  className="alloc-slider"
                  min={0}
                  max={100}
                  step={1}
                  value={sliderValue}
                  aria-label={`${asset.name} slider`}
                  aria-describedby={descId}
                  onChange={(event) => props.onTextChange(asset.id, event.target.value)}
                />
                <div className="input-affix alloc-input">
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
                {fieldError && (
                  <p id={errorId} className="field-error">
                    <Icon name="alert" size={14} />
                    {fieldError}
                  </p>
                )}
              </div>
            );
          })}
        </div>

        <div className="alloc-summary">
          <div className="alloc-summary-head">
            <span className="small">Your mix</span>
            <span className={`alloc-total num ${check.valid ? 'is-valid' : total > 100 ? 'is-over' : 'is-under'}`}>{formatNumber(total, 1)}% of 100%</span>
          </div>
          <AllocationBar assets={config.assets} allocationPct={allocation} legend={false} />
          <p className="total-status" data-valid={check.valid} role="status" aria-live="polite">
            <Icon name={check.valid ? 'check' : 'alert'} size={16} />
            {check.message}
          </p>
        </div>
      </fieldset>

      <div className="sheet-section submit-area">
        {error && (
          <Notice tone="error" role="alert" title="This round was not submitted">
            {error}
          </Notice>
        )}
        {projection && (
          <p className="submit-projection small" data-testid="projection-summary">
            <span className="pill pill-ochre">Projection</span>
            <span>
              Ending balance <strong className="num">{formatCurrency(projection.endingBalance)}</strong>, round score{' '}
              <strong className="num">{formatScore(projection.scores.overall)}</strong>. Not recorded until you submit.
            </span>
          </p>
        )}
        <button type="submit" className="btn btn-primary btn-lg btn-block" disabled={!check.valid || submitting}>
          {submitting ? 'Submitting…' : `Submit round ${round}`}
        </button>
        <p className="hint">{check.valid ? 'Submitting records this decision permanently and calculates the result.' : 'You can submit once your allocation is valid and totals 100%.'}</p>
      </div>
    </form>
  );
}
