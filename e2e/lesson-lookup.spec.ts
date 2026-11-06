import { expect, test } from '@playwright/test';
import { openUnit } from './nav';

test('Nachschlagen in der Lektion: Sheet über der Aufgabe, Zurück geht Ebene für Ebene', async ({
  page,
}) => {
  await page.goto('/');
  const unit = await openUnit(page, 'a1-u02');
  await unit.getByRole('button', { name: /^\p{L}+\s*Plural bauen$/u }).click();
  const exercise = page.locator('[data-exercise-id]');
  await expect(exercise).toBeVisible();
  const exerciseId = await exercise.getAttribute('data-exercise-id');

  await page.getByRole('button', { name: 'Nachschlagen' }).click();
  const sheet = page.getByRole('dialog', { name: 'Nachschlagen' });
  const search = sheet.getByRole('searchbox');
  await expect(search).toBeFocused();
  await search.fill('evlerde');
  await expect(sheet.getByRole('status')).toContainText('Treffer');
  // Enter öffnet den ersten Treffer und prüft nicht die Aufgabe.
  await search.press('Enter');
  await expect(sheet.getByRole('heading', { name: 'ev', level: 2 })).toBeVisible();
  await expect(page.getByRole('button', { name: 'Prüfen' })).toBeVisible();

  // Zurück-Taste des Browsers: vom Eintrag zur Trefferliste, die Lektion bleibt.
  await page.goBack();
  await expect(search).toHaveValue('evlerde');
  await expect(page.getByRole('progressbar')).toBeVisible();

  // Grammatik-Abschnitt erscheint im Sheet, nicht als eigener Bildschirm.
  await search.fill('Fallendungen');
  await sheet.getByRole('button', { name: /Die fünf Fallendungen im Überblick/ }).click();
  await expect(
    sheet.getByRole('heading', { name: 'Die fünf Fallendungen im Überblick', level: 2 }),
  ).toBeVisible();
  await expect(page.getByRole('progressbar')).toBeVisible();

  // Esc: Abschnitt → Treffer → Suche leeren → schließen; Fokus zurück auf den Knopf.
  await page.keyboard.press('Escape');
  await expect(search).toHaveValue('Fallendungen');
  await page.keyboard.press('Escape');
  await expect(search).toHaveValue('');
  await page.keyboard.press('Escape');
  await expect(sheet).toHaveCount(0);
  await expect(page.getByRole('button', { name: 'Nachschlagen' })).toBeFocused();
  await expect(exercise).toHaveAttribute('data-exercise-id', exerciseId!);
});

test('Nachschlagen im Übungstext', async ({ page }) => {
  await page.goto('/');
  const unit = await openUnit(page, 'a1-u02');
  await unit.getByRole('button', { name: /Wo ist was\?/ }).click();
  await page.getByRole('button', { name: 'Nachschlagen' }).click();
  await page.getByRole('searchbox').fill('okul');
  await page.getByRole('searchbox').press('Enter');
  await expect(page.getByRole('heading', { name: 'okul', level: 2 })).toBeVisible();
  await page.getByRole('button', { name: 'Schließen' }).click();
  await expect(page.getByRole('heading', { name: 'Wo ist was?', level: 1 })).toBeVisible();
});
