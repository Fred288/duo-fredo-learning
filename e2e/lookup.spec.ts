import { expect, test, type Page } from '@playwright/test';

const open = async (page: Page) => {
  await page.goto('/');
  await page.getByRole('button', { name: 'Nachschlagen' }).click();
  await expect(page.getByRole('searchbox')).toBeFocused();
};

test('Lupe öffnet das Nachschlagewerk, Sonderzeichen sind egal', async ({ page }) => {
  await open(page);
  await page.getByRole('searchbox').fill('kitabi');
  await expect(page.getByRole('button', { name: /^kitap\b/ })).toBeVisible();
  await page.getByRole('searchbox').fill('KAPI');
  await expect(page.getByRole('button', { name: /^kapı/ })).toBeVisible();
});

test('gebeugte Form führt auf die Grundform, Eintrag zeigt Formtabelle', async ({ page }) => {
  await open(page);
  await page.getByRole('searchbox').fill('evlerde');
  await expect(page.getByText('evlerde = Plural + Lokativ')).toBeVisible();
  await page.getByRole('searchbox').press('Enter');
  await expect(page.getByRole('heading', { name: 'ev', exact: true })).toBeVisible();
  await page.getByText('Formen', { exact: true }).click();
  await expect(page.getByRole('cell', { name: 'evlerden' })).toBeVisible();
  await expect(page.getByText('Noch nicht im Wiederholen.')).toBeVisible();
  await page.getByRole('button', { name: /Zurück/ }).click();
  await expect(page.getByRole('searchbox')).toHaveValue('evlerde');
});

test('deutsche Suche findet das türkische Wort', async ({ page }) => {
  await open(page);
  await page.getByRole('searchbox').fill('Tisch');
  await expect(page.getByRole('button', { name: /^masa\b/ })).toBeVisible();
});

test('Grammatik-Abschnitt öffnet die Erklärkarte an der Überschrift, Zurück erhält die Suche', async ({
  page,
}) => {
  await open(page);
  await page.getByRole('searchbox').fill('Plural: -ler');
  await page.getByRole('button', { name: /Der Plural: -ler oder -lar/ }).click();
  const heading = page.getByRole('heading', { name: 'Der Plural: -ler oder -lar' });
  await expect(heading).toBeVisible();
  await expect(heading).toBeFocused();
  await page.getByRole('button', { name: /Nachschlagen/ }).click();
  await expect(page.getByRole('searchbox')).toHaveValue('Plural: -ler');
});

test('Taste „/“ öffnet das Nachschlagewerk, Escape leert die Suche', async ({ page }) => {
  await page.goto('/');
  await expect(page.getByRole('heading', { name: 'Yol' })).toBeVisible();
  await page.keyboard.press('/');
  await expect(page.getByRole('searchbox')).toBeFocused();
  await page.keyboard.type('ev');
  await page.keyboard.press('Escape');
  await expect(page.getByRole('searchbox')).toHaveValue('');
  await page.keyboard.press('Escape');
  await expect(page.getByRole('heading', { name: 'Yol' })).toBeVisible();
});

test('Verb-Eintrag zeigt zusammengesetzte Zeiten und infinite Formen', async ({ page }) => {
  await open(page);
  await page.getByRole('searchbox').fill('geliyordum');
  await expect(page.getByText(/geliyordum = Präsens, mit idi/)).toBeVisible();
  await page.getByRole('searchbox').press('Enter');
  await page.getByText('Zusammengesetzte Zeiten und Wünsche', { exact: true }).click();
  await expect(page.getByRole('cell', { name: 'geliyordum', exact: true })).toBeVisible();
  await expect(page.getByRole('cell', { name: 'gelirse', exact: true })).toBeVisible();
  await page.getByText('Partizipien, Verbalnomen, Konverbien', { exact: true }).click();
  await expect(page.getByRole('cell', { name: 'geldiğim', exact: true })).toBeVisible();
  await expect(page.getByRole('cell', { name: 'gelince', exact: true })).toBeVisible();
});

test('infinite Form führt auf das Verb zurück', async ({ page }) => {
  await open(page);
  await page.getByRole('searchbox').fill('okuduğum');
  await expect(page.getByText(/okuduğum = Partizip -dik \+ mein/)).toBeVisible();
});
