import type { Scenario, SimulationConfig } from '../../domain/types';
import { formatPct } from '../../utils/format';

export function ScenarioBrief({ scenario, round, config }: { scenario: Scenario; round: number; config: SimulationConfig }) {
  return (
    <section className="panel panel-body" aria-labelledby="page-title">
      <p className="scenario-kicker">
        Round {round} of {config.scenarios.length}
        {scenario.phase ? `: ${scenario.phase}` : ''}
      </p>
      <h1 id="page-title" className="scenario-title" tabIndex={-1}>{scenario.title}</h1>
      {scenario.description && <p className="scenario-desc">{scenario.description}</p>}
      {scenario.lesson && (
        <p className="lesson">
          <strong>Learning focus.</strong> {scenario.lesson}
        </p>
      )}
      <dl className="returns-list" aria-label={`Asset returns in round ${round}`}>
        {config.assets.map((asset) => {
          const value = scenario.returnsPct[asset.id] ?? 0;
          return (
            <div key={asset.id}>
              <dt>{asset.name}</dt>
              <dd className={value > 0 ? 'change-gain' : value < 0 ? 'change-loss' : undefined}>
                <span aria-hidden="true">{value > 0 ? '▲ ' : value < 0 ? '▼ ' : ''}</span>
                {formatPct(value, 2, true)}
              </dd>
            </div>
          );
        })}
      </dl>
      <p className="hint" style={{ marginTop: 8 }}>
        These scenario returns are published in advance. The annual fee of {formatPct(config.annualFeePct)} is deducted from the portfolio return.
      </p>
    </section>
  );
}
