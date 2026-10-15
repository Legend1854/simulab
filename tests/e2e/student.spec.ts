import { readFileSync } from 'node:fs';
import { expect, test } from '@playwright/test';
import { allocationInput, setAllocation, startSimulation, submitAndContinue } from './helpers';

test.describe('student journey', () => {
  test('load, choose the student experience, play all five rounds and export the results', async ({ page }) => {
    // 1. Load the application
    await page.goto('/');
    await expect(page.getByRole('heading', { level: 1, name: 'Five market rounds. Every number explained.' })).toBeVisible();
    await expect(page.getByText('It is not financial advice')).toBeVisible();

    // 2. Select the student experience
    await page.getByRole('link', { name: 'Start the simulation' }).first().click();
    await expect(page).toHaveURL(/#\/student$/);
    await page.getByLabel('Nickname (optional)').fill('E2E student');
    await page.getByRole('button', { name: 'Start round 1' }).click();
    await expect(page.getByRole('heading', { level: 1, name: 'A steady start' })).toBeVisible();

    // 3. Change allocations; the projection updates and is clearly marked as not submitted
    await setAllocation(page, [15, 25, 40, 20]);
    await expect(page.getByText('Allocation totals 100% and is ready to submit.')).toBeVisible();
    await expect(page.getByTestId('projection-summary')).toContainText('Ending balance $10,700.00, round score 82.8');
    await expect(page.getByText('Projection, not submitted')).toBeVisible();

    // 4 and 5. Submit a valid decision and see the calculated result
    await page.getByRole('button', { name: 'Submit round 1' }).click();
    const result = page.getByRole('region', { name: 'Round 1 result' });
    await expect(result.getByText('✓ Submitted')).toBeVisible();
    await expect(result.getByText('$10,700.00').first()).toBeVisible();
    await expect(result.getByText('Your portfolio risk of 60 matches the Balanced target exactly.')).toBeVisible();

    // 6. Progress to the next round
    await page.getByRole('button', { name: 'Continue to round 2' }).click();
    await expect(page.getByRole('heading', { level: 1, name: 'A sudden sell-off' })).toBeVisible();
    await expect(allocationInput(page, 'Diversified global equities')).toHaveValue('40');

    // 7. Complete the simulation (the allocation carries over each round)
    for (let round = 2; round <= 5; round += 1) await submitAndContinue(page, round, 5);
    await expect(page.getByText('Simulation complete: E2E student')).toBeVisible();
    await expect(page.getByText('Steady decision-maker', { exact: true })).toBeVisible();
    await expect(page.getByText('$10,805.89').first()).toBeVisible(); // matches the independently computed five-round balance

    // 8. Export results
    const downloadPromise = page.waitForEvent('download');
    await page.getByRole('button', { name: 'Export my results (CSV)' }).click();
    const download = await downloadPromise;
    expect(download.suggestedFilename()).toBe('E2E-student-results.csv');
    const csv = readFileSync((await download.path())!, 'utf8').replace(/^﻿/, '');
    const lines = csv.split('\r\n');
    expect(lines).toHaveLength(6);
    expect(lines[0]).toContain('"Ending balance (AUD)"');
    expect(lines[1]).toContain('"10700.00"');
    expect(lines[5]).toContain('"10805.89"');
  });

  test('an invalid allocation cannot be submitted and the problem is explained beside the field', async ({ page }) => {
    await startSimulation(page);
    await allocationInput(page, 'Cash').fill('130');
    await expect(page.getByText('Cash must be between 0% and 100%.')).toBeVisible();
    await expect(page.getByRole('button', { name: 'Submit round 1' })).toBeDisabled();
    await allocationInput(page, 'Cash').fill('30'); // 30 + 25 + 25 + 25 = 105
    await expect(page.getByText('Allocations must total 100%. You have 5% over the limit.')).toBeVisible();
    await expect(page.getByRole('button', { name: 'Submit round 1' })).toBeDisabled();
  });

  test('a rapid double click records the round once', async ({ page }) => {
    await startSimulation(page);
    await page.getByRole('button', { name: 'Submit round 1' }).dblclick();
    await expect(page.getByRole('heading', { name: 'Round 1 result' })).toBeVisible();
    await page.getByRole('button', { name: 'Continue to round 2' }).click();
    await expect(page.getByRole('table', { name: 'Round history' }).getByRole('row')).toHaveCount(2); // header + one round
  });

  test('an interrupted session is restored after a reload', async ({ page }) => {
    await startSimulation(page);
    await submitAndContinue(page, 1, 5);
    await page.reload();
    await expect(page.getByText('Welcome back')).toBeVisible();
    await expect(page.getByRole('heading', { level: 1, name: 'A sudden sell-off' })).toBeVisible();
  });

  test('the whole round can be played with the keyboard only', async ({ page }) => {
    await page.goto('/#/student');
    await page.getByLabel('Nickname (optional)').focus();
    await page.keyboard.type('Keys');
    await page.keyboard.press('Enter');
    await expect(page.getByRole('heading', { level: 1, name: 'A steady start' })).toBeVisible();
    const cash = allocationInput(page, 'Cash');
    await cash.focus();
    await page.keyboard.press('Control+A');
    await page.keyboard.type('40');
    await expect(page.getByText(/15% over the limit/)).toBeVisible();
    await page.keyboard.press('Shift+Tab'); // the Cash slider
    for (let i = 0; i < 15; i += 1) await page.keyboard.press('ArrowLeft');
    await expect(cash).toHaveValue('25');
    const submit = page.getByRole('button', { name: 'Submit round 1' });
    await submit.focus();
    await page.keyboard.press('Enter');
    await expect(page.getByRole('heading', { name: 'Round 1 result' })).toBeFocused();
  });
});
