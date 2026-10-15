import { useMemo } from 'react';
import { usePageTitle } from '../../app/usePageTitle';
import { useAppState } from '../../app/StoreContext';
import { equalSplitAllocation, evaluateRound } from '../../domain/calculations';
import { calculationSteps } from '../../domain/explain';
import { formatCurrencyWhole } from '../../utils/format';
import { FormulaBar } from '../student/FormulaBar';

const NUMBER_WORDS: Record<number, string> = {
  1: 'One', 2: 'Two', 3: 'Three', 4: 'Four', 5: 'Five', 6: 'Six', 7: 'Seven', 8: 'Eight', 9: 'Nine', 10: 'Ten', 11: 'Eleven', 12: 'Twelve',
};

export function HomePage() {
  usePageTitle('Home');
  const { config } = useAppState();
  const rounds = config.scenarios.length;

  // A real calculation from the current configuration, shown as an example of the formula bar.
  const example = useMemo(() => {
    const profile = config.riskProfiles[0];
    if (!profile) return null;
    const allocationPct = equalSplitAllocation(config.assets);
    const outcome = evaluateRound(config, 0, config.startingBalance, { round: 1, allocationPct, riskProfileId: profile.id });
    return calculationSteps(outcome, config);
  }, [config]);

  return (
    <>
      <section className="home-hero" aria-labelledby="page-title">
        <div>
          <h1 id="page-title" tabIndex={-1}>
            {NUMBER_WORDS[rounds] ?? rounds} market {rounds === 1 ? 'round' : 'rounds'}. Every number explained.
          </h1>
          <p className="lead">
            SimuLab is an educational investment simulation. You allocate a fictional {formatCurrencyWhole(config.startingBalance)} portfolio,
            respond to changing market scenarios and see the formula behind every result.
          </p>
          <div className="home-actions">
            <a className="btn btn-primary btn-large" href="#/student">Start the simulation</a>
            <a className="btn btn-large" href="#/instructor/settings">Open the instructor dashboard</a>
          </div>
        </div>
        {example && (
          <div>
            <FormulaBar steps={example} caption={`Example: an even split across all assets in round 1 of "${config.name}"`} />
          </div>
        )}
      </section>

      <section className="home-paths" aria-label="Ways to use SimuLab">
        <div className="panel home-path">
          <h2>For students</h2>
          <p className="muted">Play {rounds} sequential rounds with the same starting balance and scenarios as everyone else.</p>
          <ul>
            <li>Choose a risk profile and split your portfolio across {config.assets.length} asset classes.</li>
            <li>See a live projection before you commit, then the recorded result after.</li>
            <li>Understand your score: performance, risk fit and diversification, each with its formula.</li>
            <li>Finish with a rating, your balance history and a CSV of your decisions.</li>
          </ul>
          <a className="btn btn-primary" href="#/student">Start the simulation</a>
        </div>
        <div className="panel home-path">
          <h2>For instructors</h2>
          <p className="muted">Change the assumptions without touching code.</p>
          <ul>
            <li>Edit scenarios, round order, asset returns, risk ratings, fees and score weights.</li>
            <li>Import a documented Excel workbook, check it row by row, preview it, then apply it.</li>
            <li>Export the configuration back to Excel and every session's results to CSV.</li>
            <li>Review and reset the demo sessions stored in this browser.</li>
          </ul>
          <a className="btn" href="#/instructor/settings">Open the instructor dashboard</a>
        </div>
      </section>

      <section className="home-note" aria-labelledby="about-heading">
        <h2 id="about-heading">About this project</h2>
        <p>
          SimuLab is an independent portfolio project showing how spreadsheet formulas and game rules can become tested web application logic.
          All scenarios are invented for teaching. The instructor view is a demonstration role switch, not access control: anyone using this
          browser can open it. Everything is stored locally in this browser; there is no server or account.
        </p>
      </section>
    </>
  );
}
