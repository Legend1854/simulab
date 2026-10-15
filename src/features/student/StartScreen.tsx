import { useId, useState } from 'react';
import { useAppState, useStore } from '../../app/StoreContext';
import { usePageTitle } from '../../app/usePageTitle';
import { Notice } from '../../components/Notice';
import { LIMITS } from '../../domain/constants';
import { formatCurrency, formatPct } from '../../utils/format';

export function StartScreen() {
  usePageTitle('Start the simulation');
  const { config } = useAppState();
  const store = useStore();
  const [label, setLabel] = useState('');
  const [error, setError] = useState<string | null>(null);
  const id = useId();

  return (
    <div className="sim-grid">
      <section className="panel panel-body stack" aria-labelledby="page-title">
        <h1 id="page-title" tabIndex={-1}>Start the simulation</h1>
        <p className="muted">
          You will make {config.scenarios.length} decisions, one per market round. Each round you choose a risk profile and split your portfolio
          across {config.assets.length} asset classes, then see exactly how the result and your score were calculated.
        </p>
        <form
          className="stack"
          noValidate
          onSubmit={(event) => {
            event.preventDefault();
            const result = store.startSession(label);
            if (!result.ok) setError(result.error);
          }}
        >
          <div className="field">
            <label htmlFor={`${id}-label`}>Nickname (optional)</label>
            <input
              id={`${id}-label`}
              className="input"
              value={label}
              maxLength={LIMITS.maxLabelLength}
              autoComplete="off"
              aria-describedby={`${id}-hint`}
              onChange={(event) => setLabel(event.target.value)}
            />
            <p id={`${id}-hint`} className="hint">
              Shown in the instructor's session list. Use a nickname, not your real name. Up to {LIMITS.maxLabelLength} characters.
            </p>
          </div>
          {error && <Notice tone="error" role="alert">{error}</Notice>}
          <button type="submit" className="btn btn-primary btn-large">Start round 1</button>
        </form>
      </section>
      <section className="panel" aria-labelledby="setup-title">
        <div className="panel-section">
          <h2 id="setup-title">This simulation</h2>
          <p className="muted small" style={{ marginTop: 4 }}>{config.name}</p>
        </div>
        <div className="panel-section">
          <dl className="outcome-figures">
            <div><dt>Starting balance</dt><dd className="num">{formatCurrency(config.startingBalance)}</dd></div>
            <div><dt>Annual management fee</dt><dd className="num">{formatPct(config.annualFeePct)}</dd></div>
          </dl>
        </div>
        <div className="panel-section">
          <h3>How each round is scored</h3>
          <ul className="small" style={{ margin: '8px 0 0', paddingLeft: '1.1em', color: 'var(--ink-2)' }}>
            <li><strong>Performance</strong> ({config.scoring.weights.performancePct}%): your net return after the fee.</li>
            <li><strong>Risk fit</strong> ({config.scoring.weights.riskFitPct}%): how close your portfolio risk is to your chosen profile's target.</li>
            <li><strong>Diversification</strong> ({config.scoring.weights.diversificationPct}%): how evenly your money is spread.</li>
          </ul>
        </div>
        <div className="panel-section">
          <h3>Rounds</h3>
          <ol className="small" style={{ margin: '8px 0 0', paddingLeft: '1.3em', color: 'var(--ink-2)' }}>
            {config.scenarios.map((scenario) => (
              <li key={scenario.id}>{scenario.title}</li>
            ))}
          </ol>
        </div>
      </section>
    </div>
  );
}
