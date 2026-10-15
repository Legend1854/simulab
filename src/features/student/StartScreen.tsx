import { useId, useState } from 'react';
import { useAppState, useStore } from '../../app/StoreContext';
import { usePageTitle } from '../../app/usePageTitle';
import { Notice } from '../../components/Notice';
import { assetColor } from '../../components/viz/assetColors';
import { LIMITS } from '../../domain/constants';
import { formatCurrency, formatNumber, formatPct } from '../../utils/format';

const NUMBER_WORDS = ['zero', 'one', 'two', 'three', 'four', 'five', 'six', 'seven', 'eight', 'nine', 'ten', 'eleven', 'twelve'];
const inWords = (n: number): string => NUMBER_WORDS[n] ?? String(n);

export function StartScreen() {
  usePageTitle('Start the simulation');
  const { config } = useAppState();
  const store = useStore();
  const [label, setLabel] = useState('');
  const [error, setError] = useState<string | null>(null);
  const id = useId();
  const { weights } = config.scoring;

  return (
    <div className="start">
      <section className="sheet start-main" aria-labelledby="page-title">
        <div className="sheet-section">
          <h1 id="page-title" tabIndex={-1}>Start the simulation</h1>
          <p className="start-lede">
            You manage a fictional {formatCurrency(config.startingBalance)} portfolio through {inWords(config.scenarios.length)} market rounds. Each round a scenario
            arrives, you decide how to invest, and SimuLab shows exactly how your result and score were worked out.
          </p>
          <p className="start-goal">
            <strong>Your aim:</strong> a high average round score. It rewards return after fees, staying close to the risk you chose, and spreading your money.
          </p>
        </div>
        <div className="sheet-section start-split">
          <div>
            <h2>You decide, each round</h2>
            <ul>
              <li>Your <strong>risk profile</strong>, which sets the target your portfolio risk is scored against.</li>
              <li>Your <strong>allocation</strong>: whole percentages across {inWords(config.assets.length)} asset classes, totalling 100%.</li>
            </ul>
          </div>
          <div>
            <h2>The scenario sets</h2>
            <ul>
              <li>Each asset's return in each round. These are invented teaching scenarios, not forecasts or real market data.</li>
              <li>The starting balance, the annual fee and how the score is weighted.</li>
            </ul>
          </div>
        </div>
        <form
          className="sheet-section start-form"
          noValidate
          onSubmit={(event) => {
            event.preventDefault();
            const result = store.startSession(label);
            if (!result.ok) setError(result.error);
          }}
        >
          <div className="field">
            <label htmlFor={`${id}-label`}>Nickname (optional)</label>
            <input id={`${id}-label`} className="input" value={label} maxLength={LIMITS.maxLabelLength} autoComplete="off" aria-describedby={`${id}-hint`} onChange={(event) => setLabel(event.target.value)} />
            <p id={`${id}-hint`} className="hint">Shown in the instructor's session list. Use a nickname, not your real name. Up to {LIMITS.maxLabelLength} characters.</p>
          </div>
          {error && (
            <Notice tone="error" role="alert">
              {error}
            </Notice>
          )}
          <button type="submit" className="btn btn-primary btn-lg">
            Start round 1
          </button>
        </form>
      </section>

      <aside className="sheet start-facts" aria-labelledby="setup-title">
        <div className="sheet-section">
          <h2 id="setup-title">This simulation</h2>
          <p className="muted small">{config.name}</p>
          <dl className="facts">
            <div>
              <dt>Starting balance</dt>
              <dd className="num">{formatCurrency(config.startingBalance)}</dd>
            </div>
            <div>
              <dt>Annual fee</dt>
              <dd className="num">{formatPct(config.annualFeePct)}</dd>
            </div>
            <div>
              <dt>Rounds</dt>
              <dd className="num">{config.scenarios.length}</dd>
            </div>
          </dl>
        </div>
        <div className="sheet-section">
          <h3>How a round is scored</h3>
          <div className="weights-bar" role="img" aria-label={`Performance ${weights.performancePct}%, risk fit ${weights.riskFitPct}%, diversification ${weights.diversificationPct}%.`}>
            <span style={{ flexGrow: weights.performancePct }}>Performance {formatNumber(weights.performancePct)}%</span>
            <span style={{ flexGrow: weights.riskFitPct }}>Risk fit {formatNumber(weights.riskFitPct)}%</span>
            <span style={{ flexGrow: weights.diversificationPct }}>Diversification {formatNumber(weights.diversificationPct)}%</span>
          </div>
          <ul className="small start-score-list">
            <li><strong>Performance</strong>: your net return after the fee.</li>
            <li><strong>Risk fit</strong>: how close your portfolio risk is to your profile's target.</li>
            <li><strong>Diversification</strong>: how evenly your money is spread.</li>
          </ul>
        </div>
        <div className="sheet-section">
          <h3>Assets</h3>
          <ul className="asset-list small">
            {config.assets.map((asset, index) => (
              <li key={asset.id}>
                <span className="swatch" style={{ background: assetColor(index) }} aria-hidden="true" />
                {asset.name}
                <span className="muted num">risk {formatNumber(asset.riskRating)}</span>
              </li>
            ))}
          </ul>
        </div>
        <div className="sheet-section">
          <h3>Rounds</h3>
          <ol className="round-list small">
            {config.scenarios.map((scenario) => (
              <li key={scenario.id}>
                {scenario.title}
                {scenario.phase && <span className="muted"> ({scenario.phase})</span>}
              </li>
            ))}
          </ol>
        </div>
      </aside>
    </div>
  );
}
