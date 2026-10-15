import { useMemo } from 'react';
import { AllocationBar } from '../../components/viz/AllocationBar';
import { equalSplitAllocation } from '../../domain/calculations';
import { calculationSteps } from '../../domain/explain';
import { startSession, submitRound } from '../../domain/progression';
import type { RoundResult, SimulationConfig, SimulationSession } from '../../domain/types';
import { columnLetters } from '../../services/spreadsheets/ooxml/cellRef';
import { formatCurrency, formatCurrencyWhole, formatPct } from '../../utils/format';

/** Columns of the mini returns sheet before it is cut short with an ellipsis column. */
const MAX_SHEET_ROUNDS = 6;

interface PreviewRun {
  session: SimulationSession;
  first: RoundResult;
  profileName: string;
}

/**
 * Plays the current configuration with an even split through every round, using the real engine.
 * Returns null if the configuration cannot be played (it is validated, so this is defensive).
 */
function previewRun(config: SimulationConfig): PreviewRun | null {
  const profile = config.riskProfiles.find((candidate) => candidate.id === 'balanced') ?? config.riskProfiles[0];
  if (!profile) return null;
  const allocationPct = equalSplitAllocation(config.assets);
  const now = '2026-01-01T00:00:00.000Z';
  try {
    let session = startSession({ config, participantLabel: '', id: 'home-preview', now });
    for (let round = 1; round <= config.scenarios.length; round += 1) {
      session = submitRound(session, { round, allocationPct, riskProfileId: profile.id }, now);
    }
    const first = session.results[0];
    return first ? { session, first, profileName: profile.name } : null;
  } catch {
    return null;
  }
}

function ReturnsSheet({ config }: { config: SimulationConfig }) {
  const shown = config.scenarios.slice(0, MAX_SHEET_ROUNDS);
  const hidden = config.scenarios.length - shown.length;
  return (
    <div className="mini-sheet-wrap">
      <table className="mini-sheet">
        <caption className="visually-hidden">Asset returns by round, in percentage points</caption>
        <thead>
          <tr className="mini-sheet-letters" aria-hidden="true">
            <td />
            <td>A</td>
            {shown.map((scenario, index) => (
              <td key={scenario.id} className={index === 0 ? 'is-traced' : undefined}>{columnLetters(index + 1)}</td>
            ))}
            {hidden > 0 && <td>{columnLetters(shown.length + 1)}</td>}
          </tr>
          <tr>
            <td className="mini-sheet-rownum" aria-hidden="true">1</td>
            <th scope="col">Asset</th>
            {shown.map((scenario, index) => (
              <th scope="col" key={scenario.id} className={index === 0 ? 'is-traced' : undefined}>
                <span className="visually-hidden">Round </span>R{index + 1}
              </th>
            ))}
            {hidden > 0 && <th scope="col">+{hidden}</th>}
          </tr>
        </thead>
        <tbody>
          {config.assets.map((asset, row) => (
            <tr key={asset.id}>
              <td className="mini-sheet-rownum" aria-hidden="true">{row + 2}</td>
              <th scope="row">{asset.name}</th>
              {shown.map((scenario, index) => {
                const value = scenario.returnsPct[asset.id] ?? 0;
                return (
                  <td key={scenario.id} className={`num ${index === 0 ? 'is-traced' : ''} ${value < 0 ? 'is-negative' : ''}`}>
                    {formatPct(value, 1, true).replace('%', '')}
                  </td>
                );
              })}
              {hidden > 0 && <td className="muted">…</td>}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function BalancePath({ session }: { session: SimulationSession }) {
  const points = [session.config.startingBalance, ...session.results.map((result) => result.endingBalance)];
  const width = 260;
  const height = 132;
  const pad = { top: 22, right: 14, bottom: 26, left: 14 };
  const min = Math.min(...points);
  const max = Math.max(...points);
  const span = Math.max(max - min, max * 0.02);
  const x = (index: number) => pad.left + (index / Math.max(1, points.length - 1)) * (width - pad.left - pad.right);
  const y = (value: number) => pad.top + (1 - (value - min) / span) * (height - pad.top - pad.bottom);
  const path = points.map((value, index) => `${index === 0 ? 'M' : 'L'}${x(index).toFixed(1)} ${y(value).toFixed(1)}`).join(' ');
  const last = points[points.length - 1] ?? 0;
  const startY = y(session.config.startingBalance);
  // Label the lowest point too (when it is not the start or the end), so the vertical scale can be read.
  const lowIndex = points.indexOf(min);
  const showLow = lowIndex > 0 && lowIndex < points.length - 1 && min < session.config.startingBalance;

  return (
    <svg className="balance-path" viewBox={`0 0 ${width} ${height}`} role="img" aria-label={`Balance after each round: ${points.map((value, index) => `${index === 0 ? 'start' : `round ${index}`} ${formatCurrencyWhole(value)}`).join(', ')}.`}>
      <line x1={pad.left} x2={width - pad.right} y1={startY} y2={startY} className="balance-path-start" />
      <path d={path} className="balance-path-line" />
      {points.map((value, index) => (
        <circle key={index} cx={x(index)} cy={y(value)} r={index === points.length - 1 ? 4.5 : 3} className={index === points.length - 1 ? 'balance-path-end' : 'balance-path-dot'} />
      ))}
      {points.map((_, index) => (
        <text key={`label-${index}`} x={x(index)} y={height - 6} textAnchor="middle" className="balance-path-axis">
          {index === 0 ? 'Start' : `R${index}`}
        </text>
      ))}
      <text x={pad.left} y={startY + 15} className="balance-path-value">{formatCurrencyWhole(points[0] ?? 0)}</text>
      {showLow && (
        <text x={x(lowIndex) + 7} y={y(min) + 4} className="balance-path-value">{formatCurrencyWhole(min)}</text>
      )}
      <text x={x(points.length - 1)} y={y(last) - 10} textAnchor="end" className="balance-path-value is-end">{formatCurrencyWhole(last)}</text>
    </svg>
  );
}

/** Figure 1 on the home page: workbook cells -> calculation -> outcome, computed live from the configuration. */
export function Pipeline({ config }: { config: SimulationConfig }) {
  const run = useMemo(() => previewRun(config), [config]);
  if (!run) return null;
  const steps = calculationSteps(run.first, config);
  const rounds = config.scenarios.length;

  return (
    <figure className="pipeline" aria-labelledby="pipeline-caption">
      <div className="pipeline-stages">
        <section className="pipeline-stage" aria-labelledby="stage-sheet">
          <p className="pipeline-step" aria-hidden="true">1</p>
          <h2 id="stage-sheet" className="pipeline-title">The scenario sheet</h2>
          <p className="pipeline-note">Returns per asset and round, as an instructor types them into the workbook.</p>
          <ReturnsSheet config={config} />
        </section>

        <div className="pipeline-link" aria-hidden="true">
          <svg viewBox="0 0 40 16" width="40" height="16"><path d="M2 8h32M28 3l6 5-6 5" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" /></svg>
        </div>

        <section className="pipeline-stage" aria-labelledby="stage-engine">
          <p className="pipeline-step" aria-hidden="true">2</p>
          <h2 id="stage-engine" className="pipeline-title">Round 1, worked through</h2>
          <p className="pipeline-note">An even split, run through the same tested engine the simulation uses.</p>
          <AllocationBar assets={config.assets} allocationPct={run.first.decision.allocationPct} legend={false} size="slim" />
          <ol className="pipeline-calc">
            {steps.map((step) => (
              <li key={step.label}>
                <span className="pipeline-calc-label">{step.label}</span>
                <span className="pipeline-calc-expr">{step.expression}</span>
                <span className="pipeline-calc-result num">= {step.result}</span>
              </li>
            ))}
          </ol>
        </section>

        <div className="pipeline-link" aria-hidden="true">
          <svg viewBox="0 0 40 16" width="40" height="16"><path d="M2 8h32M28 3l6 5-6 5" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" /></svg>
        </div>

        <section className="pipeline-stage" aria-labelledby="stage-outcome">
          <p className="pipeline-step" aria-hidden="true">3</p>
          <h2 id="stage-outcome" className="pipeline-title">{rounds === 1 ? 'The outcome' : `All ${rounds} rounds`}</h2>
          <p className="pipeline-note">
            {formatCurrency(config.startingBalance)} becomes {formatCurrency(run.session.results[run.session.results.length - 1]?.endingBalance ?? 0)} after the {formatPct(config.annualFeePct)} fee each round.
          </p>
          <BalancePath session={run.session} />
        </section>
      </div>
      <figcaption id="pipeline-caption" className="pipeline-caption">
        Figure 1. Illustrative run of “{config.name}”: an even split with the {run.profileName} profile in every round. Calculated in your browser by the
        simulation’s own engine; change the configuration and this figure changes with it.
      </figcaption>
    </figure>
  );
}
