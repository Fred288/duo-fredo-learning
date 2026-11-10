import { expect, test } from '@playwright/test';
import { playLesson } from './solve';
import { openSettings, openToday } from './nav';

test('Wochen- und Monatsziel: aus dem Tagesziel abgeleitet, Woche ab Montag, abschaltbar', async ({
  page,
}) => {
  // Montag, 4. Mai 2026 (Mai hat 31 Tage).
  await page.clock.setFixedTime(new Date('2026-05-04T10:00:00'));
  await page.goto('/');
  const goals = page.getByRole('region', { name: 'Lernziele' });
  await expect(goals.getByText('Heute: 0 von 1 Lektionen')).toBeVisible();
  await expect(goals.getByText('Diese Woche: 0 von 7 Lektionen')).toBeVisible();
  await expect(goals.getByText('Diesen Monat: 0 von 31 Lektionen')).toBeVisible();

  await playLesson(page, 'a1-u01', 'a1-u01-l1');
  await page.getByRole('button', { name: 'Zur Übersicht' }).click();
  await openToday(page);
  await expect(goals.getByText('Tagesziel erreicht')).toBeVisible();
  await expect(goals.getByText('Diese Woche: 1 von 7 Lektionen')).toBeVisible();
  await expect(goals.getByText('Diesen Monat: 1 von 31 Lektionen')).toBeVisible();

  // Montag darauf: neue Woche, gleicher Monat.
  await page.clock.setFixedTime(new Date('2026-05-11T10:00:00'));
  await page.reload();
  await expect(goals.getByText('Heute: 0 von 1 Lektionen')).toBeVisible();
  await expect(goals.getByText('Diese Woche: 0 von 7 Lektionen')).toBeVisible();
  await expect(goals.getByText('Diesen Monat: 1 von 31 Lektionen')).toBeVisible();

  // Höheres Tagesziel hebt Woche und Monat mit.
  await openSettings(page);
  await page.getByRole('button', { name: 'Tagesziel erhöhen' }).click();
  await openToday(page);
  await expect(goals.getByText('Diese Woche: 0 von 14 Lektionen')).toBeVisible();
  await expect(goals.getByText('Diesen Monat: 1 von 62 Lektionen')).toBeVisible();

  await openSettings(page);
  await page.getByLabel('Wochen- und Monatsziel zeigen').uncheck();
  await openToday(page);
  await expect(goals.getByText('Heute: 0 von 2 Lektionen')).toBeVisible();
  await expect(goals.getByRole('progressbar')).toHaveCount(1);
  await page.reload();
  await expect(goals.getByText('Heute: 0 von 2 Lektionen')).toBeVisible();
  await expect(goals.getByRole('progressbar')).toHaveCount(1);
});
