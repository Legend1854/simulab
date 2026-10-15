import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { fireEvent, screen, within } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { activeSessionOf, createAppStore } from '../../src/app/store';
import { MemoryStore } from '../../src/services/persistence/storage';
import { decision, EQUAL_ALLOCATION } from '../helpers';
import { renderApp } from './render';

/** Selects a file in a file input. (user-event's upload() does not fire "change" with this jsdom version.) */
async function chooseFile(file: File): Promise<void> {
  const input = await screen.findByLabelText('Choose an .xlsx workbook');
  fireEvent.change(input, { target: { files: [file] } });
}

const sample = (name: string): File => {
  const bytes = readFileSync(resolve(process.cwd(), 'samples', name));
  return new File([bytes], name, { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
};

describe('instructor: settings and scoring', () => {
  it('labels the role switch honestly', async () => {
    renderApp('#/instructor/settings');
    expect(await screen.findByText(/demo role switch, not access control/)).toBeInTheDocument();
  });

  it('edits the fee as an unsaved change, saves it, and new sessions use it', async () => {
    const { user, store } = renderApp('#/instructor/settings');
    const fee = await screen.findByLabelText('Annual management fee');
    await user.clear(fee);
    await user.type(fee, '1.25');
    expect(screen.getByRole('region', { name: 'Unsaved changes' })).toHaveTextContent('Ready to save');
    expect(store.getState().config.annualFeePct).toBe(0.5); // nothing saved yet

    await user.click(screen.getByRole('button', { name: 'Save configuration' }));
    expect(screen.getByText(/Configuration saved. New simulations use it/)).toBeInTheDocument();
    expect(store.getState().config.annualFeePct).toBe(1.25);

    store.startSession('');
    expect(activeSessionOf(store.getState())?.config.annualFeePct).toBe(1.25);
  });

  it('validates as you type: weights must total 100%, and saving is blocked until fixed', async () => {
    const { user, store } = renderApp('#/instructor/settings');
    const weight = await screen.findByLabelText('Performance weight');
    await user.clear(weight);
    await user.type(weight, '60');
    expect(screen.getByText(/Weights total 110% \(must be exactly 100%\)/)).toBeInTheDocument();
    expect(screen.getByText('Score weights must total 100% (currently 110%).')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Save configuration' })).toBeDisabled();
    expect(screen.getByRole('region', { name: 'Unsaved changes' })).toHaveTextContent('Fix 1 problem before saving');

    await user.clear(weight);
    await user.type(weight, 'abc');
    expect(screen.getByText('Performance weight (%) must be a number.')).toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: 'Discard changes' }));
    await user.click(within(screen.getByRole('alertdialog')).getByRole('button', { name: 'Discard changes' }));
    expect(screen.getByLabelText('Performance weight')).toHaveValue('50');
    expect(store.getState().draft).toBeNull();
  });
});

describe('instructor: scenarios', () => {
  it('adds a scenario, reorders rounds and deletes with confirmation', async () => {
    const { user, store } = renderApp('#/instructor/scenarios');
    await user.click(await screen.findByRole('button', { name: 'Add scenario' }));
    expect(screen.getByRole('heading', { name: 'Editing round 6: New scenario' })).toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: 'Move up round 2' }));
    const firstRow = screen.getAllByRole('row')[1]!;
    expect(firstRow).toHaveTextContent('A sudden sell-off');

    await user.click(screen.getByRole('button', { name: 'Delete round 6' }));
    await user.click(within(screen.getByRole('alertdialog', { name: 'Delete round 6?' })).getByRole('button', { name: 'Delete scenario' }));
    await user.click(screen.getByRole('button', { name: 'Save configuration' }));
    expect(store.getState().config.scenarios.map((s) => s.id)).toEqual(['s2', 's1', 's3', 's4', 's5']);
  });

  it('flags an invalid return next to its field and on the scenario row', async () => {
    const { user } = renderApp('#/instructor/scenarios');
    const cash = await screen.findByLabelText('Cash');
    await user.clear(cash);
    await user.type(cash, '-150');
    expect(screen.getByText(/Round 1 \(A steady start\) return for "cash" must be at least -100/)).toBeInTheDocument();
    expect(screen.getAllByText('⚠ Needs attention')).toHaveLength(1);
  });
});

describe('instructor: spreadsheet import', () => {
  it('rejects an invalid workbook with row-level errors and leaves the configuration unchanged', async () => {
    const { store } = renderApp('#/instructor/spreadsheet');
    const before = structuredClone(store.getState().config);
    await chooseFile(sample('SimuLab_Invalid_Example.xlsx'));
    expect(await screen.findByText(/The workbook was not imported. Fix these 4 problems/)).toBeInTheDocument();
    const table = screen.getByRole('table', { name: 'Problems found' });
    expect(within(table).getByText('Duplicate asset ID "bonds" (already used on row 3).')).toBeInTheDocument();
    expect(within(table).getByText('"ReturnPct" must be a number, but it contains "five".')).toBeInTheDocument();
    expect(store.getState().config).toEqual(before);
  });

  it('previews a valid workbook and applies it only after confirmation', async () => {
    const { user, store } = renderApp('#/instructor/spreadsheet');
    await chooseFile(sample('SimuLab_Example_RateCycle.xlsx'));
    expect(await screen.findByText('Preview: Rate-cycle pack (fictional example)')).toBeInTheDocument();
    expect(screen.getByRole('table', { name: /Scenario returns by round/ })).toHaveTextContent('Credit scare');
    expect(store.getState().config.name).toBe('Five-year portfolio challenge');

    await user.click(screen.getByRole('button', { name: 'Apply configuration' }));
    await user.click(within(screen.getByRole('alertdialog')).getByRole('button', { name: 'Apply configuration' }));
    expect(screen.getByText('Configuration applied')).toBeInTheDocument();
    expect(store.getState().config.name).toBe('Rate-cycle pack (fictional example)');
    expect(store.getState().config.scenarios).toHaveLength(6);
  });

  it('rejects a file with the wrong extension', async () => {
    renderApp('#/instructor/spreadsheet');
    await chooseFile(new File(['a,b'], 'results.csv', { type: 'text/csv' }));
    expect(await screen.findByText(/Only .xlsx workbooks are supported/)).toBeInTheDocument();
  });
});

describe('instructor: sessions', () => {
  it('shows an empty state when there are no sessions', async () => {
    renderApp('#/instructor/sessions');
    expect(await screen.findByText('No sessions yet')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Export all results (CSV)' })).toBeDisabled();
  });

  it('lists stored sessions with their history, and deletes all after confirmation', async () => {
    const storage = new MemoryStore();
    const setup = createAppStore({ storage, persistent: true });
    setup.startSession('Ana');
    setup.submitDecision(decision(1, EQUAL_ALLOCATION));
    const { user, store } = renderApp('#/instructor/sessions', storage);
    const row = (await screen.findByRole('rowheader', { name: /Ana/ })).closest('tr')!;
    expect(row).toHaveTextContent('In progress');
    expect(row).toHaveTextContent('1 / 5');
    await user.click(within(row).getByRole('button', { name: 'View history for Ana' }));
    expect(screen.getByRole('table', { name: 'Round history: Ana' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Export all results (CSV)' })).toBeEnabled();

    await user.click(screen.getByRole('button', { name: 'Delete all sessions' }));
    await user.click(within(screen.getByRole('alertdialog')).getByRole('button', { name: 'Delete all sessions' }));
    expect(store.getState().sessions).toHaveLength(0);
    expect(screen.getByText('No sessions yet')).toBeInTheDocument();
  });
});
