import AxeBuilder from '@axe-core/playwright';
import { expect, test, type Page } from '@playwright/test';
import { startSimulation, submitAndContinue } from './helpers';

/** Automated WCAG 2.1 A/AA checks with axe-core. These catch many, not all, accessibility problems. */
async function expectNoViolations(page: Page, label: string) {
  const results = await new AxeBuilder({ page }).withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa']).analyze();
  const summary = results.violations.map((v) => `${v.impact}: ${v.id} (${v.nodes.length}) ${v.help}`);
  expect(summary, `${label} has accessibility violations`).toEqual([]);
}

test('home, student and results pages pass automated accessibility checks', async ({ page }) => {
  await page.goto('/');
  await expectNoViolations(page, 'Home');
  await page.goto('/#/student');
  await expectNoViolations(page, 'Start screen');
  await startSimulation(page);
  await expectNoViolations(page, 'Round 1');
  await page.getByRole('button', { name: 'Submit round 1' }).click();
  await expectNoViolations(page, 'Round review');
  await page.getByRole('button', { name: 'Continue to round 2' }).click();
  for (let round = 2; round <= 5; round += 1) await submitAndContinue(page, round, 5);
  await expectNoViolations(page, 'Results');
});

test('instructor tabs pass automated accessibility checks', async ({ page }) => {
  for (const tab of ['settings', 'assets', 'scenarios', 'spreadsheet', 'sessions']) {
    await page.goto(`/#/instructor/${tab}`);
    await expect(page.getByRole('heading', { level: 1, name: 'Instructor workspace' })).toBeVisible();
    await expectNoViolations(page, `Instructor ${tab}`);
  }
  await page.goto('/#/instructor/spreadsheet');
  await page.getByLabel('Choose an .xlsx workbook').setInputFiles('samples/SimuLab_Invalid_Example.xlsx');
  await expect(page.getByRole('table', { name: 'Problems found' })).toBeVisible();
  await expectNoViolations(page, 'Import errors');
  await page.getByLabel('Choose an .xlsx workbook').setInputFiles('samples/SimuLab_Example_RateCycle.xlsx');
  await expect(page.getByRole('table', { name: 'What changes if you apply this workbook' })).toBeVisible();
  await expectNoViolations(page, 'Import preview');
  await page.goto('/#/instructor/scenarios');
  await page.getByLabel('Round 1 Cash return').fill('900');
  await expect(page.getByRole('heading', { name: '1 problem to fix before saving' })).toBeVisible();
  await expectNoViolations(page, 'Unsaved changes with a problem');
});
