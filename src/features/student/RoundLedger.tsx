import { EmptyState } from '../../components/EmptyState';
import type { SimulationSession } from '../../domain/types';
import { formatCurrency, formatReturn, formatScore } from '../../utils/format';

/** Round-by-round history: the decision and the recorded outcome. Also the data table behind the chart. */
export function RoundLedger({ session, caption = 'Round history' }: { session: SimulationSession; caption?: string }) {
  if (session.results.length === 0) {
    return <EmptyState title="No rounds submitted yet">Each submitted round is recorded here with your allocation and its result.</EmptyState>;
  }
  const { config } = session;
  return (
    <div className="table-wrap">
      <table className="table">
        <caption>{caption}</caption>
        <thead>
          <tr>
            <th scope="col">Round</th>
            <th scope="col">Scenario</th>
            <th scope="col">Risk profile</th>
            <th scope="col">Allocation</th>
            <th scope="col" className="num">Net return</th>
            <th scope="col" className="num">Ending balance</th>
            <th scope="col" className="num">Performance</th>
            <th scope="col" className="num">Risk fit</th>
            <th scope="col" className="num">Diversification</th>
            <th scope="col" className="num">Overall</th>
          </tr>
        </thead>
        <tbody>
          {session.results.map((result) => (
            <tr key={result.round}>
              <th scope="row">{result.round}</th>
              <td>{result.scenarioTitle}</td>
              <td>{config.riskProfiles.find((p) => p.id === result.decision.riskProfileId)?.name ?? result.decision.riskProfileId}</td>
              <td>
                {config.assets
                  .filter((asset) => (result.decision.allocationPct[asset.id] ?? 0) > 0)
                  .map((asset) => `${asset.name} ${result.decision.allocationPct[asset.id]}%`)
                  .join(', ')}
              </td>
              <td className="num">
                <span aria-hidden="true">{result.netReturn > 0 ? '▲ ' : result.netReturn < 0 ? '▼ ' : ''}</span>
                {formatReturn(result.netReturn)}
              </td>
              <td className="num">{formatCurrency(result.endingBalance)}</td>
              <td className="num">{formatScore(result.scores.performance)}</td>
              <td className="num">{formatScore(result.scores.riskFit)}</td>
              <td className="num">{formatScore(result.scores.diversification)}</td>
              <td className="num"><strong>{formatScore(result.scores.overall)}</strong></td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
