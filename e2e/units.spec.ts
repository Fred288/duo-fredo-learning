// Jede Unit als eigener Test: läuft parallel und zeigt bei Fehlern direkt die Unit.
import { readFileSync } from 'node:fs';
import { test } from '@playwright/test';
import { loadUnit, playLesson } from './solve';

const { units } = JSON.parse(readFileSync('public/content/index.json', 'utf8')) as {
  units: { id: string }[];
};

test.describe.configure({ mode: 'parallel' });

for (const { id: unitId } of units) {
  test(`${unitId}: alle Lektionen mit den hinterlegten Lösungen lösbar`, async ({ page }) => {
    test.setTimeout(180_000);
    for (const lesson of loadUnit(unitId).lessons) {
      await page.goto('/');
      await playLesson(page, unitId, lesson.id);
    }
  });
}
