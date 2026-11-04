// Navigation der App für die E2E-Tests. Auf dem Handy (unter 768 px) liegen Statistik und
// Einstellungen unter „Mehr“, ab Tablet stehen sie in der Seitenleiste; die Hilfen kennen beides.
import { readFileSync } from 'node:fs';
import { expect, type Locator, type Page } from '@playwright/test';

const nav = (page: Page) => page.getByRole('navigation', { name: 'Hauptnavigation' });

const isPhone = (page: Page) => (page.viewportSize()?.width ?? 1280) < 768;

export async function openToday(page: Page) {
  await nav(page).getByRole('button', { name: 'Heute' }).click();
  await expect(page.getByRole('heading', { name: 'Yol', level: 1 })).toBeVisible();
}

export async function openCourse(page: Page) {
  await nav(page).getByRole('button', { name: 'Kurs' }).click();
  await expect(page.getByRole('heading', { name: 'Kurs', level: 1 })).toBeVisible();
}

const manifest = JSON.parse(readFileSync('public/content/index.json', 'utf8')) as {
  units: { id: string; level: string; title: string }[];
};

/**
 * Öffnet eine Unit im Kurs (klappt ihr Niveau auf, falls nötig) und liefert deren Bereich mit
 * Erklärung und Lektionen: auf dem Handy der Unit-Bildschirm, ab 1024 px die rechte Spalte.
 */
export async function openUnit(page: Page, unitId: string): Promise<Locator> {
  const unit = manifest.units.find((u) => u.id === unitId);
  if (!unit) throw new Error(`Unit ${unitId} nicht im Kursverzeichnis`);
  await openCourse(page);
  const summary = page.locator('summary', { hasText: `Niveau ${unit.level}` });
  await expect(summary).toBeVisible();
  const row = page.getByRole('heading', { name: unit.title, exact: true, level: 3 });
  if (!(await row.isVisible())) await summary.click();
  await row.getByRole('button').click();
  const detail = page.getByRole('region', { name: unit.title, exact: true });
  await expect(detail).toBeVisible();
  return detail;
}

export async function openLookup(page: Page) {
  await nav(page).getByRole('button', { name: 'Nachschlagen' }).click();
}

async function openFromMore(page: Page, name: string) {
  if (isPhone(page)) {
    await nav(page).getByRole('button', { name: 'Mehr' }).click();
    await page
      .getByRole('main')
      .getByRole('button', { name: new RegExp(name) })
      .click();
  } else {
    await nav(page).getByRole('button', { name }).click();
  }
}

export const openSettings = (page: Page) => openFromMore(page, 'Einstellungen');
export const openStats = (page: Page) => openFromMore(page, 'Statistik');
export const openFlashcards = (page: Page) => openFromMore(page, 'Karteikasten');
