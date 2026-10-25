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

test('Fortschritt und Einstellungen bleiben nach dem Neuladen erhalten', async ({ page }) => {
  await page.goto('/');
  await expect(page.getByText('Heute: 0 von 1 Lektionen')).toBeVisible();

  // Lektion abschließen
  await page.getByRole('button', { name: /Begrüßen/ }).click();
  await page.getByText('Merhaba').click();
  await page.keyboard.press('Enter');
  await page.keyboard.press('Enter');
  await page.getByRole('button', { name: 'Günaydın', exact: true }).click();
  await page.getByRole('button', { name: 'Prüfen' }).click();
  await page.keyboard.press('Enter');
  await page.getByLabel('Deine Antwort').fill('Sağ ol');
  await page.keyboard.press('Enter');
  await page.keyboard.press('Enter');
  await page.getByRole('button', { name: 'Zur Übersicht' }).click();

  await expect(page.getByText('Tagesziel erreicht')).toBeVisible();
  await expect(page.getByText('1 Tag in Folge')).toBeVisible();
  await expect(page.getByText('1 von 1 Lektionen')).toBeVisible();

  // Einstellungen ändern: Dunkelmodus, Serie aus
  await page.getByRole('button', { name: 'Einstellungen' }).click();
  await page.getByText('Dunkel', { exact: true }).click();
  await page.getByLabel('Serie anzeigen').uncheck();
  await expect(page.locator('html')).toHaveClass(/dark/);
  await page.getByRole('button', { name: /Zurück/ }).click();
  await expect(page.getByText('1 Tag in Folge')).toHaveCount(0);

  await page.reload();
  await expect(page.locator('html')).toHaveClass(/dark/);
  await expect(page.getByText('Tagesziel erreicht')).toBeVisible();
  await expect(page.getByText('1 Tag in Folge')).toHaveCount(0);
  await expect(page.getByText('1 von 1 Lektionen')).toBeVisible();
});

test('Suffix-Builder: richtige und falsche Form mit Begründung', async ({ page }) => {
  await page.goto('/');
  await page.getByRole('button', { name: /Endungen bauen/ }).click();

  // 1) ev + Plural
  await page.getByRole('button', { name: 'ev', exact: true }).click();
  await page.getByRole('button', { name: 'ler', exact: true }).click();
  await page.getByRole('button', { name: 'Prüfen' }).click();
  await expect(page.getByRole('status')).toContainText('Richtig!');
  await expect(page.getByRole('status')).toContainText('hell');
  await page.getByRole('button', { name: 'Weiter' }).click();

  // 2) okul + Plural + Lokativ, bewusst mit falscher Harmonie
  await page.getByRole('button', { name: 'okul', exact: true }).click();
  await page.getByRole('button', { name: 'ler', exact: true }).click();
  await page.getByRole('button', { name: 'Prüfen' }).click();
  await expect(page.getByRole('status')).toContainText('Leider falsch.');
  await expect(page.getByRole('status')).toContainText('Lösung: okullarda');
});
