import { useStore } from '../../app/StoreContext';
import { usePageTitle } from '../../app/usePageTitle';
import { Change } from '../../components/Change';
import { sessionStats } from '../../domain/progression';
import type { SimulationSession } from '../../domain/types';
import { sessionsToCsv } from '../../services/exports/csv';
import { downloadCsv, safeFilename } from '../../services/exports/download';
import { formatCurrency, formatScore } from '../../utils/format';
import { BalanceChart } from './BalanceChart';
import { RoundLedger } from './RoundLedger';

export function ResultsScreen({ session }: { session: SimulationSession }) {
  usePageTitle('Final results');
  const store = useStore();
  const stats = sessionStats(session);
  const { weights } = session.config.scoring;
  const components = stats.averageComponents;

  const exportCsv = () => {
    const name = safeFilename(session.participantLabel, 'simulab');
    downloadCsv(sessionsToCsv([session]), `${name}-results.csv`);
  };

  return (
    <div className="stack">
      <section className="panel panel-body stack" aria-labelledby="page-title">
        <div className="results-hero">
          <div>
            <p className="scenario-kicker">Simulation complete{session.participantLabel ? `: ${session.participantLabel}` : ''}</p>
            <h1 id="page-title" tabIndex={-1} className="visually-hidden">Final results</h1>
            <p className="rating">{stats.rating}</p>
            <p className="muted" style={{ marginTop: 8 }}>
              Rating bands by average round score: Strategic thinker 85 and above, Steady decision-maker 70 to 84.9, Developing investor 55 to 69.9, Learning in progress below 55.
            </p>
          </div>
          <div className="row">
            <button type="button" className="btn" onClick={exportCsv}>Export my results (CSV)</button>
            <button type="button" className="btn btn-primary" onClick={() => store.closeActiveSession()}>Start a new simulation</button>
          </div>
        </div>
        <dl className="results-figures">
          <div className="stat">
            <dt>Final balance</dt>
            <dd>{formatCurrency(stats.currentBalance)}</dd>
          </div>
          <div className="stat">
            <dt>Total return</dt>
            <dd><Change value={stats.totalReturn} kind="fraction" /></dd>
          </div>
          <div className="stat">
            <dt>Average round score</dt>
            <dd>{stats.averageScore === null ? 'Not available' : `${formatScore(stats.averageScore)} / 100`}</dd>
          </div>
          <div className="stat">
            <dt>Rounds completed</dt>
            <dd>{stats.roundsCompleted} of {stats.totalRounds}</dd>
          </div>
        </dl>
      </section>

      <div className="sim-grid">
        <BalanceChart session={session} title="Portfolio value over the simulation" />
        {components && (
          <section className="panel panel-body" aria-labelledby="averages-title">
            <h2 id="averages-title">Average score components</h2>
            <p className="muted small" style={{ margin: '6px 0 16px' }}>Averaged over all rounds. Weights come from the configuration this simulation used.</p>
            <div className="scores">
              {([
                ['Performance', components.performance, weights.performancePct, 'Rewards net return after the fee.'],
                ['Risk fit', components.riskFit, weights.riskFitPct, 'Rewards keeping portfolio risk close to your chosen profile.'],
                ['Diversification', components.diversification, weights.diversificationPct, 'Rewards spreading money across assets.'],
              ] as const).map(([label, value, weight, reason]) => (
                <div className="score-row" key={label}>
                  <span className="score-row-label">{label} <span>({weight}% weight)</span></span>
                  <span className="score-row-value">{formatScore(value)} / 100</span>
                  <div className="meter" aria-hidden="true"><div className="meter-fill" style={{ width: `${value}%` }} /></div>
                  <p className="score-reason">{reason}</p>
                </div>
              ))}
            </div>
          </section>
        )}
      </div>

      <section className="panel panel-body" aria-label="Round history">
        <RoundLedger session={session} caption="Your decisions and results" />
      </section>
      <p className="muted small">These results use hypothetical scenarios and are stored only in this browser. They say nothing about real investment performance.</p>
    </div>
  );
}
