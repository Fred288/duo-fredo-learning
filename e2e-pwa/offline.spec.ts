import { expect, test } from '@playwright/test';

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
  await expect(page.getByRole('heading', { name: 'Alphabet und Begrüßung' })).toBeVisible();

  // Lektionsdaten kommen aus dem Precache
  await page.getByRole('button', { name: /Begrüßen/ }).click();
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
  await page.getByRole('button', { name: 'Nachschlagen' }).click();
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
  await expect(page.getByText('A1 · Thema 1 von 12')).toBeVisible();
  await expect(page.locator('[data-exercise-id]')).toBeVisible();
  await page.getByRole('button', { name: 'Weiß ich nicht' }).click();
  await page.getByRole('button', { name: 'Weiß ich nicht' }).click();
  await expect(page.getByText('A1 · Thema 2 von 12')).toBeVisible();
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
