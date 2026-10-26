import { readFileSync } from 'node:fs';
import { expect, test } from '@playwright/test';
import type { Exercise } from '../src/content/schema';
import { answer, loadUnit, playLesson } from './solve';

test('Startseite listet die Units', async ({ page }) => {
  await page.goto('/');
  await expect(page.getByRole('heading', { name: 'Yol' })).toBeVisible();
  await expect(page.getByRole('heading', { name: 'Alphabet und Begrüßung' })).toBeVisible();
});

test('Erklärkarte öffnen', async ({ page }) => {
  await page.goto('/');
  const unit = page
    .getByRole('listitem')
    .filter({ has: page.getByRole('heading', { name: 'Alphabet und Begrüßung' }) });
  await unit.getByRole('button', { name: 'Erklärung' }).click();
  await expect(page.getByRole('table')).toBeVisible();
  await expect(page.getByRole('cell').first()).toBeVisible();
  await page.getByRole('button', { name: /Zurück/ }).click();
  await expect(page.getByRole('heading', { name: 'Alphabet und Begrüßung' })).toBeVisible();
});

test('komplette Lektion a1-u01-l1 durchspielen', async ({ page }) => {
  await page.goto('/');
  const total = await playLesson(page, 'a1-u01', 'a1-u01-l1');
  await expect(page.getByText(`${total} von ${total} beim ersten Versuch richtig`)).toBeVisible();
});

test('alle Lektionen aller Units sind mit den hinterlegten Lösungen lösbar', async ({ page }) => {
  test.setTimeout(600_000);
  const { units } = JSON.parse(readFileSync('public/content/index.json', 'utf8')) as {
    units: { id: string }[];
  };
  for (const { id: unitId } of units) {
    for (const lesson of loadUnit(unitId).lessons) {
      await page.goto('/');
      await playLesson(page, unitId, lesson.id);
    }
  }
});

test('Fortschritt und Einstellungen bleiben nach dem Neuladen erhalten', async ({ page }) => {
  await page.goto('/');
  await expect(page.getByText('Heute: 0 von 1 Lektionen')).toBeVisible();

  // Lektion abschließen
  await playLesson(page, 'a1-u01', 'a1-u01-l1');
  await page.getByRole('button', { name: 'Zur Übersicht' }).click();

  await expect(page.getByText('Tagesziel erreicht')).toBeVisible();
  await expect(page.getByText('1 Tag in Folge')).toBeVisible();
  await expect(page.getByText('1 von 4 Lektionen')).toBeVisible();

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
  await expect(page.getByText('1 von 4 Lektionen')).toBeVisible();
});

test('Fehler melden: Notiz erscheint in der Review-Ansicht und bleibt erhalten', async ({
  page,
}) => {
  await page.goto('/');
  await page.getByRole('button', { name: /Begrüßen/ }).click();
  await page.getByText('Merhaba').click();
  await page.getByRole('button', { name: 'Prüfen' }).click();
  await expect(page.getByText('Noch nicht geprüft')).toBeVisible();

  await page.getByRole('button', { name: 'Fehler melden' }).click();
  await page.getByLabel('Was stimmt hier nicht?').fill('Glosse unnatürlich\nzweite Zeile');
  await page.getByRole('button', { name: 'Notiz speichern' }).click();
  await expect(page.getByText('Notiz gespeichert.')).toBeVisible();
  // Enter im Textfeld darf die Lektion nicht weiterschalten
  await expect(page.getByRole('button', { name: 'Weiter' })).toBeVisible();

  await page.getByRole('button', { name: /Zurück/ }).click();
  await page.getByRole('button', { name: 'Einstellungen' }).click();
  await page.getByRole('button', { name: 'Inhalte prüfen' }).click();
  await expect(page.getByText('a1-u01-l1-e1 ·')).toBeVisible();
  await expect(page.getByText('Glosse unnatürlich')).toBeVisible();
  await expect(page.getByText(/^\d+ ungeprüft$/).first()).toBeVisible();

  await page.reload();
  await page.getByRole('button', { name: 'Einstellungen' }).click();
  await page.getByRole('button', { name: 'Inhalte prüfen' }).click();
  await expect(page.getByText('Glosse unnatürlich')).toBeVisible();

  await page.getByRole('button', { name: 'Notiz zu a1-u01-l1-e1 löschen' }).click();
  await expect(page.getByText('Noch keine Notizen.')).toBeVisible();
});

test('Suffix-Builder: richtige und falsche Form mit Begründung', async ({ page }) => {
  await page.goto('/');
  await page.getByRole('button', { name: /Plural bauen/ }).click();

  // 1) ev + Plural
  await page.getByRole('button', { name: 'ev', exact: true }).click();
  await page.getByRole('button', { name: 'ler', exact: true }).click();
  await page.getByRole('button', { name: 'Prüfen' }).click();
  await expect(page.getByRole('status')).toContainText('Richtig!');
  await expect(page.getByRole('status')).toContainText('hell');
  await page.getByRole('button', { name: 'Weiter' }).click();

  // 2) okul + Plural, bewusst mit falscher Harmonie
  await page.getByRole('button', { name: 'okul', exact: true }).click();
  await page.getByRole('button', { name: 'ler', exact: true }).click();
  await page.getByRole('button', { name: 'Prüfen' }).click();
  await expect(page.getByRole('status')).toContainText('Leider falsch.');
  await expect(page.getByRole('status')).toContainText('Lösung: okullar');
});

test('Fehler wiederholen: falsche Antwort bleibt offen, bis sie gelöst ist', async ({ page }) => {
  const unit = loadUnit('a1-u01');
  const lesson = unit.lessons[0]!;
  const [first, ...rest] = lesson.exercises;
  if (first?.type !== 'multiple_choice') throw new Error('Test erwartet MC als erste Aufgabe');
  const step = async (ex: Exercise) => {
    await answer(page, ex, unit);
    await page.getByRole('button', { name: 'Prüfen' }).click();
    await expect(page.getByRole('status')).toContainText('Richtig!');
    await page.getByRole('button', { name: 'Weiter' }).click();
  };
  const card = page.getByRole('button', { name: /Fehler wiederholen/ });

  await page.goto('/');
  await expect(card).toHaveCount(0);
  await page
    .getByRole('listitem')
    .filter({ has: page.getByRole('heading', { name: unit.title, exact: true }) })
    .getByRole('button', { name: lesson.title })
    .click();
  const wrong = first.options.find((o) => o !== first.answer)!;
  await page.locator('label', { has: page.getByText(wrong, { exact: true }) }).click();
  await page.getByRole('button', { name: 'Prüfen' }).click();
  await page.getByRole('button', { name: 'Weiter' }).click();
  for (const ex of [...rest, first]) await step(ex); // innerhalb der Lektion einmal wiederholt
  await page.getByRole('button', { name: 'Zur Übersicht' }).click();

  await expect(card).toContainText('Zuletzt falsch beantwortet: 1');
  await card.click();
  await step(first);
  await expect(page.getByRole('heading', { name: 'Durchgang geschafft' })).toBeVisible();
  await page.getByRole('button', { name: 'Zur Übersicht' }).click();
  await expect(card).toHaveCount(0);
});
