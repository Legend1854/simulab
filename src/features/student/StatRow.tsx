import { Change } from '../../components/Change';
import { sessionStats } from '../../domain/progression';
import type { SimulationSession } from '../../domain/types';
import { formatCurrency, formatReturn, formatScore } from '../../utils/format';

export function StatRow({ session }: { session: SimulationSession }) {
  const stats = sessionStats(session);
  return (
    <dl className="panel stat-row" aria-label="Portfolio summary">
      <div className="stat">
        <dt>Portfolio value</dt>
        <dd>{formatCurrency(stats.currentBalance)}</dd>
      </div>
      <div className="stat">
        <dt>Total return so far</dt>
        <dd>
          {formatReturn(stats.totalReturn)}
          <span className="stat-note">
            {stats.roundsCompleted === 0 ? <span className="muted">No rounds yet</span> : <Change value={stats.currentBalance - session.config.startingBalance} kind="currency" />}
          </span>
        </dd>
      </div>
      <div className="stat">
        <dt>Average round score</dt>
        <dd>{stats.averageScore === null ? <small className="muted">No rounds yet</small> : <>{formatScore(stats.averageScore)} <small className="muted">/ 100</small></>}</dd>
      </div>
    </dl>
  );
}
