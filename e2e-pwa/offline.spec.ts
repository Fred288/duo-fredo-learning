import { readFileSync } from 'node:fs';
import { expect, test } from '@playwright/test';
import { openCourse, openLookup, openToday, openUnit } from '../e2e/nav';
import { playPlacement, startPlacementFromOffer } from '../e2e/placement';

// Zahl der A1-Units laut Einstufungsplan (vom Build erzeugt).
const a1Units = (
  JSON.parse(readFileSync('public/content/placement.json', 'utf8')) as {
    levels: { level: string; units: unknown[] }[];
  }
).levels.find((l) => l.level === 'A1')!.units.length;

test('App und Lektion laufen nach dem ersten Besuch offline', async ({ page, context }) => {
  await page.goto('/');
  await expect(page.getByRole('heading', { name: 'Yol' })).toBeVisible();

  // Service Worker installiert und Precache gefüllt
  await page.evaluate(async () => {
    await navigator.serviceWorker.ready;
  });
  await page.reload(); // ab jetzt kontrolliert der Service Worker die Seite
  await expect
    .poll(() => page.evaluate(() => navigator.serviceWorker.controller !== null))
    .toBe(true);

  await context.setOffline(true);
  await page.reload();
  await expect(page.getByRole('heading', { name: 'Yol' })).toBeVisible();
  await openCourse(page);
  await expect(page.getByRole('heading', { name: 'Alphabet und Begrüßung' })).toBeVisible();

  // Lektionsdaten kommen aus dem Precache
  await (await openUnit(page, 'a1-u01')).getByRole('button', { name: /Begrüßen/ }).click();
  await expect(page.getByText('Was heißt „Hallo“?')).toBeVisible();
});

test('Nachschlagewerk läuft offline (lookup.json im Precache)', async ({ page, context }) => {
  await page.goto('/');
  await page.evaluate(async () => {
    await navigator.serviceWorker.ready;
  });
  await page.reload();
  await expect
    .poll(() => page.evaluate(() => navigator.serviceWorker.controller !== null))
    .toBe(true);

  await context.setOffline(true);
  await page.reload();
  await openLookup(page);
  await page.getByRole('searchbox').fill('evlerde');
  await expect(page.getByText('evlerde = Plural + Lokativ')).toBeVisible();
});

test('Einstufungstest läuft offline (placement.json und Units im Precache)', async ({
  page,
  context,
}) => {
  await page.goto('/');
  await page.evaluate(async () => {
    await navigator.serviceWorker.ready;
  });
  await page.reload();
  await expect
    .poll(() => page.evaluate(() => navigator.serviceWorker.controller !== null))
    .toBe(true);

  await context.setOffline(true);
  await page.reload();
  await page.getByRole('button', { name: 'Einstufung machen' }).click();
  await page.getByRole('button', { name: 'Test beginnen' }).click();
  await expect(page.getByText(`A1 · Thema 1 von ${a1Units}`)).toBeVisible();
  await expect(page.locator('[data-exercise-id]')).toBeVisible();
  await page.getByRole('button', { name: 'Weiß ich nicht' }).click();
  await page.getByRole('button', { name: 'Weiß ich nicht' }).click();
  await expect(page.getByText(`A1 · Thema 2 von ${a1Units}`)).toBeVisible();
});

// Im Build gibt es keinen doppelten Effekt wie unter StrictMode im Dev-Server: Scrollen lässt sich
// nur hier ehrlich prüfen.
test('Einstufung: Kurs öffnet das Niveau und scrollt zur Start-Unit; Unit-Wahl hält die Liste', async ({
  page,
}) => {
  test.setTimeout(240_000);
  await page.goto('/');
  // Der Kurs war schon offen: A2 ist zu, wenn die Empfehlung kommt.
  await openCourse(page);
  await openToday(page);
  await startPlacementFromOffer(page);
  const sure = /^a1-|^a2-u0[1-5]/;
  await playPlacement(page, (unitId) => sure.test(unitId));
  await page.getByRole('button', { name: 'Empfehlung übernehmen' }).click();

  const start = page.locator('#unit-a2-u06');
  await expect(start.getByText('Empfohlener Start')).toBeVisible();
  await expect(start).toBeInViewport();
  expect(await page.evaluate(() => window.scrollY)).toBeGreaterThan(0);

  // Zwei Spalten: Wählen wirft die Liste nicht nach oben.
  if ((page.viewportSize()?.width ?? 0) >= 1024) {
    const y = await page.evaluate(() => window.scrollY);
    await start.getByRole('button').click();
    await expect(page.locator('#unit-title')).toBeVisible();
    await expect(start).toBeInViewport();
    // Der Klick selbst darf die Zeile ein Stück nachführen, nach oben springen darf sie nicht.
    expect(await page.evaluate(() => window.scrollY)).toBeGreaterThan(y - 100);
  }
});

test('Zurück aus der Erklärkarte: Register bleibt offen, der Scrollstand stimmt', async ({
  page,
}) => {
  await page.goto('/');
  await openLookup(page);
  const units = page.locator('details:has(summary)');
  await expect(units.first()).toBeVisible();
  const far = units.last();
  await far.locator('summary').click();
  await far.getByRole('button').first().scrollIntoViewIfNeeded();
  const y = await page.evaluate(() => window.scrollY);
  expect(y).toBeGreaterThan(300);
  await far.getByRole('button').first().click();
  await expect(page.getByRole('searchbox')).toHaveCount(0);
  await page.goBack();
  await expect(far.getByRole('button').first()).toBeVisible();
  await expect.poll(() => page.evaluate(() => window.scrollY)).toBeGreaterThan(y - 100);
});

test('Das Update-Banner wartet, bis die Aufgabe vorbei ist', async ({ page }) => {
  await page.goto('/');
  const banner = page.getByText('Bereit für den Offline-Einsatz.');
  await expect(banner).toBeVisible();
  await (await openUnit(page, 'a1-u01')).getByRole('button', { name: /Begrüßen/ }).click();
  await expect(page.getByRole('button', { name: 'Prüfen' })).toBeVisible();
  await expect(banner).toHaveCount(0);
  await page.getByRole('button', { name: /Zurück/ }).click();
  await expect(banner).toBeVisible();
});

test('Manifest ist installierbar konfiguriert', async ({ page, request }) => {
  await page.goto('/');
  const href = await page.locator('link[rel="manifest"]').getAttribute('href');
  const manifest = await (await request.get(href!)).json();
  expect(manifest).toMatchObject({
    short_name: 'Yol',
    display: 'standalone',
    lang: 'de',
  });
  const sizes = manifest.icons.map((i: { sizes: string }) => i.sizes);
  expect(sizes).toEqual(expect.arrayContaining(['192x192', '512x512']));
});
