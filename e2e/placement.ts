// Hilfen für den Einstufungstest in E2E-Tests.
import { readFileSync } from 'node:fs';
import { expect, type Page } from '@playwright/test';
import type { PlacementPlan } from '../src/placement';
import type { Exercise } from '../src/content/schema';
import { answer, loadUnit } from './solve';

/** Zahl der Units je Niveau laut Einstufungsplan; die Tests hängen so nicht an Inhaltszahlen. */
export function unitsAt(level: 'A1' | 'A2' | 'B1'): number {
  const plan = JSON.parse(readFileSync('public/content/placement.json', 'utf8')) as PlacementPlan;
  return plan.levels.find((l) => l.level === level)?.units.length ?? 0;
}

const result = (page: Page) => page.getByRole('heading', { name: 'Deine Empfehlung' });

/** Startet den Test von der Angebotskarte der Startseite und geht an die erste Aufgabe. */
export async function startPlacementFromOffer(page: Page) {
  await page.getByRole('button', { name: 'Einstufung machen' }).click();
  await page.getByRole('button', { name: 'Test beginnen' }).click();
}

/**
 * Beantwortet Aufgaben, bis die Empfehlung erscheint. `correct` entscheidet je Unit-ID, ob sie
 * richtig gelöst wird (aus den Inhalten) oder mit „Weiß ich nicht“ beantwortet.
 */
export async function playPlacement(page: Page, correct: (unitId: string) => boolean) {
  for (let guard = 0; guard < 100; guard++) {
    const question = page.locator('[data-exercise-id]');
    // Entweder die nächste Aufgabe oder die Empfehlung.
    await expect(question.or(result(page))).toBeVisible();
    if (await result(page).isVisible()) return;
    const id = (await question.getAttribute('data-exercise-id'))!;
    const unitId = id.split('-').slice(0, 2).join('-');
    if (correct(unitId)) {
      const unit = loadUnit(unitId);
      const ex = unit.lessons.flatMap((l) => l.exercises).find((e) => e.id === id) as Exercise;
      await answer(page, ex, unit);
      await page.getByRole('button', { name: 'Weiter' }).click();
    } else {
      await page.getByRole('button', { name: 'Weiß ich nicht' }).click();
    }
    // Die Aufgabe verschwindet oder wechselt, bevor die nächste Runde sie erneut liest.
    await expect(page.locator(`[data-exercise-id="${id}"]`)).toHaveCount(0);
  }
  throw new Error('Einstufung endet nicht');
}
