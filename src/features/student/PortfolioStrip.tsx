import { Change } from '../../components/Change';
import { sessionStats } from '../../domain/progression';
import type { SimulationSession } from '../../domain/types';
import { formatCurrency, formatReturn, formatScore } from '../../utils/format';

/** The running position: recorded figures only, never the projection. */
export function PortfolioStrip({ session }: { session: SimulationSession }) {
  const stats = sessionStats(session);
  return (
    <dl className="strip" aria-label="Your portfolio so far">
      <div>
        <dt>Portfolio value</dt>
        <dd className="num">{formatCurrency(stats.currentBalance)}</dd>
      </div>
      <div>
        <dt>Total return so far</dt>
        <dd className="num">
          {stats.roundsCompleted === 0 ? <span className="muted">No rounds yet</span> : (
            <>
              {formatReturn(stats.totalReturn)} <Change value={stats.currentBalance - session.config.startingBalance} kind="currency" />
            </>
          )}
        </dd>
      </div>
      <div>
        <dt>Average round score</dt>
        <dd className="num">{stats.averageScore === null ? <span className="muted">No rounds yet</span> : <>{formatScore(stats.averageScore)} <span className="muted">/ 100</span></>}</dd>
      </div>
    </dl>
  );
}
