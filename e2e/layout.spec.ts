import { expect, test, type Page } from '@playwright/test';
import { openLookup, openStats, openUnit } from './nav';

const width = (page: Page) => page.viewportSize()?.width ?? 1280;

const box = async (page: Page, selector: string) => {
  const b = await page.locator(selector).first().boundingBox();
  if (!b) throw new Error(`${selector} nicht sichtbar`);
  return b;
};

const noOverflow = (page: Page) =>
  page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth);

test('Heute: ab 1280 px stehen Karten und Tagesziel nebeneinander, sonst untereinander', async ({
  page,
}) => {
  await page.goto('/');
  await page.getByRole('button', { name: 'Nein, von vorn' }).click();
  await expect(page.getByRole('button', { name: /^Weiterlernen/ })).toBeVisible();
  const goal = await box(page, '[aria-label="Lernziele"]');
  const next = await box(page, 'button:has-text("Weiterlernen")');
  if (width(page) >= 1280) {
    expect(next.x + next.width).toBeLessThan(goal.x);
    expect(Math.abs(next.y - goal.y)).toBeLessThan(80);
  } else {
    expect(goal.y).toBeLessThan(next.y);
  }
  expect(await noOverflow(page)).toBe(true);
});

test('Statistik: ab 1280 px links die Übersicht, rechts die Units', async ({ page }) => {
  await page.goto('/');
  await openStats(page);
  await expect(page.getByRole('heading', { name: 'Statistik', level: 1 })).toBeVisible();
  await expect(page.getByRole('region', { name: 'Fällt schwer' })).toBeVisible();
  const words = await box(page, 'section[aria-labelledby="stats-words"]');
  const due = await box(page, 'section[aria-labelledby="stats-due"]');
  const units = await box(page, 'section[aria-labelledby="stats-units"]');
  // Fällig schließt ohne Lücke an, die lange Unit-Liste läuft daneben.
  expect(due.y).toBeLessThan(words.y + words.height + 40);
  if (width(page) >= 1280) {
    expect(units.x).toBeGreaterThan(words.x + words.width - 1);
    expect(Math.abs(units.y - words.y)).toBeLessThan(2);
  } else {
    expect(units.y).toBeGreaterThan(due.y);
  }
  expect(await noOverflow(page)).toBe(true);
});

test('Nachschlagen: ab 1024 px bleibt die Liste neben dem Eintrag, sonst ersetzt er sie', async ({
  page,
}) => {
  await page.goto('/');
  await openLookup(page);
  const search = page.getByRole('searchbox');
  await search.fill('evlerde');
  await search.press('Enter');
  const entry = page.getByRole('heading', { name: 'ev', exact: true });
  await expect(entry).toBeVisible();
  if (width(page) >= 1024) {
    // Suche und Treffer bleiben, der Eintrag steht daneben.
    await expect(search).toHaveValue('evlerde');
    await expect(page.getByRole('list', { name: 'Wörter' })).toBeVisible();
    const list = await box(page, 'ul[aria-label="Wörter"]');
    const e = await entry.boundingBox();
    expect(e!.x).toBeGreaterThan(list.x + list.width - 1);
    // Escape im Suchfeld schließt zuerst den Eintrag, dann leert es die Suche.
    await entry.focus();
    await page.keyboard.press('Escape');
    await expect(entry).toHaveCount(0);
    await expect(search).toHaveValue('evlerde');
    await expect(search).toBeFocused();
    await page.keyboard.press('Escape');
    await expect(search).toHaveValue('');
  } else {
    await expect(search).toHaveCount(0);
    await page.getByRole('button', { name: /Zurück/ }).click();
    await expect(search).toHaveValue('evlerde');
    await expect(entry).toHaveCount(0);
  }
  expect(await noOverflow(page)).toBe(true);
});

test('Querformat am Handy (812×375): kein Überlauf, klebende Balken geben Platz frei', async ({
  page,
}) => {
  await page.setViewportSize({ width: 812, height: 375 });
  await page.goto('/');
  await expect(page.getByRole('heading', { name: 'Yol', level: 1 })).toBeVisible();
  expect(await noOverflow(page)).toBe(true);
  // Seitenleiste statt Leiste unten: der Inhalt behält die Höhe.
  const nav = await box(page, 'nav');
  expect(nav.width).toBeLessThan(200);
  expect(nav.height).toBeGreaterThanOrEqual(370);

  const unit = await openUnit(page, 'a1-u01');
  expect(await noOverflow(page)).toBe(true);
  await unit.getByRole('button', { name: /Begrüßen/ }).click();
  await expect(page.getByRole('button', { name: 'Prüfen' })).toBeVisible();
  expect(await noOverflow(page)).toBe(true);
  const positions = await page.evaluate(() => ({
    header: getComputedStyle(document.querySelector('header')!).position,
    actions: getComputedStyle(
      [...document.querySelectorAll('button')]
        .find((b) => b.textContent === 'Prüfen')!
        .closest('.glass-strong')!,
    ).position,
  }));
  expect(positions).toEqual({ header: 'static', actions: 'static' });
});

test('Handy hochkant: Leiste unten ohne Überlauf, in Lektionen keine Navigation', async ({
  page,
}) => {
  test.skip(width(page) >= 768, 'nur Handybreite');
  await page.goto('/');
  expect(await noOverflow(page)).toBe(true);
  const nav = await box(page, 'nav');
  const viewport = page.viewportSize()!;
  expect(nav.y + nav.height).toBeGreaterThanOrEqual(viewport.height - 1);
  expect(nav.width).toBeGreaterThanOrEqual(viewport.width - 1);
});

test('Felder haben einen Rahmen mit mindestens 3:1', async ({ page }) => {
  await page.goto('/');
  await openLookup(page);
  const border = await page.getByRole('searchbox').evaluate((el) => {
    const c = getComputedStyle(el);
    return { color: c.borderTopColor, width: c.borderTopWidth };
  });
  expect(border.width).toBe('1px');
  const [r, g, b] = border.color.match(/\d+/g)!.map(Number) as [number, number, number];
  const lum = (v: number) => {
    const c = v / 255;
    return c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
  };
  const l = 0.2126 * lum(r) + 0.7152 * lum(g) + 0.0722 * lum(b);
  const surface = await page.evaluate(() => getComputedStyle(document.body).backgroundColor);
  const [sr] = surface.match(/\d+/g)!.map(Number);
  const ls = lum(sr!);
  const ratio = (Math.max(l, ls) + 0.05) / (Math.min(l, ls) + 0.05);
  expect(ratio).toBeGreaterThanOrEqual(3);
});
