import type { SimulationConfig } from '../../domain/types';

/** Progress through the rounds. A real sequence, so it is numbered. */
export function RoundSteps({ config, completed, current }: { config: SimulationConfig; completed: number; current: number | null }) {
  return (
    <ol className="round-steps" style={{ ['--steps' as string]: config.scenarios.length }} aria-label="Rounds">
      {config.scenarios.map((scenario, index) => {
        const round = index + 1;
        const state = round <= completed ? 'done' : round === current ? 'current' : 'upcoming';
        const status = state === 'done' ? 'completed' : state === 'current' ? 'current round' : 'not started';
        return (
          <li key={scenario.id} className="round-step" data-state={state} aria-current={state === 'current' ? 'step' : undefined}>
            Round {round}
            {state === 'done' && <span aria-hidden="true"> ✓</span>}
            <span className="visually-hidden">, {status}</span>
            <strong>{scenario.title}</strong>
          </li>
        );
      })}
    </ol>
  );
}
