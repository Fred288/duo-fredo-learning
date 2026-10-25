import { expect, test } from '@playwright/test';

test('Startseite listet die Units', async ({ page }) => {
  await page.goto('/');
  await expect(page.getByRole('heading', { name: 'Yol' })).toBeVisible();
  await expect(page.getByRole('heading', { name: 'Alphabet und Begrüßung' })).toBeVisible();
});

test('komplette Lektion a1-u01-l1 durchspielen', async ({ page }) => {
  await page.goto('/');
  await page.getByRole('button', { name: /Begrüßen/ }).click();

  // Multiple Choice
  await page.getByText('Merhaba').click();
  await page.getByRole('button', { name: 'Prüfen' }).click();
  await expect(page.getByRole('status')).toContainText('Richtig!');
  await page.getByRole('button', { name: 'Weiter' }).click();

  // Wortbank
  await page.getByRole('button', { name: 'Günaydın', exact: true }).click();
  await page.getByRole('button', { name: 'Prüfen' }).click();
  await expect(page.getByRole('status')).toContainText('Richtig!');
  await page.keyboard.press('Enter');

  // Freitext per Tastatur
  await page.getByLabel('Deine Antwort').fill('Sağ ol');
  await page.keyboard.press('Enter');
  await expect(page.getByRole('status')).toContainText('Richtig!');
  await page.keyboard.press('Enter');

  await expect(page.getByRole('heading', { name: 'Lektion geschafft' })).toBeVisible();
  await expect(page.getByText('3 von 3 beim ersten Versuch richtig')).toBeVisible();
});
