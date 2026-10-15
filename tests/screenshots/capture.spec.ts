import { resolve } from 'node:path';
import { expect, test } from '@playwright/test';
import { setAllocation, startSimulation, submitAndContinue } from '../e2e/helpers';

const shot = (name: string) => resolve(process.cwd(), 'docs/screenshots', `${name}.png`);

test('capture README screenshots', async ({ page, browser }) => {
  await page.goto('/');
  await page.screenshot({ path: shot('01-home') });

  await startSimulation(page, 'Demo student');
  await setAllocation(page, [15, 25, 40, 20]);
  await page.screenshot({ path: shot('02-round-decision'), fullPage: true });

  await page.getByRole('button', { name: 'Submit round 1' }).click();
  await expect(page.getByRole('heading', { name: 'Round 1 result' })).toBeVisible();
  await page.screenshot({ path: shot('03-round-result'), fullPage: true });

  await page.getByRole('button', { name: 'Continue to round 2' }).click();
  await setAllocation(page, [30, 30, 30, 10]);
  await page.screenshot({ path: shot('04-round-2-with-history'), fullPage: true });
  for (let round = 2; round <= 5; round += 1) await submitAndContinue(page, round, 5);
  await page.screenshot({ path: shot('05-final-results'), fullPage: true });

  await page.goto('/#/instructor/scenarios');
  await page.getByRole('button', { name: 'Edit round 2' }).click();
  await page.getByLabel('Technology equities').fill('-35');
  await page.screenshot({ path: shot('06-instructor-scenarios-draft'), fullPage: true });
  await page.getByRole('button', { name: 'Discard changes' }).click();
  await page.getByRole('alertdialog').getByRole('button', { name: 'Discard changes' }).click();

  await page.goto('/#/instructor/spreadsheet');
  await page.getByLabel('Choose an .xlsx workbook').setInputFiles('samples/SimuLab_Invalid_Example.xlsx');
  await expect(page.getByRole('table', { name: 'Problems found' })).toBeVisible();
  await page.screenshot({ path: shot('07-import-errors'), fullPage: true });

  await page.getByLabel('Choose an .xlsx workbook').setInputFiles('samples/SimuLab_Example_RateCycle.xlsx');
  await expect(page.getByText('Valid, not yet applied')).toBeVisible();
  await page.screenshot({ path: shot('08-import-preview'), fullPage: true });

  await page.goto('/#/instructor/sessions');
  await page.getByRole('button', { name: /View history/ }).first().click();
  await page.screenshot({ path: shot('09-instructor-sessions'), fullPage: true });

  const phone = await browser.newPage({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 2 });
  await phone.goto('/#/student');
  await phone.getByRole('button', { name: 'Start round 1' }).click();
  await phone.screenshot({ path: shot('10-mobile-round'), fullPage: false });
  await phone.close();
});
