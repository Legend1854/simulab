import { roundFeedback } from '../../domain/explain';
import type { RoundOutcome, SimulationConfig } from '../../domain/types';
import { formatScore } from '../../utils/format';

const LABELS = { performance: 'Performance', riskFit: 'Risk fit', diversification: 'Diversification' } as const;

/** What shaped the score, ordered by the points each part cost. Describes trade-offs, never "the" answer. */
export function Feedback({ outcome, config }: { outcome: RoundOutcome; config: SimulationConfig }) {
  const profile = config.riskProfiles.find((candidate) => candidate.id === outcome.decision.riskProfileId);
  const points = roundFeedback(outcome, config, profile?.name ?? 'selected');
  return (
    <section className="sheet sheet-section feedback" aria-labelledby="feedback-title">
      <h2 id="feedback-title">What shaped this score</h2>
      <p className="muted small">Ordered by how many points each part cost. The three parts pull in different directions, so there is rarely one right allocation.</p>
      <ol className="feedback-list">
        {points.map((point) => (
          <li key={point.key}>
            <p className="feedback-head">
              <strong>{LABELS[point.key]}</strong>
              <span className="num muted">{point.pointsLost < 0.05 ? 'no points lost' : `${formatScore(point.pointsLost)} points lost`}</span>
            </p>
            <p>{point.text}</p>
          </li>
        ))}
      </ol>
    </section>
  );
}
