import type { SimulationSession } from '../../domain/types';

/**
 * Spreadsheet programs can execute cell text that starts with = + - @ (CSV formula injection).
 * Free text such as participant nicknames and scenario titles gets a leading single quote when it
 * starts with one of those characters; Excel then displays it as plain text.
 */
export function guardText(text: string): string {
  return /^[=+\-@\t\r]/.test(text) ? `'${text}` : text;
}

const quote = (value: string | number): string => `"${String(value).replaceAll('"', '""')}"`;

/** Rounding for export only; the stored results keep full precision. */
const fixed = (value: number, digits: number): string => value.toFixed(digits);

/** One row per submitted round, across any number of sessions (which may use different configurations). */
export function sessionsToCsv(sessions: ReadonlyArray<SimulationSession>): string {
  const assetOrder: Array<{ id: string; name: string }> = [];
  for (const session of sessions) {
    for (const asset of session.config.assets) {
      if (!assetOrder.some((known) => known.id === asset.id)) assetOrder.push({ id: asset.id, name: asset.name });
    }
  }
  const headers = [
    'Session ID', 'Participant', 'Session status', 'Configuration', 'Round', 'Scenario', 'Risk profile',
    ...assetOrder.map((asset) => `Allocation: ${guardText(asset.name)} (%)`),
    'Starting balance (AUD)', 'Gross return (%)', 'Fee (%)', 'Net return (%)', 'Ending balance (AUD)',
    'Portfolio risk', 'Target risk', 'HHI',
    'Performance score', 'Risk-fit score', 'Diversification score', 'Overall score', 'Submitted at (UTC)',
  ];
  const rows: Array<Array<string | number>> = [];
  for (const session of sessions) {
    for (const result of session.results) {
      const profile = session.config.riskProfiles.find((candidate) => candidate.id === result.decision.riskProfileId);
      rows.push([
        session.id,
        guardText(session.participantLabel),
        session.status,
        guardText(session.config.name),
        result.round,
        guardText(result.scenarioTitle),
        guardText(profile?.name ?? result.decision.riskProfileId),
        ...assetOrder.map((asset) => result.decision.allocationPct[asset.id] ?? ''),
        fixed(result.startingBalance, 2),
        fixed(result.grossReturn * 100, 4),
        fixed(result.feeRate * 100, 4),
        fixed(result.netReturn * 100, 4),
        fixed(result.endingBalance, 2),
        fixed(result.portfolioRisk, 2),
        fixed(result.targetRisk, 2),
        fixed(result.hhi, 4),
        fixed(result.scores.performance, 2),
        fixed(result.scores.riskFit, 2),
        fixed(result.scores.diversification, 2),
        fixed(result.scores.overall, 2),
        result.submittedAt,
      ]);
    }
  }
  return [headers, ...rows].map((row) => row.map(quote).join(',')).join('\r\n');
}
