import { ReturnBars } from '../../components/viz/ReturnBars';
import type { Scenario, SimulationConfig } from '../../domain/types';
import { formatPct } from '../../utils/format';

/** Largest absolute return in the whole configuration, so return bars keep one scale from round to round. */
export const largestReturn = (config: SimulationConfig): number =>
  Math.max(1, ...config.scenarios.flatMap((scenario) => Object.values(scenario.returnsPct).map((value) => Math.abs(value))));

export function ScenarioBrief({ scenario, round, config }: { scenario: Scenario; round: number; config: SimulationConfig }) {
  return (
    <section className="sheet sheet-section brief" aria-labelledby="page-title">
      <div className="brief-kicker">
        <span>Round {round} of {config.scenarios.length}</span>
        {scenario.phase && <span className="pill pill-ochre">{scenario.phase}</span>}
      </div>
      <h1 id="page-title" tabIndex={-1}>{scenario.title}</h1>
      {scenario.description && <p className="brief-narrative">{scenario.description}</p>}
      <ReturnBars
        assets={config.assets}
        returnsPct={scenario.returnsPct}
        scalePct={largestReturn(config)}
        caption={`Asset returns in this round. These are scenario inputs set by the instructor, not forecasts; a ${formatPct(config.annualFeePct)} annual fee is then deducted.`}
      />
      {scenario.lesson && (
        <p className="brief-lesson">
          <strong>Learning focus.</strong> {scenario.lesson}
        </p>
      )}
    </section>
  );
}
