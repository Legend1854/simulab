import { overallFormula, type ScoreExplanation } from '../../domain/explain';
import { formatScore } from '../../utils/format';
import { Icon } from '../../components/Icon';

/** The three score components: score, weight, the points each adds, a plain reason and the formula on request. */
export function ScoreBreakdown({ explanations, overall, headingId }: { explanations: ScoreExplanation[]; overall: number; headingId: string }) {
  return (
    <section className="scores" aria-labelledby={headingId}>
      <h3 id={headingId} className="scores-title">How the round score is built</h3>
      <ul className="score-list">
        {explanations.map((row) => (
          <li className="score-row" key={row.key}>
            <div className="score-row-head">
              <span className="score-row-label">{row.label}</span>
              <span className="score-row-value num">
                {formatScore(row.score)}
                <span className="muted"> × {row.weightPct}% = {formatScore(row.points)} pts</span>
              </span>
            </div>
            <div className="meter" aria-hidden="true">
              <div className="meter-fill" style={{ width: `${row.score}%` }} />
            </div>
            <p className="score-reason">{row.reason}</p>
          </li>
        ))}
      </ul>
      <div className="score-total">
        <span>Round score</span>
        <strong className="num">{formatScore(overall)} <span className="muted">/ 100</span></strong>
      </div>
      <details className="disclosure score-formulas">
        <summary>
          <Icon name="chevronRight" size={14} />
          Show the scoring formulas
        </summary>
        <dl>
          {explanations.map((row) => (
            <div key={row.key}>
              <dt>{row.label}</dt>
              <dd className="mono">{row.formula}</dd>
            </div>
          ))}
          <div>
            <dt>Round score</dt>
            <dd className="mono">{overallFormula(explanations)}</dd>
          </div>
        </dl>
      </details>
    </section>
  );
}
