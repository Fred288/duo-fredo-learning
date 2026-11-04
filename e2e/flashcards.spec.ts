import { expect, test } from '@playwright/test';
import { openFlashcards, openStats, openToday, openUnit } from './nav';

test('Karteikasten: Runde, Falsch-Stapel und Einstiege', async ({ page }) => {
  await page.goto('/');
  await openFlashcards(page);
  await expect(page.getByRole('heading', { name: 'Karteikasten', level: 1 })).toBeVisible();

  await page.getByRole('radio', { name: 'Eine Lektion' }).check();
  await page.getByRole('radio', { name: 'Wörter' }).check({ force: true });
  await page.getByRole('button', { name: /^Los \(\d+ Karten\)$/ }).click();

  // Fokusbereich ohne Navigation; erste Karte nicht gewusst, der Rest gewusst.
  await expect(page.getByRole('navigation', { name: 'Hauptnavigation' })).toHaveCount(0);
  await expect(page.getByText(/^Karte 1 von \d+/)).toBeVisible();
  await page.getByRole('button', { name: 'Umdrehen' }).click();
  await page.getByRole('button', { name: 'Nicht gewusst' }).click();
  await expect(page.getByText(/1 noch einmal/)).toBeVisible();
  const done = page.getByRole('heading', { name: 'Runde geschafft' });
  while (!(await done.isVisible())) {
    await page.keyboard.press('Space');
    await page.getByRole('button', { name: 'Gewusst', exact: true }).click();
  }
  await expect(page.getByText(/sofort gewusst, 1 nach Wiederholung/)).toBeVisible();
  await page.getByRole('button', { name: 'Zurück' }).click();

  // Der Falsch-Stapel zählt die Karte, „Heute“ bietet sie an.
  await expect(page.getByRole('radio', { name: 'Zuletzt falsch (1)' })).toBeVisible();
  await openToday(page);
  await page.getByRole('button', { name: /Karteikasten.*Zuletzt falsch: 1/ }).click();
  await expect(page.getByText('Karte 1 von 1')).toBeVisible();
  await page.getByRole('button', { name: 'Beenden' }).click();

  // Statistik nennt den Stand, die Übersicht der Auswahl auch.
  await openStats(page);
  await expect(
    page.getByRole('region', { name: 'Karteikasten' }).getByText(/zuletzt falsch: 1/),
  ).toBeVisible();
  await page.getByRole('button', { name: 'Falsche üben' }).click();
  await expect(page.getByText('Karte 1 von 1')).toBeVisible();
  await page.getByRole('button', { name: 'Beenden' }).click();
  await openFlashcards(page);
  await page.getByRole('radio', { name: 'Eine Lektion' }).check();
  await expect(page.getByText(/Zuletzt gewusst: \d+ von \d+ · zuletzt falsch: 1/)).toBeVisible();

  // Aus der Unit: Stapel steht auf dieser Unit.
  await openToday(page);
  const unit = await openUnit(page, 'a1-u02');
  await unit.getByRole('button', { name: /^Karteikarten \(\d+\)$/ }).click();
  await expect(page.getByRole('radio', { name: 'Eine Unit' })).toBeChecked();
  await expect(page.getByRole('combobox', { name: 'Unit' })).toHaveValue('a1-u02');
});
