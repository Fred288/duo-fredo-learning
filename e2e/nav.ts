// Navigation der App für die E2E-Tests. Auf dem Handy (unter 768 px) liegen Statistik und
// Einstellungen unter „Mehr“, ab Tablet stehen sie in der Seitenleiste; die Hilfen kennen beides.
import { expect, type Page } from '@playwright/test';

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
