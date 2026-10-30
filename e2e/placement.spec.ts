import { expect, test } from '@playwright/test';
import { playPlacement, startPlacementFromOffer } from './placement';

const unitCard = (page: import('@playwright/test').Page, title: string) =>
  page
    .getByRole('listitem')
    .filter({ has: page.getByRole('heading', { name: title, exact: true }) });

test('Angebot beim ersten Start lässt sich ablehnen und kommt nicht wieder', async ({ page }) => {
  await page.goto('/');
  await expect(page.getByRole('heading', { name: 'Schon Vorkenntnisse?' })).toBeVisible();
  await page.getByRole('button', { name: 'Nein, von vorn' }).click();
  await expect(page.getByRole('heading', { name: 'Schon Vorkenntnisse?' })).toHaveCount(0);
  await page.reload();
  await expect(page.getByRole('heading', { name: 'Alphabet und Begrüßung' })).toBeVisible();
  await expect(page.getByRole('heading', { name: 'Schon Vorkenntnisse?' })).toHaveCount(0);
});

test('Anfänger: nur „Weiß ich nicht“ führt zum Start bei der ersten Unit', async ({ page }) => {
  await page.goto('/');
  await startPlacementFromOffer(page);
  await expect(page.getByText('A1 · Thema 1 von 12')).toBeVisible();
  await playPlacement(page, () => false);

  await expect(page.getByText('Starte bei: Alphabet und Begrüßung')).toBeVisible();
  await page.getByRole('button', { name: 'Empfehlung übernehmen' }).click();

  const first = unitCard(page, 'Alphabet und Begrüßung');
  await expect(first.getByText('Empfohlener Start')).toBeVisible();
  await expect(page.getByText('laut Einstufung bekannt')).toHaveCount(0);
  // Der Test zählt weder fürs Tagesziel noch für den Fortschritt.
  await expect(page.getByText('Heute: 0 von 1 Lektionen')).toBeVisible();
  await expect(first.getByText('0 von 4 Lektionen')).toBeVisible();
});

test('Könner: A1 richtig, A2 nicht – Start bei A2, A1 als bekannt markiert; zurücknehmbar', async ({
  page,
}) => {
  test.setTimeout(240_000);
  await page.goto('/');
  await startPlacementFromOffer(page);
  await playPlacement(page, (unitId) => unitId.startsWith('a1-'));

  await expect(page.getByText(/^Starte bei: /)).toBeVisible();
  await expect(page.getByText('Sicher (12)')).toBeVisible();
  await page.getByRole('button', { name: 'Empfehlung übernehmen' }).click();

  // Die Startseite scrollt zur Start-Unit; sie trägt die Marke, A1 ist als bekannt markiert.
  await expect(page.getByText('Empfohlener Start')).toHaveCount(1);
  await expect(page.getByText('laut Einstufung bekannt')).toHaveCount(12);
  const start = page.getByRole('listitem').filter({ has: page.getByText('Empfohlener Start') });
  await expect(start).toBeInViewport();
  // Fortschrittsbalken bleiben echt.
  await expect(
    unitCard(page, 'Alphabet und Begrüßung').getByText('0 von 4 Lektionen'),
  ).toBeVisible();

  // Bleibt nach dem Neuladen erhalten.
  await page.reload();
  await expect(page.getByText('laut Einstufung bekannt')).toHaveCount(12);

  // Statistik nennt die übersprungenen Units.
  await page.getByRole('button', { name: 'Statistik' }).first().click();
  await expect(page.getByText(/laut Einstufung bekannt/).first()).toBeVisible();
  await page.getByRole('button', { name: /Zurück/ }).click();

  // Zurücknehmen in den Einstellungen; das Angebot kommt nicht zurück.
  await page.getByRole('button', { name: 'Einstellungen' }).click();
  await expect(
    page.getByText('Einstufung übernommen: 12 Themen als bekannt markiert.'),
  ).toBeVisible();
  await page.getByRole('button', { name: 'Einstufung zurücknehmen' }).click();
  await expect(page.getByText('Einstufung zurückgenommen.')).toBeVisible();
  await page.getByRole('button', { name: /Zurück/ }).click();
  await expect(page.getByText('laut Einstufung bekannt')).toHaveCount(0);
  await expect(page.getByText('Empfohlener Start')).toHaveCount(0);
  await expect(page.getByRole('heading', { name: 'Schon Vorkenntnisse?' })).toHaveCount(0);
});

test('Abbrechen speichert nichts; aus den Einstellungen wiederholbar', async ({ page }) => {
  await page.goto('/');
  await page.getByRole('button', { name: 'Nein, von vorn' }).click();
  await page.getByRole('button', { name: 'Einstellungen' }).click();
  await expect(page.getByText('Noch keine Einstufung übernommen.')).toBeVisible();
  await page.getByRole('button', { name: 'Einstufung machen' }).click();
  await page.getByRole('button', { name: 'Test beginnen' }).click();
  await page.getByRole('button', { name: 'Weiß ich nicht' }).click();
  await page.getByRole('button', { name: /Abbrechen/ }).click();
  await expect(page.getByText('Empfohlener Start')).toHaveCount(0);
  await page.getByRole('button', { name: 'Einstellungen' }).click();
  await expect(page.getByText('Noch keine Einstufung übernommen.')).toBeVisible();
});
