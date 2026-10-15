import { expect, test } from '@playwright/test';
import { setAllocation, startSimulation } from './helpers';

test('a round can be completed on a phone-sized screen without horizontal scrolling', async ({ page }) => {
  await page.goto('/');
  const overflow = () => page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
  expect(await overflow()).toBe(0);
  await startSimulation(page);
  expect(await overflow()).toBe(0);
  await setAllocation(page, [10, 30, 40, 20]);
  await page.getByRole('button', { name: 'Submit round 1' }).click();
  await expect(page.getByRole('heading', { name: 'Round 1 result' })).toBeVisible();
  expect(await overflow()).toBe(0);
  await page.goto('/#/instructor/scenarios');
  await expect(page.getByRole('heading', { level: 1, name: 'Instructor dashboard' })).toBeVisible();
  expect(await overflow()).toBe(0); // wide tables scroll inside their own container
});
