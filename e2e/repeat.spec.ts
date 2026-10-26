import { expect, test, type Page } from '@playwright/test';
import type { Exercise, Unit } from '../src/content/schema';
import { answer, loadUnit, playLesson } from './solve';

/** Beantwortet einen Wiederholen-Durchgang richtig: Lektionsübungen und Vokabelkarten. */
async function playRepeat(page: Page, unit: Unit) {
  const byPrompt = new Map<string, Exercise>(
    unit.lessons.flatMap((l) =>
      l.exercises.flatMap((e) => ('prompt' in e ? [[e.prompt, e] as const] : [])),
    ),
  );
  const vocab = unit.vocab ?? [];
  for (let guard = 0; guard < 40; guard++) {
    if (await page.getByRole('heading', { name: 'Wiederholung geschafft' }).isVisible()) return;
    const prompt = (await page.locator('p[lang]').first().textContent())!;
    const ex = byPrompt.get(prompt);
    if (ex?.type === 'multiple_choice') await answer(page, ex, unit);
    else {
      const asked = vocab.find((v) => v.tr === prompt);
      if (asked) {
        await page
          .locator('label', { has: page.getByText(asked.de.join(', '), { exact: true }) })
          .click();
      } else {
        const target = vocab.find((v) => v.de.join(', ') === prompt);
        if (!target) throw new Error(`Unbekannte Karte: ${prompt}`);
        await page.getByLabel('Deine Antwort').fill(target.tr);
      }
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
  const unit = loadUnit('a1-u01');
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
  await playRepeat(page, unit);
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
  await playRepeat(page, unit);
  await page.getByRole('button', { name: 'Zur Übersicht' }).click();
  await expect(tile(page)).toHaveCount(0);
  await expect(page.getByRole('button', { name: /Fehler wiederholen/ })).toHaveCount(0);
});
