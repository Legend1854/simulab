import { expect, type Page } from '@playwright/test';

export const ASSETS = ['Cash', 'Government bonds', 'Diversified global equities', 'Technology equities'] as const;

/** The exact-text input for an asset (the slider has its own label, "<asset> slider"). */
export const allocationInput = (page: Page, asset: string) => page.getByRole('textbox', { name: asset, exact: true });

export async function setAllocation(page: Page, values: readonly [number, number, number, number]): Promise<void> {
  for (const [index, asset] of ASSETS.entries()) await allocationInput(page, asset).fill(String(values[index]));
}

export async function startSimulation(page: Page, nickname = 'E2E student'): Promise<void> {
  await page.goto('/#/student');
  await page.getByLabel('Nickname (optional)').fill(nickname);
  await page.getByRole('button', { name: 'Start round 1' }).click();
  await expect(page.getByRole('heading', { level: 1 })).toBeVisible();
}

/** Submits the current round and continues past the review step. */
export async function submitAndContinue(page: Page, round: number, totalRounds: number): Promise<void> {
  await page.getByRole('button', { name: `Submit round ${round}` }).click();
  await expect(page.getByRole('heading', { name: `Round ${round} result` })).toBeVisible();
  await page.getByRole('button', { name: round < totalRounds ? `Continue to round ${round + 1}` : 'See final results' }).click();
}
