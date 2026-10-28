import { expect, test } from '@playwright/test';
import { playLesson } from './solve';

test('Sicherung speichern und auf einem leeren Gerät laden', async ({ page, browser }) => {
  await page.goto('/');
  await playLesson(page, 'a1-u01', 'a1-u01-l1');
  await page.getByRole('button', { name: 'Zur Übersicht' }).click();
  await expect(page.getByText('1 von 4 Lektionen')).toBeVisible();

  await page.getByRole('button', { name: 'Einstellungen' }).click();
  await expect(page.getByText('Noch keine Sicherung gespeichert.')).toBeVisible();
  const downloading = page.waitForEvent('download');
  await page.getByRole('button', { name: 'Sicherung speichern' }).click();
  const download = await downloading;
  expect(download.suggestedFilename()).toMatch(/^yol-backup-\d{4}-\d{2}-\d{2}\.json$/);
  const file = await download.path();
  await expect(page.getByText('Sicherung gespeichert.')).toBeVisible();
  await expect(page.getByText(/^Letzte Sicherung: \d{2}\.\d{2}\.\d{4}$/)).toBeVisible();

  // Neuer Kontext = leere IndexedDB, wie ein anderes Gerät.
  const other = await browser.newContext();
  const fresh = await other.newPage();
  await fresh.goto('/');
  await expect(fresh.getByText('0 von 4 Lektionen')).toBeVisible();
  await fresh.getByRole('button', { name: 'Einstellungen' }).click();
  await fresh.getByLabel('Sicherung laden').setInputFiles(file);
  await expect(fresh.getByText(/^Sicherung vom /)).toBeVisible();
  await expect(fresh.getByRole('radio', { name: /Zusammenführen/ })).toBeChecked();
  await fresh.getByRole('button', { name: 'Laden', exact: true }).click();
  await expect(fresh.getByText('Sicherung geladen.')).toBeVisible();

  await fresh.getByRole('button', { name: /Zurück/ }).click();
  await expect(fresh.getByText('1 von 4 Lektionen')).toBeVisible();
  // Bleibt nach dem Neuladen erhalten (in IndexedDB geschrieben).
  await fresh.reload();
  await expect(fresh.getByText('1 von 4 Lektionen')).toBeVisible();
  await other.close();
});

test('Ersetzen fragt nach; fremde Datei wird abgelehnt', async ({ page }) => {
  await page.goto('/');
  await page.getByRole('button', { name: 'Einstellungen' }).click();
  const input = page.getByLabel('Sicherung laden');

  await input.setInputFiles({
    name: 'fremd.json',
    mimeType: 'application/json',
    buffer: Buffer.from(JSON.stringify({ hallo: 'welt' })),
  });
  await expect(page.getByRole('alert')).toHaveText('Die Datei ist keine Sicherung von Yol.');

  const backup = {
    format: 'yol-backup',
    version: 1,
    exportedAt: '2026-10-01T08:00:00.000Z',
    app: { dbVersion: 3 },
    data: { settings: { dailyGoal: 4 }, attempts: [], completions: [], cards: [], notes: [] },
  };
  await input.setInputFiles({
    name: 'yol.json',
    mimeType: 'application/json',
    buffer: Buffer.from(JSON.stringify(backup)),
  });
  await expect(page.getByText('Sicherung vom 01.10.2026')).toBeVisible();
  await page.getByRole('radio', { name: /Ersetzen/ }).check();
  await page.getByRole('button', { name: 'Laden', exact: true }).click();
  await expect(page.getByRole('alert')).toContainText('Wirklich ersetzen?');
  await page.getByRole('button', { name: 'Ja, ersetzen' }).click();
  await expect(page.getByText('Sicherung geladen.')).toBeVisible();
  // Einstellungen kommen beim Ersetzen aus der Datei.
  await expect(page.getByRole('group', { name: /Tagesziel/ }).locator('output')).toHaveText('4');
});
