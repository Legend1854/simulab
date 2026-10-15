import { Change } from '../../components/Change';
import { calculationSteps, explainScores } from '../../domain/explain';
import type { RoundOutcome, SimulationConfig } from '../../domain/types';
import { formatCurrency, formatScore } from '../../utils/format';
import { FormulaBar } from './FormulaBar';
import { ScoreBreakdown } from './ScoreBreakdown';

interface Props {
  outcome: RoundOutcome;
  config: SimulationConfig;
  variant: 'projection' | 'submitted';
  headingId?: string;
  headingLevel?: 2 | 3;
}

/** The same layout serves the live projection (dashed, "not submitted") and the recorded result (solid). */
export function OutcomePanel({ outcome, config, variant, headingId, headingLevel = 2 }: Props) {
  const profile = config.riskProfiles.find((candidate) => candidate.id === outcome.decision.riskProfileId);
  const explanations = explainScores(outcome, config, profile?.name ?? 'selected');
  const Heading = headingLevel === 2 ? 'h2' : 'h3';
  const isProjection = variant === 'projection';
  return (
    <section className={isProjection ? 'projection' : 'panel submitted'} aria-labelledby={headingId}>
      <div className="projection-head">
        <div>
          <Heading id={headingId} tabIndex={-1}>
            {isProjection ? `Projected result for round ${outcome.round}` : `Round ${outcome.round} result`}
          </Heading>
          <p className="muted small">
            {isProjection ? 'Updates as you change your decision. Nothing is recorded until you submit.' : `${outcome.scenarioTitle}, recorded and final.`}
          </p>
        </div>
        <span className={isProjection ? 'badge badge-warn' : 'badge badge-ok'}>{isProjection ? 'Projection, not submitted' : '✓ Submitted'}</span>
      </div>
      <div className="projection-body">
        <dl className="outcome-figures">
          <div>
            <dt>{isProjection ? 'Projected ending balance' : 'Ending balance'}</dt>
            <dd className="num">
              {formatCurrency(outcome.endingBalance)}
              <Change value={outcome.change} kind="currency" suffix="this round" />
            </dd>
          </div>
          <div>
            <dt>{isProjection ? 'Projected round score' : 'Round score'}</dt>
            <dd className="num">
              {formatScore(outcome.scores.overall)} <small className="muted">/ 100</small>
              <Change value={outcome.netReturn} kind="fraction" suffix="net return" />
            </dd>
          </div>
        </dl>
        <FormulaBar steps={calculationSteps(outcome, config)} caption={isProjection ? 'How the projection is calculated' : 'How this result was calculated'} />
        <ScoreBreakdown explanations={explanations} overall={outcome.scores.overall} />
      </div>
    </section>
  );
}
