import { expect, test, type Page } from '@playwright/test';
import { loadUnit, playLesson } from './solve';
import { openCourse, openToday, openUnit } from './nav';

const wide = (page: Page) => (page.viewportSize()?.width ?? 1280) >= 1024;

test('Kurs: das aktuelle Niveau ist offen, die anderen zu; die Wahl bleibt beim Zurückkehren', async ({
  page,
}) => {
  await page.goto('/');
  await openCourse(page);
  const a1 = page.locator('details', { hasText: 'Niveau A1' });
  const b2 = page.locator('details', { hasText: 'Niveau B2' });
  await expect(a1).toHaveJSProperty('open', true);
  await expect(b2).toHaveJSProperty('open', false);
  await expect(
    page.getByRole('heading', { name: 'Alphabet und Begrüßung', level: 3 }),
  ).toBeVisible();

  await b2.locator('summary').click();
  await expect(b2).toHaveJSProperty('open', true);
  await a1.locator('summary').click();
  await expect(a1).toHaveJSProperty('open', false);

  // Unit öffnen und zurück: der Zustand der Niveaus bleibt.
  await b2.getByRole('heading', { level: 3 }).first().getByRole('button').click();
  await page.getByRole('navigation').getByRole('button', { name: 'Heute' }).click();
  await openCourse(page);
  await expect(b2).toHaveJSProperty('open', true);
  await expect(a1).toHaveJSProperty('open', false);
});

test('Unit: Handy eigener Bildschirm mit Zurück, ab 1024 px neben der Liste', async ({ page }) => {
  await page.goto('/');
  const detail = await openUnit(page, 'a1-u01');
  await expect(detail.getByRole('button', { name: 'Erklärung' })).toBeVisible();
  const list = page.getByRole('heading', { name: 'Vokalharmonie und Plural', level: 3 });
  if (wide(page)) {
    await expect(list).toBeVisible();
    // Eine andere Unit wählen ersetzt die Spalte, ohne den Verlauf zu füllen.
    await list.getByRole('button').click();
    await expect(page.getByRole('region', { name: 'Vokalharmonie und Plural' })).toBeVisible();
    await expect(detail).toHaveCount(0);
    // Heute → Kurs → Unit: Zurück führt in den Kurs, nicht zur vorigen Unit.
    await page.goBack();
    await expect(page.getByRole('heading', { name: 'Kurs', level: 1 })).toBeVisible();
    await expect(page.getByRole('region', { name: 'Vokalharmonie und Plural' })).toHaveCount(0);
  } else {
    await expect(list).toHaveCount(0);
    await expect(
      page.getByRole('heading', { name: 'Alphabet und Begrüßung', level: 1 }),
    ).toBeFocused();
    await page.getByRole('button', { name: /Zurück/ }).click();
    await expect(page.getByRole('heading', { name: 'Kurs', level: 1 })).toBeVisible();
    await expect(list).toBeVisible();
  }
});

test('Heute: Weiterlernen führt zur nächsten offenen Lektion und rückt nach einer Lektion vor', async ({
  page,
}) => {
  const [first, second] = loadUnit('a1-u01').lessons.filter((l) => l.type !== 'listening');
  await page.goto('/');
  // Beim ersten Start steht statt Weiterlernen das Angebot.
  await expect(page.getByRole('button', { name: /Weiterlernen/ })).toHaveCount(0);
  await page.getByRole('button', { name: 'Nein, von vorn' }).click();

  const next = page.getByRole('button', { name: /^Weiterlernen/ });
  await expect(next).toContainText('Alphabet und Begrüßung');
  await expect(next).toContainText(first!.title);

  await playLesson(page, 'a1-u01', first!.id);
  await page.getByRole('button', { name: 'Zur Übersicht' }).click();
  await openToday(page);
  await expect(next).toContainText(second!.title);

  await next.click();
  await expect(page.getByRole('button', { name: 'Prüfen' })).toBeVisible();
  await page.getByRole('button', { name: /Zurück/ }).click();
  await expect(page.getByRole('heading', { name: 'Yol', level: 1 })).toBeVisible();
});
