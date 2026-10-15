import { resolve } from 'node:path';
import { expect, test, type Page } from '@playwright/test';
import { setAllocation, startSimulation, submitAndContinue } from '../e2e/helpers';

const path = (name: string) => resolve(process.cwd(), 'docs/screenshots', `${name}.png`);

/** Full-page capture from the top, without a focus ring left on whatever was clicked or typed into last. */
async function shot(page: Page, name: string, fullPage = true): Promise<void> {
  await page.evaluate(() => {
    (document.activeElement as HTMLElement | null)?.blur();
    window.scrollTo(0, 0);
  });
  await page.screenshot({ path: path(name), fullPage });
}

test('capture README screenshots', async ({ page, browser }) => {
  await page.goto('/');
  await expect(page.getByRole('heading', { level: 1 })).toBeVisible();
  await shot(page, '01-home');

  await page.goto('/#/student');
  await expect(page.getByRole('heading', { level: 1, name: 'Start the simulation' })).toBeVisible();
  await shot(page, '02-student-start');

  await startSimulation(page, 'Demo student');
  await setAllocation(page, [15, 25, 40, 20]);
  await expect(page.getByText('Allocation totals 100% and is ready to submit.')).toBeVisible();
  await shot(page, '03-round-decision');

  await page.getByRole('button', { name: 'Submit round 1' }).click();
  await expect(page.getByRole('heading', { name: 'Round 1 result' })).toBeVisible();
  await shot(page, '04-round-result');

  await page.getByRole('button', { name: 'Continue to round 2' }).click();
  await setAllocation(page, [30, 30, 30, 10]);
  await shot(page, '05-round-2-with-history');
  for (let round = 2; round <= 5; round += 1) await submitAndContinue(page, round, 5);
  await expect(page.getByRole('button', { name: 'Export my results (CSV)' })).toBeVisible();
  await shot(page, '06-final-results');

  await page.goto('/#/instructor/scenarios');
  await page.getByLabel('Round 2 Technology equities return').fill('-135');
  await expect(page.getByRole('heading', { name: '1 problem to fix before saving' })).toBeVisible();
  await shot(page, '07-instructor-scenarios');
  await page.getByRole('button', { name: 'Discard changes' }).click();
  await page.getByRole('alertdialog').getByRole('button', { name: 'Discard changes' }).click();

  await page.goto('/#/instructor/spreadsheet');
  await page.getByLabel('Choose an .xlsx workbook').setInputFiles('samples/SimuLab_Invalid_Example.xlsx');
  await expect(page.getByRole('table', { name: 'Problems found' })).toBeVisible();
  await shot(page, '08-import-validation');

  await page.getByLabel('Choose an .xlsx workbook').setInputFiles('samples/SimuLab_Example_RateCycle.xlsx');
  await expect(page.getByText('Valid, not yet applied')).toBeVisible();
  await shot(page, '09-import-preview');

  await page.goto('/#/instructor/sessions');
  await page.getByRole('button', { name: /Show rounds/ }).first().click();
  await shot(page, '10-instructor-sessions');

  const phone = await browser.newPage({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 2 });
  await phone.goto('/#/student');
  await phone.getByRole('button', { name: 'Start round 1' }).click();
  await expect(phone.getByRole('heading', { level: 1, name: 'A steady start' })).toBeVisible();
  await shot(phone, '11-mobile-round', false);
  await shot(phone, '12-mobile-round-full');
  await phone.close();
});
