import { useEffect } from 'react';
import { usePageTitle } from '../../app/usePageTitle';
import type { SimulationSession } from '../../domain/types';
import { Feedback } from './Feedback';
import { PortfolioStrip } from './PortfolioStrip';
import { RoundReport } from './RoundReport';
import { RoundTimeline } from './RoundTimeline';

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
      <div className="round-head">
        <RoundTimeline config={session.config} completed={session.results.length} current={null} />
        <PortfolioStrip session={session} />
      </div>
      <div className="workspace">
        <div className="workspace-main">
          <div className="sheet sheet-section">
            <RoundReport outcome={result} config={session.config} headingLevel={1} idPrefix="review" headingId="review-title" />
          </div>
        </div>
        <div className="workspace-side review-side">
          <section className="sheet sheet-section next-step" aria-labelledby="next-title">
            <h2 id="next-title">{finished ? 'All rounds complete' : `Up next: round ${round + 1}`}</h2>
            <p className="muted">
              {finished
                ? 'Your decisions are recorded. See your final rating, balance history and score averages.'
                : `${nextScenario?.title ?? ''}. Your allocation carries over, so you can adjust it rather than start again.`}
            </p>
            <button type="button" className="btn btn-primary btn-lg btn-block" onClick={onContinue}>
              {finished ? 'See final results' : `Continue to round ${round + 1}`}
            </button>
          </section>
          <Feedback outcome={result} config={session.config} />
        </div>
      </div>
    </>
  );
}
