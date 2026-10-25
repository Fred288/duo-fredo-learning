// Spielt Lektionen anhand der generierten Inhalte korrekt durch, damit die E2E-Tests
// nicht bei jeder Inhaltsänderung angepasst werden müssen.
import { readFileSync } from 'node:fs';
import { expect, type Page } from '@playwright/test';
import type { Exercise, Unit } from '../src/content/schema';
import { solveExercise } from '../src/content/lexicon';

export function loadUnit(unitId: string): Unit {
  return JSON.parse(readFileSync(`public/content/units/${unitId}.json`, 'utf8')) as Unit;
}

const stripPunctuation = (w: string) => w.replace(/^[„"«]+|[.,!?;:"“»]+$/g, '');

async function answer(page: Page, ex: Exercise, unit: Unit) {
  switch (ex.type) {
    case 'multiple_choice':
      await page.locator('label', { has: page.getByText(ex.answer, { exact: true }) }).click();
      break;
    case 'word_bank':
      for (const word of ex.answers[0]!.split(/\s+/).map(stripPunctuation)) {
        await page.getByRole('button', { name: word, exact: true }).click();
      }
      break;
    case 'free_text':
      await page.getByLabel('Deine Antwort').fill(ex.answers[0]!);
      break;
    case 'suffix_builder':
    case 'conjugation':
      for (const { text } of solveExercise(ex, unit.vocab).segments.filter((s) => s.text)) {
        await page.getByRole('button', { name: text, exact: true }).click();
      }
      break;
    default:
      throw new Error(`Übungstyp ${ex.type} wird vom Löser nicht unterstützt`);
  }
}

/** Öffnet die Lektion von der Startseite und beantwortet alle Übungen richtig. */
export async function playLesson(page: Page, unitId: string, lessonId: string) {
  const unit = loadUnit(unitId);
  const lesson = unit.lessons.find((l) => l.id === lessonId)!;
  // Lektionstitel wie „Wiederholung“ kommen in mehreren Units vor: innerhalb der Unit-Karte suchen.
  const card = page
    .getByRole('listitem')
    .filter({ has: page.getByRole('heading', { name: unit.title, exact: true }) });
  await card.getByRole('button', { name: new RegExp(lesson.title) }).click();
  for (const ex of lesson.exercises) {
    await expect(page.getByRole('button', { name: 'Prüfen' })).toBeVisible();
    await answer(page, ex, unit);
    await page.getByRole('button', { name: 'Prüfen' }).click();
    await expect(page.getByRole('status'), `${ex.id} sollte richtig sein`).toContainText(
      'Richtig!',
    );
    await page.getByRole('button', { name: 'Weiter' }).click();
  }
  await expect(page.getByRole('heading', { name: 'Lektion geschafft' })).toBeVisible();
  return lesson.exercises.length;
}
