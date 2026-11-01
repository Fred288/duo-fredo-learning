import AxeBuilder from '@axe-core/playwright';
import { expect, test, type Page } from '@playwright/test';
import { openCourse, openLookup, openSettings, openStats, openUnit } from './nav';

const TAGS = ['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa', 'wcag22aa'];

/** Keine Verstöße gegen WCAG A/AA; `incomplete` (z. B. Kontrast über Glas) zählt nicht als Befund. */
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
    await page.getByRole('button', { name: /Zurück/ }).click();

    await openLookup(page);
    await page.getByRole('searchbox').fill('evlerde');
    await expect(page.getByText('evlerde = Plural + Lokativ')).toBeVisible();
    await clean(page, 'Nachschlagen');

    await openStats(page);
    await expect(page.getByRole('heading', { name: 'Statistik', level: 1 })).toBeVisible();
    await clean(page, 'Statistik');

    await openSettings(page);
    await expect(page.getByRole('heading', { name: 'Einstellungen', level: 1 })).toBeVisible();
    await clean(page, 'Einstellungen');
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

test('Lektion: Kopf und Prüfen-Bereich bleiben stehen, wenn lange Inhalte scrollen', async ({
  page,
}) => {
  await page.goto('/');
  await (await openUnit(page, 'a1-u01')).getByRole('button', { name: /Begrüßen/ }).click();
  await expect(page.getByRole('button', { name: 'Prüfen' })).toBeVisible();
  const sticky = await page.evaluate(() => ({
    header: getComputedStyle(document.querySelector('header')!).position,
    actions: getComputedStyle(
      document.querySelector('button[disabled], button')!.closest('.glass')!,
    ).position,
  }));
  expect(sticky).toEqual({ header: 'sticky', actions: 'sticky' });
});
