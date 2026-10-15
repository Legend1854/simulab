import { overallFormula, type ScoreExplanation } from '../../domain/explain';
import { formatScore } from '../../utils/format';

/** The three score components with weight, value, formula and a plain-language reason. */
export function ScoreBreakdown({ explanations, overall }: { explanations: ScoreExplanation[]; overall: number }) {
  return (
    <div className="scores">
      {explanations.map((row) => (
        <div className="score-row" key={row.key}>
          <span className="score-row-label">
            {row.label} <span>({row.weightPct}% of the overall score)</span>
          </span>
          <span className="score-row-value">{formatScore(row.score)} / 100</span>
          <div className="meter" aria-hidden="true">
            <div className="meter-fill" style={{ width: `${row.score}%` }} />
          </div>
          <p className="score-reason">{row.reason}</p>
          <p className="score-formula">{row.formula}</p>
        </div>
      ))}
      <div className="score-total">
        <span>
          Overall score <span className="muted num">= {overallFormula(explanations)}</span>
        </span>
        <strong className="num">{formatScore(overall)} / 100</strong>
      </div>
    </div>
  );
}
