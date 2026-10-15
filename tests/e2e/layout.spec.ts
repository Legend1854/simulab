import { expect, test, type Page } from '@playwright/test';
import { setAllocation, startSimulation, submitAndContinue } from './helpers';

/**
 * Layout checks at the widths the redesign was reviewed at. Each page must fit the viewport:
 * wide tables may scroll inside their own container, but the page itself never scrolls sideways.
 */
const VIEWPORTS = [
  { name: 'desktop 1440', width: 1440, height: 900 },
  { name: 'laptop 1280', width: 1280, height: 800 },
  { name: 'tablet 820', width: 820, height: 1180 },
  { name: 'phone 390', width: 390, height: 844 },
  { name: 'small phone 360', width: 360, height: 800 },
] as const;

const horizontalOverflow = (page: Page) => page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);

for (const viewport of VIEWPORTS) {
  test.describe(viewport.name, () => {
    test.use({ viewport: { width: viewport.width, height: viewport.height } });

    test('student pages fit the screen', async ({ page }) => {
      const check = async (label: string) => expect(await horizontalOverflow(page), `${label} at ${viewport.width}px`).toBe(0);
      await page.goto('/');
      await expect(page.getByRole('heading', { level: 1 })).toBeVisible();
      await check('home');
      await page.goto('/#/student');
      await check('start screen');
      await startSimulation(page);
      await setAllocation(page, [15, 25, 40, 20]);
      await check('round 1 with a valid allocation');
      await page.getByRole('button', { name: 'Submit round 1' }).click();
      await expect(page.getByRole('heading', { name: 'Round 1 result' })).toBeVisible();
      await check('round 1 result');
      await page.getByRole('button', { name: 'Continue to round 2' }).click();
      for (let round = 2; round <= 5; round += 1) await submitAndContinue(page, round, 5);
      await expect(page.getByRole('button', { name: 'Export my results (CSV)' })).toBeVisible();
      await check('final results');
    });

    test('instructor pages fit the screen', async ({ page }) => {
      for (const tab of ['settings', 'assets', 'scenarios', 'spreadsheet', 'sessions']) {
        await page.goto(`/#/instructor/${tab}`);
        await expect(page.getByRole('heading', { level: 1, name: 'Instructor workspace' })).toBeVisible();
        expect(await horizontalOverflow(page), `instructor ${tab} at ${viewport.width}px`).toBe(0);
      }
      await page.goto('/#/instructor/spreadsheet');
      await page.getByLabel('Choose an .xlsx workbook').setInputFiles('samples/SimuLab_Invalid_Example.xlsx');
      await expect(page.getByRole('table', { name: 'Problems found' })).toBeVisible();
      expect(await horizontalOverflow(page), `import errors at ${viewport.width}px`).toBe(0);
    });
  });
}
