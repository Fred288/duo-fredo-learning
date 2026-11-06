import { expect, test } from '@playwright/test';
import { openUnit } from './nav';
import { playLesson } from './solve';

test('Übungstext: Angebot nach der Lektion, lesen, übersetzen, zurück zur Unit', async ({
  page,
}) => {
  await page.goto('/');
  await playLesson(page, 'a1-u02', 'a1-u02-l1');
  await page.getByRole('button', { name: 'Einen Text lesen' }).click();

  // Fokusbereich ohne Navigation; die Überschrift ist der Titel des Textes.
  await expect(page.getByRole('heading', { name: 'Wo ist was?', level: 1 })).toBeVisible();
  await expect(page.getByRole('navigation', { name: 'Hauptnavigation' })).toHaveCount(0);
  await expect(page.getByText('Übungstext · A1')).toBeVisible();
  await expect(page.getByRole('button', { name: 'Öğrenciler', exact: true })).toBeVisible();
  await page.getByLabel('Übersetzung zeigen').check();
  await expect(page.getByText('Die Schüler sind in der Schule.')).toBeVisible();

  // Übersetzen: Enter vergleicht, Enter auf „Passt“ geht weiter.
  await page.locator('label', { hasText: /^Übersetzen$/ }).click();
  await expect(page.getByText('Satz 1 von 4')).toBeVisible();
  await page.getByLabel('Deine Übersetzung (freiwillig)').fill('Hallo!');
  await page.keyboard.press('Enter');
  await expect(page.getByRole('status')).toContainText('Hallo!');
  await page.keyboard.press('Enter');
  await expect(page.getByText('Satz 2 von 4')).toBeVisible();
  await page.getByRole('button', { name: 'Vergleichen' }).click();
  await page.getByRole('button', { name: 'Daneben' }).click();
  for (const n of [3, 4]) {
    await expect(page.getByText(`Satz ${n} von 4`)).toBeVisible();
    await page.getByRole('button', { name: 'Vergleichen' }).click();
    await page.getByRole('button', { name: 'Passt' }).click();
  }
  await expect(page.getByRole('heading', { name: 'Text geschafft' })).toBeVisible();
  await expect(page.getByRole('listitem').filter({ hasText: 'Öğrenciler okulda.' })).toBeVisible();

  // „Fertig“ führt nicht in die Lektion zurück (sie hat den Eintrag geräumt), sondern zur Unit.
  await page.getByRole('button', { name: 'Fertig' }).click();
  await expect(page.getByRole('navigation', { name: 'Hauptnavigation' })).toBeVisible();
  await expect(page.getByRole('heading', { name: 'Lektion geschafft' })).toHaveCount(0);

  // Die Unit-Seite führt den Text auch direkt; die gewählte Art bleibt.
  const card = await openUnit(page, 'a1-u02');
  await card.getByRole('button', { name: /Wo ist was\?/ }).click();
  await expect(page.getByText('Satz 1 von 4')).toBeVisible();
  await page.getByRole('button', { name: 'Zurück' }).click();
  await expect(page.getByRole('navigation', { name: 'Hauptnavigation' })).toBeVisible();
});
