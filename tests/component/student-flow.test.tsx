import { act, screen, within } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { activeSessionOf, createAppStore } from '../../src/app/store';
import { MemoryStore } from '../../src/services/persistence/storage';
import { decision, EQUAL_ALLOCATION } from '../helpers';
import { renderApp } from './render';

const setAllocation = async (user: ReturnType<typeof renderApp>['user'], values: [number, number, number, number]) => {
  const names = ['Cash', 'Government bonds', 'Diversified global equities', 'Technology equities'];
  for (const [index, name] of names.entries()) {
    const input = screen.getByLabelText(name, { selector: 'input[type=text]' });
    await user.clear(input);
    await user.type(input, String(values[index]));
  }
};

describe('student flow', () => {
  it('starts, validates the allocation next to the fields, and blocks invalid submissions', async () => {
    const { user } = renderApp('#/student');
    await user.click(screen.getByRole('button', { name: 'Start round 1' }));
    expect(screen.getByRole('heading', { level: 1, name: 'A steady start' })).toBeInTheDocument();

    const cash = screen.getByLabelText('Cash', { selector: 'input[type=text]' });
    await user.clear(cash);
    await user.type(cash, '120');
    expect(screen.getByText('Cash must be between 0% and 100%.')).toBeInTheDocument();
    expect(cash).toHaveAttribute('aria-invalid', 'true');
    expect(screen.getByRole('button', { name: 'Submit round 1' })).toBeDisabled();

    await user.clear(cash);
    await user.type(cash, '10');
    expect(screen.getByText(/You have 15% left to allocate/)).toBeInTheDocument();
    expect(screen.queryByText(/Projected ending balance/)).not.toBeInTheDocument();
  });

  it('updates the projection live, submits, reviews the result, then continues to round 2', async () => {
    const { user, store } = renderApp('#/student');
    await user.click(screen.getByRole('button', { name: 'Start round 1' }));
    await setAllocation(user, [15, 25, 40, 20]);

    const projection = screen.getByRole('region', { name: 'Projected result for round 1' });
    expect(within(projection).getByText('Projection, not submitted')).toBeInTheDocument();
    // Shown in the headline figure and as the result of the last calculation step.
    expect(within(projection).getAllByText('$10,700.00')).toHaveLength(2);
    expect(screen.getByTestId('projection-summary')).toHaveTextContent('Ending balance $10,700.00, round score 82.8');
    expect(activeSessionOf(store.getState())?.results).toHaveLength(0); // projection records nothing

    await user.click(screen.getByRole('button', { name: 'Submit round 1' }));
    const result = screen.getByRole('article', { name: 'Round 1 result' });
    expect(within(result).getByText('Submitted')).toBeInTheDocument();
    expect(within(result).queryByText('Projection, not submitted')).not.toBeInTheDocument();
    // Headline figure, the round statement's last line, and the last calculation step all agree.
    expect(within(result).getAllByText('$10,700.00')).toHaveLength(3);
    const statement = within(result).getByRole('table', { name: 'Round statement' });
    expect(within(statement).getByText('$10,700.00')).toBeInTheDocument();
    expect(activeSessionOf(store.getState())?.results).toHaveLength(1);

    await user.click(screen.getByRole('button', { name: 'Continue to round 2' }));
    expect(screen.getByRole('heading', { level: 1, name: 'A sudden sell-off' })).toBeInTheDocument();
    // The previous allocation carries over.
    expect(screen.getByLabelText('Diversified global equities', { selector: 'input[type=text]' })).toHaveValue('40');
    expect(screen.getByRole('heading', { name: 'Previous round' })).toBeInTheDocument();
  });

  it('records a round only once when the submit button is double-clicked', async () => {
    const { user, store } = renderApp('#/student');
    await user.click(screen.getByRole('button', { name: 'Start round 1' }));
    await user.dblClick(screen.getByRole('button', { name: 'Submit round 1' }));
    const session = activeSessionOf(store.getState());
    expect(session?.results).toHaveLength(1);
    expect(screen.getByRole('article', { name: 'Round 1 result' })).toBeInTheDocument();
  });

  it('completes all five rounds and shows the final results with a rating', async () => {
    const { user } = renderApp('#/student');
    await user.click(screen.getByRole('button', { name: 'Start round 1' }));
    for (let round = 1; round <= 5; round += 1) {
      await user.click(screen.getByRole('button', { name: `Submit round ${round}` }));
      await user.click(screen.getByRole('button', { name: round < 5 ? `Continue to round ${round + 1}` : 'See final results' }));
    }
    expect(screen.getByText('Simulation complete', { exact: false })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Export my results (CSV)' })).toBeEnabled();
    expect(screen.getByRole('table', { name: 'Your decisions and results' })).toBeInTheDocument();
    expect(within(screen.getByRole('table', { name: 'Your decisions and results' })).getAllByRole('row')).toHaveLength(6);
  });

  it('resumes an interrupted session from browser storage', async () => {
    const storage = new MemoryStore();
    const earlier = createAppStore({ storage, persistent: true });
    earlier.startSession('Returning');
    earlier.submitDecision(decision(1, EQUAL_ALLOCATION));
    earlier.submitDecision(decision(2, EQUAL_ALLOCATION));

    renderApp('#/student', storage);
    expect(screen.getByText('Welcome back')).toBeInTheDocument();
    expect(screen.getByText(/completed 2 of 5 rounds and can continue with round 3/)).toBeInTheDocument();
    expect(screen.getByRole('heading', { level: 1, name: 'Recovery takes hold' })).toBeInTheDocument();
  });

  it('asks for confirmation before abandoning a session, and Escape cancels', async () => {
    const { user, store } = renderApp('#/student');
    await user.click(screen.getByRole('button', { name: 'Start round 1' }));
    await user.click(screen.getByRole('button', { name: 'Start over' }));
    const dialog = screen.getByRole('alertdialog', { name: 'Start over?' });
    expect(within(dialog).getByRole('button', { name: 'Cancel' })).toHaveFocus();
    await user.keyboard('{Escape}');
    expect(screen.queryByRole('alertdialog')).not.toBeInTheDocument();
    expect(activeSessionOf(store.getState())?.status).toBe('in_progress');

    await user.click(screen.getByRole('button', { name: 'Start over' }));
    await user.click(screen.getByRole('button', { name: 'Abandon and start over' }));
    expect(screen.getByRole('heading', { level: 1, name: 'Start the simulation' })).toBeInTheDocument();
    expect(store.getState().sessions[0]?.status).toBe('abandoned');
  });

  it('renders imported text as text, never as HTML', async () => {
    const storage = new MemoryStore();
    const setup = createAppStore({ storage, persistent: true });
    const config = structuredClone(setup.getState().config);
    config.scenarios[0]!.title = '<img src=x onerror="window.__xss=1">';
    expect(setup.saveConfiguration(config).ok).toBe(true);
    const { user } = renderApp('#/student', storage);
    await user.click(screen.getByRole('button', { name: 'Start round 1' }));
    expect(screen.getByRole('heading', { level: 1 })).toHaveTextContent('<img src=x onerror="window.__xss=1">');
    expect(document.querySelector('img[src="x"]')).toBeNull();
    await act(async () => undefined);
  });
});
