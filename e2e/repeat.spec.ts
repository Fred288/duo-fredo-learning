import { readdirSync } from 'node:fs';
import { expect, test, type Page } from '@playwright/test';
import type { Unit } from '../src/content/schema';
import { answer, loadUnit, playLesson } from './solve';

/**
 * Beantwortet einen Wiederholen-Durchgang richtig. Die Karte wird über die Übungs-ID erkannt, die
 * der Runner als `data-exercise-id` setzt: `srs-vo:<Richtung>:<Vokabel-ID>` für Vokabeln, sonst die
 * ID einer Lektionsübung (beliebiger Typ, Unit aus dem ID-Präfix).
 */
const allVocab = () =>
  readdirSync('public/content/units').flatMap((f) => loadUnit(f.replace('.json', '')).vocab ?? []);

async function playRepeat(page: Page) {
  const units = new Map<string, Unit>();
  const unitOf = (id: string) => {
    const unitId = /^[ab][12]-u\d{2}/.exec(id)![0];
    if (!units.has(unitId)) units.set(unitId, loadUnit(unitId));
    return units.get(unitId)!;
  };
  for (let guard = 0; guard < 60; guard++) {
    if (await page.getByRole('heading', { name: 'Wiederholung geschafft' }).isVisible()) return;
    const id = (await page.locator('[data-exercise-id]').getAttribute('data-exercise-id'))!;
    const vocabCard = /^srs-vo:(tr_de|de_tr):(.+)$/.exec(id);
    if (vocabCard) {
      const [, dir, key] = vocabCard as unknown as [string, string, string];
      const v = allVocab().find((x) => (x.id ?? x.tr) === key)!;
      if (dir === 'tr_de') {
        await page
          .locator('label', { has: page.getByText(v.de.join(', '), { exact: true }) })
          .click();
      } else await page.getByLabel('Deine Antwort').fill(v.tr);
    } else {
      const unit = unitOf(id);
      const ex = unit.lessons.flatMap((l) => l.exercises).find((e) => e.id === id)!;
      await answer(page, ex, unit);
    }
    await page.getByRole('button', { name: 'Prüfen' }).click();
    await expect(page.getByRole('status')).toContainText('Richtig!');
    await page.getByRole('button', { name: 'Weiter' }).click();
  }
  throw new Error('Durchgang nicht beendet');
}

const tile = (page: Page) => page.getByRole('button', { name: /^Wiederholen / });

test('Wiederholen: neue Wörter nach einer Lektion, zählt wie eine Lektion fürs Tagesziel', async ({
  page,
}) => {
  await page.clock.setFixedTime(new Date('2026-05-01T10:00:00'));
  await page.goto('/');
  await expect(tile(page)).toHaveCount(0); // ohne abgeschlossene Lektion keine neuen Wörter

  await page.getByRole('button', { name: 'Einstellungen' }).click();
  await page.getByRole('button', { name: 'Tagesziel erhöhen' }).click();
  await page.getByRole('button', { name: 'Tagesziel erhöhen' }).click();
  await page.getByRole('button', { name: /Zurück/ }).click();
  await expect(page.getByText('Heute: 0 von 3 Lektionen')).toBeVisible();

  await playLesson(page, 'a1-u01', 'a1-u01-l1');
  await page.getByRole('button', { name: 'Zur Übersicht' }).click();
  await expect(page.getByText('Heute: 1 von 3 Lektionen')).toBeVisible();
  await expect(tile(page)).toContainText('10 neue Wörter');

  await tile(page).click();
  await playRepeat(page);
  await page.getByRole('button', { name: 'Zur Übersicht' }).click();
  await expect(page.getByText('Heute: 2 von 3 Lektionen')).toBeVisible();
  await expect(page.getByText('1 von 4 Lektionen')).toBeVisible(); // Unit-Fortschritt unberührt
  await expect(tile(page)).toHaveCount(0); // Tageslimit neuer Wörter erreicht

  await page.reload();
  await expect(page.getByText('Heute: 2 von 3 Lektionen')).toBeVisible();
  await expect(tile(page)).toHaveCount(0);
});

test('Wiederholen: falsch beantwortete Übung kommt am nächsten Tag zurück', async ({ page }) => {
  const unit = loadUnit('a1-u01');
  const lesson = unit.lessons[0]!;
  const [first, ...rest] = lesson.exercises;
  if (first?.type !== 'multiple_choice') throw new Error('Test erwartet MC als erste Aufgabe');

  await page.clock.setFixedTime(new Date('2026-05-01T10:00:00'));
  await page.goto('/');
  await page
    .getByRole('listitem')
    .filter({ has: page.getByRole('heading', { name: unit.title, exact: true }) })
    .getByRole('button', { name: lesson.title })
    .click();
  const wrong = first.options.find((o) => o !== first.answer)!;
  await page.locator('label', { has: page.getByText(wrong, { exact: true }) }).click();
  await page.getByRole('button', { name: 'Prüfen' }).click();
  await page.getByRole('button', { name: 'Weiter' }).click();
  for (const ex of [...rest, first]) {
    await answer(page, ex, unit);
    await page.getByRole('button', { name: 'Prüfen' }).click();
    await page.getByRole('button', { name: 'Weiter' }).click();
  }
  await page.getByRole('button', { name: 'Zur Übersicht' }).click();
  await expect(tile(page)).toContainText('10 neue Wörter');
  await expect(tile(page)).not.toContainText('fällig');

  await page.clock.setFixedTime(new Date('2026-05-02T10:00:00'));
  await page.reload();
  await expect(tile(page)).toContainText('1 fällig · 10 neue Wörter');

  await tile(page).click();
  await playRepeat(page);
  await page.getByRole('button', { name: 'Zur Übersicht' }).click();
  await expect(tile(page)).toHaveCount(0);
  await expect(page.getByRole('button', { name: /Fehler wiederholen/ })).toHaveCount(0);
});
