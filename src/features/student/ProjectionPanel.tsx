import { Change } from '../../components/Change';
import { Icon } from '../../components/Icon';
import { StepMarker } from '../../components/StepMarker';
import { calculationSteps, explainScores } from '../../domain/explain';
import type { RoundOutcome, SimulationConfig } from '../../domain/types';
import { formatCurrency, formatScore } from '../../utils/format';
import { Evidence } from './Evidence';
import { ScoreBreakdown } from './ScoreBreakdown';

/**
 * What would happen if the current allocation were submitted. Drawn in ochre with a dashed edge and a
 * "not submitted" label so it is never mistaken for a recorded result (which is petrol and solid).
 */
export function ProjectionPanel({ round, outcome, config }: { round: number; outcome: RoundOutcome | null; config: SimulationConfig }) {
  const profile = outcome ? config.riskProfiles.find((candidate) => candidate.id === outcome.decision.riskProfileId) : undefined;
  return (
    <section className="report report-projection" aria-labelledby="projection-title">
      <div className="report-head">
        <span className="pill pill-ochre">
          <Icon name="formula" size={14} />
          Projection, not submitted
        </span>
        <h2 id="projection-title">Projected result for round {round}</h2>
        <p className="muted small">Updates as you change your decision. Nothing is recorded until you submit.</p>
      </div>
      {outcome ? (
        <>
          <dl className="report-figures">
            <div>
              <dt>Projected ending balance</dt>
              <dd className="report-figure num">
                {formatCurrency(outcome.endingBalance)}
                <StepMarker step={3} targetId="projection-step-3" label="Projected ending balance" />
              </dd>
              <dd><Change value={outcome.change} kind="currency" suffix="this round" /></dd>
            </div>
            <div>
              <dt>Projected round score</dt>
              <dd className="report-figure num">
                {formatScore(outcome.scores.overall)} <span className="report-unit">/ 100</span>
              </dd>
              <dd><Change value={outcome.netReturn} kind="fraction" suffix="after the fee" /></dd>
            </div>
          </dl>
          <Evidence steps={calculationSteps(outcome, config)} idPrefix="projection" title="How the projection is calculated" />
          <ScoreBreakdown explanations={explainScores(outcome, config, profile?.name ?? 'selected')} overall={outcome.scores.overall} headingId="projection-scores-title" />
        </>
      ) : (
        <p className="report-waiting">
          <Icon name="info" size={16} />
          The projection appears once your allocation is valid and totals exactly 100%.
        </p>
      )}
    </section>
  );
}
