import { useState } from 'react';
import { useStore } from '../../app/StoreContext';
import { usePageTitle } from '../../app/usePageTitle';
import { Change } from '../../components/Change';
import { Icon } from '../../components/Icon';
import { Notice } from '../../components/Notice';
import { RATING_BANDS } from '../../domain/constants';
import { sessionStats } from '../../domain/progression';
import type { RoundResult, SimulationSession } from '../../domain/types';
import { sessionsToCsv } from '../../services/exports/csv';
import { downloadCsv, safeFilename } from '../../services/exports/download';
import { formatCurrency, formatReturn, formatScore } from '../../utils/format';
import { BalanceChart } from './BalanceChart';
import { RoundLedger } from './RoundLedger';

type ExportStatus = { tone: 'success' | 'error'; text: string } | null;

const bandText = RATING_BANDS.map((band, index) => {
  const above = RATING_BANDS[index - 1];
  if (!above) return `${band.label} ${band.min} and above`;
  return band.min === 0 ? `${band.label} below ${above.min}` : `${band.label} ${band.min} to below ${above.min}`;
}).join('; ');

function bestAndWorst(results: ReadonlyArray<RoundResult>): { best: RoundResult; worst: RoundResult } | null {
  if (results.length === 0) return null;
  const sorted = [...results].sort((a, b) => b.scores.overall - a.scores.overall);
  return { best: sorted[0] as RoundResult, worst: sorted[sorted.length - 1] as RoundResult };
}

export function ResultsScreen({ session }: { session: SimulationSession }) {
  usePageTitle('Final results');
  const store = useStore();
  const [exportStatus, setExportStatus] = useState<ExportStatus>(null);
  const stats = sessionStats(session);
  const { weights } = session.config.scoring;
  const components = stats.averageComponents;
  const extremes = bestAndWorst(session.results);

  const exportCsv = () => {
    const filename = `${safeFilename(session.participantLabel, 'simulab')}-results.csv`;
    try {
      downloadCsv(sessionsToCsv([session]), filename);
      setExportStatus({ tone: 'success', text: `${filename} was created with ${session.results.length} rounds. Check your browser's downloads.` });
    } catch {
      setExportStatus({ tone: 'error', text: 'The results file could not be created in this browser. Your results are still shown on this page.' });
    }
  };

  return (
    <div className="stack-lg">
      <section className="sheet results-hero" aria-labelledby="page-title">
        <div className="sheet-section results-hero-main">
          <p className="results-kicker">
            Simulation complete{session.participantLabel ? ` for ${session.participantLabel}` : ''}. {session.config.name}.
          </p>
          <h1 id="page-title" tabIndex={-1}>
            <span className="visually-hidden">Final results: </span>
            {stats.rating}
          </h1>
          <p className="muted small results-bands">Rating from the average round score: {bandText}.</p>
          <div className="row results-actions">
            <button type="button" className="btn" onClick={exportCsv}>
              <Icon name="download" size={16} />
              Export my results (CSV)
            </button>
            <button type="button" className="btn btn-primary" onClick={() => store.closeActiveSession()}>
              Start a new simulation
            </button>
          </div>
          {exportStatus && (
            <div className="results-export-status">
              <Notice tone={exportStatus.tone} role={exportStatus.tone === 'error' ? 'alert' : 'status'} onDismiss={() => setExportStatus(null)}>
                {exportStatus.text}
              </Notice>
            </div>
          )}
        </div>
        <dl className="results-figures">
          <div>
            <dt>Final balance</dt>
            <dd className="num">{formatCurrency(stats.currentBalance)}</dd>
          </div>
          <div>
            <dt>Total return</dt>
            <dd className="num">
              {formatReturn(stats.totalReturn)} <Change value={stats.currentBalance - session.config.startingBalance} kind="currency" />
            </dd>
          </div>
          <div>
            <dt>Average round score</dt>
            <dd className="num">{stats.averageScore === null ? 'Not available' : <>{formatScore(stats.averageScore)} <span className="muted">/ 100</span></>}</dd>
          </div>
          <div>
            <dt>Rounds completed</dt>
            <dd className="num">{stats.roundsCompleted} of {stats.totalRounds}</dd>
          </div>
        </dl>
      </section>

      <div className="results-grid">
        <BalanceChart session={session} title="Portfolio value over the simulation" />
        {components && (
          <section className="sheet sheet-section" aria-labelledby="averages-title">
            <h2 id="averages-title">Average score components</h2>
            <p className="muted small">Averaged over all rounds, with the weights this simulation used.</p>
            <ul className="score-list">
              {([
                ['Performance', components.performance, weights.performancePct, 'Rewards net return after the fee.'],
                ['Risk fit', components.riskFit, weights.riskFitPct, 'Rewards keeping portfolio risk close to your chosen profile.'],
                ['Diversification', components.diversification, weights.diversificationPct, 'Rewards spreading money across assets.'],
              ] as const).map(([label, value, weight, reason]) => (
                <li className="score-row" key={label}>
                  <div className="score-row-head">
                    <span className="score-row-label">{label}</span>
                    <span className="score-row-value num">
                      {formatScore(value)} <span className="muted">/ 100, {weight}% weight</span>
                    </span>
                  </div>
                  <div className="meter" aria-hidden="true">
                    <div className="meter-fill" style={{ width: `${value}%` }} />
                  </div>
                  <p className="score-reason">{reason}</p>
                </li>
              ))}
            </ul>
            {extremes && extremes.best !== extremes.worst && (
              <p className="results-extremes small">
                Your strongest round was round {extremes.best.round}, {extremes.best.scenarioTitle} ({formatScore(extremes.best.scores.overall)}). Your weakest was round{' '}
                {extremes.worst.round}, {extremes.worst.scenarioTitle} ({formatScore(extremes.worst.scores.overall)}).
              </p>
            )}
          </section>
        )}
      </div>

      <section className="sheet sheet-section" aria-label="Round history">
        <RoundLedger session={session} caption="Your decisions and results" />
      </section>
      <p className="muted small">These results use invented scenarios and are stored only in this browser. They say nothing about real investment performance.</p>
    </div>
  );
}
