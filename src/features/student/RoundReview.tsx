import { useEffect } from 'react';
import { usePageTitle } from '../../app/usePageTitle';
import type { SimulationSession } from '../../domain/types';
import { OutcomePanel } from './OutcomePanel';
import { RoundSteps } from './RoundSteps';
import { StatRow } from './StatRow';

/** Shown right after a submission. A separate step, so a double click cannot submit the next round by accident. */
export function RoundReview({ session, round, onContinue }: { session: SimulationSession; round: number; onContinue: () => void }) {
  const result = session.results[round - 1];
  usePageTitle(`Round ${round} result`, false);
  useEffect(() => {
    document.getElementById('review-title')?.focus();
  }, [round]);
  if (!result) return null;
  const finished = session.status === 'complete';
  const nextScenario = session.config.scenarios[round];

  return (
    <>
      <RoundSteps config={session.config} completed={session.results.length} current={null} />
      <div className="sim-grid">
        <div className="sim-col">
          <OutcomePanel outcome={result} config={session.config} variant="submitted" headingId="review-title" />
        </div>
        <div className="sim-col">
          <StatRow session={session} />
          <section className="panel panel-body stack" aria-labelledby="next-title">
            <h2 id="next-title">{finished ? 'All rounds complete' : `Up next: round ${round + 1}`}</h2>
            <p className="muted">
              {finished
                ? 'Your decisions are recorded. See your final rating, balance history and score averages.'
                : `${nextScenario?.title ?? ''}. Your allocation carries over, so you can adjust it rather than start again.`}
            </p>
            <button type="button" className="btn btn-primary btn-large btn-block" onClick={onContinue}>
              {finished ? 'See final results' : `Continue to round ${round + 1}`}
            </button>
          </section>
        </div>
      </div>
    </>
  );
}
