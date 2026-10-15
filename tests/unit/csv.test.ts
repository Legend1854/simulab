import { describe, expect, it } from 'vitest';
import { startSession, submitRound } from '../../src/domain/progression';
import { guardText, sessionsToCsv } from '../../src/services/exports/csv';
import { safeFilename } from '../../src/services/exports/download';
import { cloneConfig, decision, EQUAL_ALLOCATION, NOW } from '../helpers';

describe('CSV export', () => {
  const session = submitRound(startSession({ config: cloneConfig(), participantLabel: 'Ana', id: 'sess_x', now: NOW }), decision(1, EQUAL_ALLOCATION), NOW);

  it('writes one header row plus one row per submitted round, with deliberate rounding', () => {
    const [header, row] = sessionsToCsv([session]).split('\r\n');
    expect(header).toContain('"Allocation: Diversified global equities (%)"');
    expect(row).toContain('"10000.00"');
    expect(row).toContain('"7.2500"'); // gross return %
    expect(row).toContain('"10675.00"');
    expect(row).toContain('"79.69"'); // overall score 79.6875 rounded for export only
  });

  it('neutralises spreadsheet formulas in free text', () => {
    expect(guardText('=SUM(A1)')).toBe("'=SUM(A1)");
    expect(guardText('+61 400')).toBe("'+61 400");
    expect(guardText('Ana')).toBe('Ana');
    const hostile = submitRound(startSession({ config: cloneConfig(), participantLabel: '=HYPERLINK("http://x")', id: 's', now: NOW }), decision(1, EQUAL_ALLOCATION), NOW);
    expect(sessionsToCsv([hostile])).toContain(`"'=HYPERLINK(""http://x"")"`);
  });

  it('produces only a header when there are no results', () => {
    expect(sessionsToCsv([]).split('\r\n')).toHaveLength(1);
  });

  it('makes safe filenames', () => {
    expect(safeFilename('Rate-cycle pack (fictional)', 'x')).toBe('Rate-cycle-pack-fictional');
    expect(safeFilename('///', 'fallback')).toBe('fallback');
  });
});
