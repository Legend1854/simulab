import { Change } from '../../components/Change';
import { Icon } from '../../components/Icon';
import { StepMarker } from '../../components/StepMarker';
import { calculationSteps, explainScores, roundStatement } from '../../domain/explain';
import type { RoundOutcome, SimulationConfig } from '../../domain/types';
import { formatCurrency, formatPct, formatReturn, formatScore } from '../../utils/format';
import { Evidence } from './Evidence';
import { ScoreBreakdown } from './ScoreBreakdown';

/** "+$750.00" or "−$50.00". The minus is a true minus sign, which screen readers announce as "minus". */
const signedMoney = (value: number): string => `${value < 0 ? '−' : '+'}${formatCurrency(Math.abs(value))}`;

interface Props {
  outcome: RoundOutcome;
  config: SimulationConfig;
  headingLevel: 1 | 2 | 3;
  idPrefix: string;
  /** Moves focus here when shown, for the review step. */
  headingId?: string;
}

/** A submitted round written up like a short analyst's note: headline, money statement, calculation, scores. */
export function RoundReport({ outcome, config, headingLevel, idPrefix, headingId }: Props) {
  const Heading = (`h${headingLevel}` as 'h1' | 'h2' | 'h3');
  const profile = config.riskProfiles.find((candidate) => candidate.id === outcome.decision.riskProfileId);
  const statement = roundStatement(outcome);
  const titleId = headingId ?? `${idPrefix}-report-title`;
  return (
    <article className="report report-submitted" aria-labelledby={titleId}>
      <div className="report-head">
        <span className="pill pill-petrol">
          <Icon name="check" size={14} />
          Submitted
        </span>
        <Heading id={titleId} tabIndex={-1}>Round {outcome.round} result</Heading>
        <p className="muted small">{outcome.scenarioTitle}. Recorded and final.</p>
      </div>

      <dl className="report-figures">
        <div>
          <dt>Ending balance</dt>
          <dd className="report-figure num">
            {formatCurrency(outcome.endingBalance)}
            <StepMarker step={3} targetId={`${idPrefix}-step-3`} label="Ending balance" />
          </dd>
          <dd><Change value={outcome.change} kind="currency" suffix="this round" /></dd>
        </div>
        <div>
          <dt>Round score</dt>
          <dd className="report-figure num">
            {formatScore(outcome.scores.overall)} <span className="report-unit">/ 100</span>
          </dd>
          <dd className="small muted">Profile: {profile?.name ?? outcome.decision.riskProfileId}</dd>
        </div>
      </dl>

      <table className="statement">
        <caption>Round statement</caption>
        <tbody>
          <tr>
            <th scope="row">Starting balance</th>
            <td className="num" />
            <td className="num">{formatCurrency(statement.startingBalance)}</td>
          </tr>
          <tr>
            <th scope="row">Gross return</th>
            <td className="num">{formatReturn(statement.grossReturn)}</td>
            <td className="num">{signedMoney(statement.grossAmount)}</td>
          </tr>
          <tr>
            <th scope="row">Management fee</th>
            <td className="num">{formatPct(statement.feeRate * 100)}</td>
            <td className="num">{signedMoney(-statement.feeAmount)}</td>
          </tr>
          <tr className="statement-total">
            <th scope="row">Ending balance</th>
            <td className="num">net {formatReturn(statement.netReturn)}</td>
            <td className="num">{formatCurrency(statement.endingBalance)}</td>
          </tr>
        </tbody>
      </table>

      <Evidence steps={calculationSteps(outcome, config)} idPrefix={idPrefix} title="How this result was calculated" />
      <ScoreBreakdown explanations={explainScores(outcome, config, profile?.name ?? 'selected')} overall={outcome.scores.overall} headingId={`${idPrefix}-scores-title`} />
    </article>
  );
}
