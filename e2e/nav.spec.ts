import { expect, test, type Page } from '@playwright/test';
import { startPlacementFromOffer } from './placement';
import { openCourse, openLookup, openSettings, openStats, openToday } from './nav';

const nav = (page: Page) => page.getByRole('navigation', { name: 'Hauptnavigation' });
const phone = (page: Page) => (page.viewportSize()?.width ?? 1280) < 768;

test('Navigation: Ziele, aktuelle Seite markiert, je Breite die richtigen Einträge', async ({
  page,
}) => {
  await page.goto('/');
  await expect(nav(page).getByRole('button', { name: 'Heute' })).toHaveAttribute(
    'aria-current',
    'page',
  );
  await openCourse(page);
  await expect(nav(page).getByRole('button', { name: 'Kurs' })).toHaveAttribute(
    'aria-current',
    'page',
  );
  await expect(nav(page).getByRole('button', { name: 'Heute' })).not.toHaveAttribute(
    'aria-current',
    'page',
  );

  // Handy: „Mehr“ statt Statistik und Einstellungen in der Leiste; ab Tablet umgekehrt.
  await expect(nav(page).getByRole('button', { name: 'Mehr' })).toHaveCount(phone(page) ? 1 : 0);
  await expect(nav(page).getByRole('button', { name: 'Statistik' })).toHaveCount(
    phone(page) ? 0 : 1,
  );
  await expect(nav(page).getByRole('button', { name: 'Einstellungen' })).toHaveCount(
    phone(page) ? 0 : 1,
  );
});

test('Navigation ist per Tastatur bedienbar, der Fokus folgt dem Bildschirmwechsel', async ({
  page,
}) => {
  await page.goto('/');
  await expect(page.getByRole('heading', { name: 'Yol', level: 1 })).toBeVisible();
  await page.keyboard.press('Tab');
  await expect(page.getByRole('link', { name: 'Zum Inhalt springen' })).toBeFocused();
  await page.keyboard.press('Enter');
  await expect(page.getByRole('main')).toBeFocused();

  await nav(page).getByRole('button', { name: 'Kurs' }).focus();
  await page.keyboard.press('Enter');
  await expect(page.getByRole('heading', { name: 'Kurs', level: 1 })).toBeFocused();
});

test('Fokusbereich blendet die Navigation aus, Zurück führt in den Kurs', async ({ page }) => {
  await page.goto('/');
  await openCourse(page);
  await page.getByRole('button', { name: /Begrüßen/ }).click();
  await expect(page.getByRole('button', { name: 'Prüfen' })).toBeVisible();
  await expect(nav(page)).toHaveCount(0);

  await page.goBack();
  await expect(page.getByRole('heading', { name: 'Kurs', level: 1 })).toBeVisible();
  await expect(nav(page)).toBeVisible();
  await page.goBack();
  await expect(page.getByRole('heading', { name: 'Yol', level: 1 })).toBeVisible();
});

test('Zurück-Taste geht Schritt für Schritt durch die App', async ({ page }) => {
  await page.goto('/');
  await openCourse(page);
  await openLookup(page);
  await openToday(page);

  await page.goBack();
  await expect(page.getByRole('searchbox')).toBeVisible();
  await page.goBack();
  await expect(page.getByRole('heading', { name: 'Kurs', level: 1 })).toBeVisible();
  await page.goForward();
  await expect(page.getByRole('searchbox')).toBeVisible();
});

test('Nachschlage-Eintrag: Zurück-Taste geht zuerst zur Trefferliste', async ({ page }) => {
  await page.goto('/');
  await openLookup(page);
  await page.getByRole('searchbox').fill('evlerde');
  await page.getByRole('searchbox').press('Enter');
  await expect(page.getByRole('heading', { name: 'ev', exact: true })).toBeVisible();

  await page.goBack();
  await expect(page.getByRole('searchbox')).toHaveValue('evlerde');
  await expect(page.getByRole('heading', { name: 'ev', exact: true })).toHaveCount(0);
  await expect(nav(page)).toBeVisible();

  await page.goBack();
  await expect(page.getByRole('heading', { name: 'Yol', level: 1 })).toBeVisible();
});

test('Einstufungstest: Zurück-Taste fragt nach, statt Antworten zu verwerfen', async ({ page }) => {
  await page.goto('/');
  await startPlacementFromOffer(page);
  // Vor der ersten Antwort verlässt Zurück den Test ohne Rückfrage.
  await page.goBack();
  await expect(page.getByRole('heading', { name: 'Yol', level: 1 })).toBeVisible();

  await page.goForward();
  await page.getByRole('button', { name: 'Test beginnen' }).click();
  await page.getByRole('button', { name: 'Weiß ich nicht' }).click();
  await page.goBack();
  await expect(page.getByText('Test abbrechen? Es wird nichts gespeichert.')).toBeVisible();
  await page.getByRole('button', { name: 'Weitermachen' }).click();
  await expect(page.locator('[data-exercise-id]')).toBeVisible();

  // Ein zweites Zurück fragt wieder nach; erst „Ja, abbrechen“ verlässt den Test.
  await page.goBack();
  await page.getByRole('button', { name: 'Ja, abbrechen' }).click();
  await expect(page.getByRole('heading', { name: 'Yol', level: 1 })).toBeVisible();
  await expect(page.getByRole('heading', { name: 'Deine Empfehlung' })).toHaveCount(0);
});

test('Neuladen beginnt bei „Heute“, ein alter Verlaufseintrag führt nicht in eine Lektion', async ({
  page,
}) => {
  await page.goto('/');
  await openCourse(page);
  await page.getByRole('button', { name: /Begrüßen/ }).click();
  await expect(page.getByRole('button', { name: 'Prüfen' })).toBeVisible();

  await page.reload();
  await expect(page.getByRole('heading', { name: 'Yol', level: 1 })).toBeVisible();
  await page.goBack();
  await expect(page.getByRole('heading', { name: 'Yol', level: 1 })).toBeVisible();
  await expect(page.getByRole('button', { name: 'Prüfen' })).toHaveCount(0);
});

test('Statistik und Einstellungen sind auf jeder Breite erreichbar', async ({ page }) => {
  await page.goto('/');
  await openStats(page);
  await expect(page.getByRole('heading', { name: 'Statistik', level: 1 })).toBeVisible();
  await openSettings(page);
  await expect(page.getByRole('heading', { name: 'Einstellungen', level: 1 })).toBeVisible();
});

test('Taste „/“ öffnet das Nachschlagen auf jedem Navigationsbildschirm', async ({ page }) => {
  await page.goto('/');
  await openCourse(page);
  await page.keyboard.press('/');
  await expect(page.getByRole('searchbox')).toBeFocused();
});
