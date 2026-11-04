import AxeBuilder from '@axe-core/playwright';
import { expect, test, type Page } from '@playwright/test';
import { openCourse, openFlashcards, openLookup, openSettings, openStats, openUnit } from './nav';
import { playPlacement } from './placement';
import { loadUnit } from './solve';

const TAGS = ['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa', 'wcag22aa'];

/**
 * Keine Verstöße gegen WCAG A/AA; `incomplete` zählt nicht. axe sieht weder Verlauf noch
 * `backdrop-filter`: den Kontrast auf Glas prüft `src/ui/tokens.test.ts`.
 */
async function clean(page: Page, where: string) {
  const { violations } = await new AxeBuilder({ page }).withTags(TAGS).analyze();
  const report = violations.map(
    (v) =>
      `${v.id} (${v.impact}): ${v.nodes
        .map((n) => n.target.join(' '))
        .slice(0, 4)
        .join(' | ')}`,
  );
  expect(report, where).toEqual([]);
}

for (const scheme of ['light', 'dark'] as const) {
  test(`axe: Hauptbildschirme (${scheme})`, async ({ page }) => {
    test.setTimeout(120_000);
    await page.emulateMedia({ colorScheme: scheme });
    await page.goto('/');
    await expect(page.getByRole('heading', { name: 'Yol', level: 1 })).toBeVisible();
    await clean(page, 'Heute (mit Angebot)');

    await page.getByRole('button', { name: 'Nein, von vorn' }).click();
    await expect(page.getByRole('button', { name: /^Weiterlernen/ })).toBeVisible();
    await clean(page, 'Heute');

    await openCourse(page);
    await clean(page, 'Kurs');

    const unit = await openUnit(page, 'a1-u01');
    await clean(page, 'Unit');

    await unit.getByRole('button', { name: /Begrüßen/ }).click();
    await expect(page.getByRole('button', { name: 'Prüfen' })).toBeVisible();
    await clean(page, 'Lektion (Fragen)');
    await page.getByText('Merhaba').click();
    await page.getByRole('button', { name: 'Prüfen' }).click();
    await expect(page.getByRole('button', { name: 'Weiter' })).toBeVisible();
    await clean(page, 'Lektion (Rückmeldung)');
    await page.getByRole('button', { name: /Zurück/ }).click();

    await (await openUnit(page, 'a1-u02')).getByRole('button', { name: 'Erklärung' }).click();
    await expect(page.getByRole('table').first()).toBeVisible();
    await clean(page, 'Erklärkarte');

    await (await openUnit(page, 'a1-u02')).getByRole('button', { name: /Plural bauen/ }).click();
    await page.getByRole('button', { name: 'ev', exact: true }).click();
    await page.getByRole('button', { name: 'lar', exact: true }).click();
    await page.getByRole('button', { name: 'Prüfen' }).click();
    await expect(page.getByRole('status')).toContainText('Leider falsch.');
    await clean(page, 'Falsche Antwort mit Grammatik-Hinweis');
    await page.getByRole('button', { name: /Zurück/ }).click();

    await openLookup(page);
    await page.getByRole('searchbox').fill('evlerde');
    await expect(page.getByText('evlerde = Plural + Lokativ')).toBeVisible();
    await clean(page, 'Nachschlagen');
    await page.getByRole('searchbox').press('Enter');
    await page.getByText('Formen', { exact: true }).click();
    await expect(page.getByRole('cell', { name: 'evlerden' })).toBeVisible();
    await clean(page, 'Nachschlage-Eintrag');

    await openStats(page);
    await expect(page.getByRole('heading', { name: 'Statistik', level: 1 })).toBeVisible();
    await clean(page, 'Statistik');

    await openSettings(page);
    await expect(page.getByRole('heading', { name: 'Einstellungen', level: 1 })).toBeVisible();
    await clean(page, 'Einstellungen');

    await page.getByRole('button', { name: 'Inhalte prüfen' }).click();
    await clean(page, 'Inhalte prüfen');
  });

  test(`axe: Karteikasten (${scheme})`, async ({ page }) => {
    await page.emulateMedia({ colorScheme: scheme });
    await page.goto('/');
    await openFlashcards(page);
    await expect(page.getByRole('heading', { name: 'Karteikasten', level: 1 })).toBeVisible();
    await clean(page, 'Karteikasten: Auswahl');
    await page.getByRole('button', { name: /^Los/ }).click();
    await page.getByRole('button', { name: 'Umdrehen' }).click();
    await expect(page.getByRole('button', { name: 'Gewusst', exact: true })).toBeVisible();
    await clean(page, 'Karteikasten: Rückseite');
    await page.getByRole('button', { name: 'Beenden' }).click();
    await page.getByRole('radio', { name: 'Eintippen' }).check({ force: true });
    await page.getByRole('button', { name: /^Los/ }).click();
    await page.getByRole('textbox', { name: 'Deine Antwort' }).fill('xyz');
    await page.getByRole('button', { name: 'Prüfen' }).click();
    await expect(page.getByText('Nicht richtig')).toBeVisible();
    await clean(page, 'Karteikasten: Eintippen');
  });

  test(`axe: Einstufung (${scheme})`, async ({ page }) => {
    test.setTimeout(120_000);
    await page.emulateMedia({ colorScheme: scheme });
    await page.goto('/');
    await page.getByRole('button', { name: 'Einstufung machen' }).click();
    await expect(page.getByRole('button', { name: 'Test beginnen' })).toBeVisible();
    await clean(page, 'Einstufung: Einführung');
    await page.getByRole('button', { name: 'Test beginnen' }).click();
    await expect(page.locator('[data-exercise-id]')).toBeVisible();
    await clean(page, 'Einstufung: Aufgabe');
    await playPlacement(page, () => false);
    await clean(page, 'Einstufung: Empfehlung');
  });

  test(`axe: Lesetext mit Wort-Sheet (${scheme})`, async ({ page }) => {
    await page.emulateMedia({ colorScheme: scheme });
    await page.goto('/');
    const unit = await openUnit(page, 'a2-u01');
    await unit.getByRole('button', { name: /Ein neues Leben in İzmir$/ }).click();
    await page.getByRole('button', { name: 'taşındım', exact: true }).click();
    await expect(page.getByRole('dialog', { name: 'Wort: taşındım' })).toBeVisible();
    await clean(page, 'Wort-Sheet');
  });
}

// --- Glas und seine Rückfälle ---------------------------------------------------------------

/** Deckkraft einer berechneten Farbe: `rgb(…)` ist deckend, `rgba(…)` und `color(… / a)` tragen sie. */
const alpha = (css: string) => {
  if (css.startsWith('rgb(')) return 1;
  const m = /(?:\/\s*|,\s*)([\d.]+)\s*\)$/.exec(css);
  return m ? Number(m[1]) : 1;
};

const cardBackground = (page: Page) =>
  page
    .locator('.card')
    .first()
    .evaluate((el) => getComputedStyle(el).backgroundColor);

const navStyle = (page: Page) =>
  page.getByRole('navigation', { name: 'Hauptnavigation' }).evaluate((el) => {
    const s = getComputedStyle(el);
    return {
      background: s.backgroundColor,
      blur:
        s.backdropFilter || (s as unknown as Record<string, string>).webkitBackdropFilter || 'none',
      gradient: getComputedStyle(document.body, '::before').display,
    };
  });

test('Glas: Leiste durchscheinend und unscharf, Hintergrund mit Verlauf', async ({ page }) => {
  await page.goto('/');
  await expect(page.getByRole('heading', { name: 'Yol', level: 1 })).toBeVisible();
  const s = await navStyle(page);
  expect(alpha(s.background)).toBeLessThan(1);
  expect(s.blur).toContain('blur');
  expect(s.gradient).not.toBe('none');
});

test('Glas: bei „weniger Transparenz“ deckend, ohne Unschärfe und ohne Verlauf', async ({
  page,
}) => {
  const client = await page.context().newCDPSession(page);
  await client.send('Emulation.setEmulatedMedia', {
    features: [{ name: 'prefers-reduced-transparency', value: 'reduce' }],
  });
  await page.goto('/');
  await expect(page.getByRole('heading', { name: 'Yol', level: 1 })).toBeVisible();
  const s = await navStyle(page);
  expect(alpha(s.background)).toBe(1);
  expect(s.blur).toBe('none');
  expect(s.gradient).toBe('none');
  await openCourse(page);
  expect(alpha(await cardBackground(page))).toBe(1);
  await (
    await openUnit(page, 'a2-u01')
  )
    .getByRole('button', { name: /Ein neues Leben in İzmir$/ })
    .click();
  await page.getByRole('button', { name: 'taşındım', exact: true }).click();
  const sheet = await page.getByRole('dialog').evaluate((el) => {
    const c = getComputedStyle(el);
    return { background: c.backgroundColor, blur: c.backdropFilter };
  });
  expect(alpha(sheet.background)).toBe(1);
  expect(sheet.blur).toBe('none');
});

test('Glas: bei hohem Kontrast deckend', async ({ page }) => {
  await page.emulateMedia({ contrast: 'more' });
  await page.goto('/');
  await expect(page.getByRole('heading', { name: 'Yol', level: 1 })).toBeVisible();
  const s = await navStyle(page);
  expect(alpha(s.background)).toBe(1);
  expect(s.blur).toBe('none');
});

test('Glas: bei erzwungenen Farben Systemfarben und Rahmen statt Glas', async ({ page }) => {
  await page.emulateMedia({ forcedColors: 'active' });
  await page.goto('/');
  await expect(page.getByRole('heading', { name: 'Yol', level: 1 })).toBeVisible();
  const s = await navStyle(page);
  expect(s.blur).toBe('none');
  expect(s.gradient).toBe('none');
});

test('Bewegung: bei „weniger Bewegung“ keine Übergänge', async ({ page }) => {
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await page.goto('/');
  await openCourse(page);
  const duration = await page
    .locator('details svg')
    .first()
    .evaluate((el) => parseFloat(getComputedStyle(el).transitionDuration));
  expect(duration).toBeLessThan(0.001);
});

test('Lektion: Felder geraten nicht unter die Balken, auch bei wenig Höhe', async ({ page }) => {
  const lesson = loadUnit('a1-u06').lessons.find((l) => l.id === 'a1-u06-l5')!;
  await page.goto('/');
  await (
    await openUnit(page, 'a1-u06')
  )
    .getByRole('button', { name: new RegExp(`${lesson.title}$`) })
    .click();
  await expect(page.getByRole('button', { name: 'Prüfen' })).toBeVisible();
  // Näherung für die offene Bildschirmtastatur.
  await page.setViewportSize({ width: 390, height: 420 });
  const cells = page.getByRole('textbox');
  for (let i = 0; i < (await cells.count()); i++) {
    await cells.nth(i).focus();
    await expect
      .poll(() =>
        cells.nth(i).evaluate((el) => {
          const r = el.getBoundingClientRect();
          const hit = document.elementFromPoint(r.x + r.width / 2, r.y + r.height / 2);
          return hit === el;
        }),
      )
      .toBe(true);
  }
  // Kopf und Prüfen-Bereich bleiben beim Scrollen im Bild.
  await page.evaluate(() => window.scrollTo(0, document.documentElement.scrollHeight / 2));
  await expect(page.getByRole('progressbar')).toBeInViewport();
  await expect(page.getByRole('button', { name: 'Prüfen' })).toBeInViewport();
});

test('Lesetext: Das Wort-Sheet liegt über dem Prüfen-Bereich', async ({ page }) => {
  await page.goto('/');
  await (
    await openUnit(page, 'a2-u01')
  )
    .getByRole('button', { name: /Ein neues Leben in İzmir$/ })
    .click();
  await page.getByRole('button', { name: 'Zu den Fragen' }).click();
  await page.getByText('Text anzeigen', { exact: false }).click();
  await page.getByRole('button', { name: 'taşındım', exact: true }).first().click();
  const sheet = page.getByRole('dialog', { name: 'Wort: taşındım' });
  await expect(sheet).toBeVisible();
  const check = page.getByRole('button', { name: 'Prüfen' });
  await check.scrollIntoViewIfNeeded();
  const onTop = await check.evaluate((el) => {
    const r = el.getBoundingClientRect();
    const hit = document.elementFromPoint(r.x + r.width / 2, r.y + r.height / 2);
    return !!hit?.closest('[role=dialog]') || !el.contains(hit);
  });
  expect(onTop).toBe(true);
});
