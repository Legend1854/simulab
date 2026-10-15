import { resolve } from 'node:path';
import { writeFileSync } from 'node:fs';
import { expect, test } from '@playwright/test';
import { startSimulation } from './helpers';

const sample = (name: string) => resolve(process.cwd(), 'samples', name);

test.describe('instructor journey', () => {
  test('downloads the template and imports it back after a preview and confirmation', async ({ page }, testInfo) => {
    await page.goto('/#/instructor/spreadsheet');
    const downloadPromise = page.waitForEvent('download');
    await page.getByRole('button', { name: 'Download current configuration (.xlsx)' }).click();
    const download = await downloadPromise;
    expect(download.suggestedFilename()).toBe('Five-year-portfolio-challenge.xlsx');
    const saved = testInfo.outputPath('template.xlsx');
    await download.saveAs(saved);

    // 9. Import a valid instructor template
    await page.getByLabel('Choose an .xlsx workbook').setInputFiles(saved);
    await expect(page.getByText('Preview: Five-year portfolio challenge')).toBeVisible();
    await expect(page.getByText('Valid, not yet applied')).toBeVisible();
    await page.getByRole('button', { name: 'Apply configuration' }).click();
    await page.getByRole('alertdialog').getByRole('button', { name: 'Apply configuration' }).click();
    await expect(page.getByText('Configuration applied')).toBeVisible();
  });

  test('an imported example workbook changes the next simulation', async ({ page }) => {
    await page.goto('/#/instructor/spreadsheet');
    await page.getByLabel('Choose an .xlsx workbook').setInputFiles(sample('SimuLab_Example_RateCycle.xlsx'));
    await expect(page.getByRole('table', { name: /Scenario returns by round/ }).getByRole('row')).toHaveCount(7);
    await page.getByRole('button', { name: 'Apply configuration' }).click();
    await page.getByRole('alertdialog').getByRole('button', { name: 'Apply configuration' }).click();

    await startSimulation(page);
    await expect(page.getByText('Round 1 of 6', { exact: true })).toBeVisible();
    await expect(page.getByText('Expansion', { exact: true })).toBeVisible();
    await expect(page.getByRole('heading', { level: 1, name: 'Soft landing' })).toBeVisible();
    await expect(page.getByText('$25,000.00').first()).toBeVisible();
  });

  test('rejects an invalid workbook with readable, row-level errors', async ({ page }) => {
    await page.goto('/#/instructor/spreadsheet');
    await page.getByLabel('Choose an .xlsx workbook').setInputFiles(sample('SimuLab_Invalid_Example.xlsx'));
    await expect(page.getByRole('alert').filter({ hasText: 'The workbook was not imported. Fix these 4 problems and try again.' })).toBeVisible();
    const problems = page.getByRole('table', { name: 'Problems found' });
    await expect(problems.getByRole('row')).toHaveCount(5);
    await expect(problems).toContainText('Duplicate asset ID "bonds" (already used on row 3).');
    await expect(problems).toContainText('"ReturnPct" must be a number, but it contains "five".');
    await expect(problems.getByRole('row').filter({ hasText: 'five' })).toContainText('Returns!C3');
    await expect(page.getByText('The current configuration has not changed.')).toBeVisible();
  });

  test('rejects a file that is not really a workbook', async ({ page }, testInfo) => {
    const fake = testInfo.outputPath('renamed.xlsx');
    writeFileSync(fake, 'Round,Return\n1,8\n');
    await page.goto('/#/instructor/spreadsheet');
    await page.getByLabel('Choose an .xlsx workbook').setInputFiles(fake);
    await expect(page.getByText(/This file is not a valid \.xlsx workbook/)).toBeVisible();
  });

  test('editing the fee in the dashboard changes the next simulation', async ({ page }) => {
    await page.goto('/#/instructor/settings');
    await page.getByLabel('Annual management fee').fill('2');
    await page.getByRole('button', { name: 'Save configuration' }).click();
    await expect(page.getByText(/Configuration saved/)).toBeVisible();
    await startSimulation(page);
    await expect(page.getByText(/a 2% annual fee is then deducted/)).toBeVisible();
    await expect(page.getByTestId('projection-summary')).toContainText('Ending balance $10,525.00');
  });

  test('deleting all sessions needs confirmation', async ({ page }) => {
    await startSimulation(page, 'To delete');
    await page.goto('/#/instructor/sessions');
    await expect(page.getByRole('rowheader', { name: /To delete/ })).toBeVisible();
    await page.getByRole('button', { name: 'Delete all sessions' }).click();
    await page.getByRole('alertdialog').getByRole('button', { name: 'Cancel' }).click();
    await expect(page.getByRole('rowheader', { name: /To delete/ })).toBeVisible();
    await page.getByRole('button', { name: 'Delete all sessions' }).click();
    await page.getByRole('alertdialog').getByRole('button', { name: 'Delete all sessions' }).click();
    await expect(page.getByText('No sessions yet')).toBeVisible();
  });

  test('the validation summary takes a keyboard user straight to the field to fix', async ({ page }) => {
    await page.goto('/#/instructor/scenarios');
    await page.getByLabel('Round 2 Technology equities return').fill('-120');
    await expect(page.getByRole('heading', { name: '1 problem to fix before saving' })).toBeVisible();
    await expect(page.getByRole('button', { name: 'Save configuration' })).toBeDisabled();
    await page.getByRole('link', { name: /Settings and scoring/ }).click();
    await expect(page.getByLabel('Annual management fee')).toBeVisible();

    const problem = page.getByRole('button', { name: /Round 2 \(A sudden sell-off\) return for "tech_equities"/ });
    await problem.focus();
    await page.keyboard.press('Enter');
    await expect(page).toHaveURL(/#\/instructor\/scenarios$/);
    await expect(page.getByLabel('Round 2 Technology equities return')).toBeFocused();
    await page.keyboard.press('Control+A');
    await page.keyboard.type('-28');
    await expect(page.getByRole('region', { name: 'Unsaved changes' })).toContainText('Everything checks out');
    await expect(page.getByRole('button', { name: 'Save configuration' })).toBeEnabled();
  });
});
