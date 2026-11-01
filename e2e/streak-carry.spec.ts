import { expect, test } from '@playwright/test';
import { openSettings, openToday } from './nav';

test('übernommene Serie erscheint auf „Heute“ und übersteht das Neuladen', async ({ page }) => {
  await page.goto('./');
  await openSettings(page);
  await page.getByLabel('Bisherige Serie (Tage)').fill('472');
  await openToday(page);
  await expect(page.getByText('472 Tage in Folge')).toBeVisible();

  await page.reload();
  await expect(page.getByText('472 Tage in Folge')).toBeVisible();

  await openSettings(page);
  await page.getByLabel('Bisherige Serie (Tage)').fill('');
  await openToday(page);
  await expect(page.getByText('472 Tage in Folge')).toHaveCount(0);
});
