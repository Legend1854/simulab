import { Icon } from '../../components/Icon';
import type { SimulationConfig } from '../../domain/types';

/** Progress through the rounds: completed rounds carry a check, the current round is marked in ochre. */
export function RoundTimeline({ config, completed, current }: { config: SimulationConfig; completed: number; current: number | null }) {
  return (
    <ol className="timeline" style={{ ['--steps' as string]: config.scenarios.length }} aria-label="Rounds">
      {config.scenarios.map((scenario, index) => {
        const round = index + 1;
        const state = round <= completed ? 'done' : round === current ? 'current' : 'upcoming';
        const status = state === 'done' ? 'completed' : state === 'current' ? 'current round' : 'not started';
        return (
          <li key={scenario.id} className="timeline-step" data-state={state} aria-current={state === 'current' ? 'step' : undefined}>
            <span className="timeline-node" aria-hidden="true">
              {state === 'done' ? <Icon name="check" size={14} /> : round}
            </span>
            <span className="timeline-text">
              <span className="timeline-round">
                Round {round}
                <span className="visually-hidden">, {status}</span>
              </span>
              <span className="timeline-title">{scenario.title}</span>
            </span>
          </li>
        );
      })}
    </ol>
  );
}
