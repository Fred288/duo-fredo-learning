import { expect, test } from '@playwright/test';
import { playLesson } from './solve';

const today = () => {
  const d = new Date();
  const p = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`;
};

test('Statistik: leer, dann mit Lektion und schwierigem Wort', async ({ page }) => {
  await page.goto('/');
  await page.getByRole('button', { name: 'Statistik' }).click();
  await expect(page.getByRole('heading', { name: 'Statistik', level: 1 })).toBeVisible();
  await expect(page.getByText('Noch nichts, das öfter falsch war.')).toBeVisible();
  await page.getByRole('button', { name: /Zurück/ }).click();

  await playLesson(page, 'a1-u01', 'a1-u01-l1');
  await page.getByRole('button', { name: 'Zur Übersicht' }).click();

  // Eine Vokabelkarte, die schon dreimal falsch war, fällig heute.
  const day = today();
  await page.evaluate(
    (card) =>
      new Promise<void>((resolve, reject) => {
        const open = indexedDB.open('yol');
        open.onerror = () => reject(open.error);
        open.onsuccess = () => {
          const tx = open.result.transaction('cards', 'readwrite');
          tx.objectStore('cards').put(card);
          tx.oncomplete = () => {
            open.result.close();
            resolve();
          };
          tx.onerror = () => reject(tx.error);
        };
      }),
    {
      id: 'vo:tr_de:merhaba',
      ref: { kind: 'vocab', vocabId: 'merhaba', dir: 'tr_de' },
      unitId: 'a1-u01',
      box: 1,
      due: day,
      introduced: day,
      lastAt: Date.now(),
      lapses: 3,
    },
  );
  await page.reload();
  await page.getByRole('button', { name: 'Statistik' }).click();

  const units = page.getByRole('region', { name: 'Units' });
  await expect(units.getByText(/1 von 4 Lektionen · \d+ % richtig/).first()).toBeVisible();
  const hard = page.getByRole('region', { name: 'Fällt schwer' });
  await expect(hard.getByText('3× falsch')).toBeVisible();
  await hard.getByRole('button', { name: /merhaba/ }).click();
  await expect(page.getByRole('heading', { name: 'merhaba', level: 2 })).toBeVisible();
});
