import { expect, test } from '@playwright/test';
import { speakables } from '../src/audio/speakables';
import { fakeSpeech, spokenTexts, TURKISH_VOICE as TURKISH } from './speech';
import { answer, loadUnit, playLesson } from './solve';

test('Nachschlagewerk: Anhören normal und langsam', async ({ page }) => {
  await fakeSpeech(page, TURKISH);
  await page.goto('/');
  await page.getByRole('button', { name: 'Nachschlagen' }).click();
  await page.getByRole('searchbox').fill('kitap');
  await page.getByRole('searchbox').press('Enter');
  await page.getByRole('button', { name: 'Anhören: kitap', exact: true }).click();
  await page.getByRole('button', { name: 'Langsam anhören: kitap' }).click();
  expect(await page.evaluate(() => window.__spoken)).toEqual([
    { text: 'kitap', rate: 0.9, lang: 'tr-TR' },
    { text: 'kitap', rate: 0.6, lang: 'tr-TR' },
  ]);
});

test('Einstellungen: Probe, Stimme wählen, Audio abschalten', async ({ page }) => {
  await fakeSpeech(page, [
    ...TURKISH,
    { name: 'Zweite Stimme', lang: 'tr_TR', local: true },
    { name: 'Anna', lang: 'de-DE', local: true },
  ]);
  await page.goto('/');
  await page.getByRole('button', { name: 'Einstellungen' }).click();
  await expect(page.getByText('Türkische Stimme gefunden: Test Türkçe.')).toBeVisible();
  await expect(page.getByRole('option')).toHaveText([
    'Automatisch',
    'Test Türkçe',
    'Zweite Stimme',
  ]);
  await page.getByRole('button', { name: 'Probe abspielen' }).click();
  expect(await spokenTexts(page)).toEqual(['Merhaba, nasılsınız?']);

  await page.getByLabel('Stimme').selectOption('Zweite Stimme');
  await expect(page.getByText('Türkische Stimme gefunden: Zweite Stimme.')).toBeVisible();

  await page.getByLabel('Türkisch vorlesen').uncheck();
  await expect(page.getByRole('button', { name: 'Probe abspielen' })).toHaveCount(0);
  // bleibt nach dem Neuladen aus (Dexie schreibt asynchron)
  await expect
    .poll(() =>
      page.evaluate(
        () =>
          new Promise<unknown>((resolve) => {
            const open = indexedDB.open('yol');
            open.onerror = () => resolve(undefined);
            open.onsuccess = () => {
              const get = open.result.transaction('settings').objectStore('settings').get('audioEnabled');
              get.onsuccess = () => {
                open.result.close();
                resolve(get.result?.value);
              };
              get.onerror = () => resolve(undefined);
            };
          }),
      ),
    )
    .toBe(false);
  await page.reload();
  await page.getByRole('button', { name: 'Einstellungen' }).click();
  await expect(page.getByLabel('Türkisch vorlesen')).not.toBeChecked();
});

test('ohne türkische Stimme: Hinweis statt Fehler, keine Knöpfe, Lektion läuft', async ({
  page,
}) => {
  await fakeSpeech(page, [{ name: 'Anna', lang: 'de-DE', local: true }]);
  await page.goto('/');
  await page.getByRole('button', { name: 'Einstellungen' }).click();
  await expect(page.getByText(/Keine türkische Stimme gefunden/)).toBeVisible();
  await expect(page.getByRole('button', { name: 'Probe abspielen' })).toHaveCount(0);

  await page.getByRole('button', { name: /Zurück/ }).click();
  await page.getByRole('button', { name: 'Nachschlagen' }).click();
  await page.getByRole('searchbox').fill('kitap');
  await page.getByRole('searchbox').press('Enter');
  await expect(page.getByRole('heading', { name: 'kitap', exact: true })).toBeVisible();
  await expect(page.getByRole('button', { name: /Anhören/ })).toHaveCount(0);
});

test('Browser ohne Sprachausgabe: Hinweis, App läuft', async ({ page }) => {
  await page.addInitScript(() => {
    Object.defineProperty(window, 'speechSynthesis', { value: undefined, configurable: true });
  });
  await page.goto('/');
  await page.getByRole('button', { name: 'Einstellungen' }).click();
  await expect(page.getByText(/unterstützt keine Sprachausgabe/)).toBeVisible();
});

test('Automatisch abspielen: Prompt beim Anzeigen, Lösung im Feedback, standardmäßig aus', async ({
  page,
}) => {
  await fakeSpeech(page, TURKISH);
  const unit = loadUnit('a1-u01');
  const lesson = unit.lessons[0]!;
  const startLesson = async () => {
    await page
      .getByRole('button', { name: new RegExp(`${lesson.title}$`) })
      .first()
      .click();
  };

  // Standard: aus, auch wenn Knöpfe da sind.
  await page.goto('/');
  await startLesson();
  await expect(page.getByRole('button', { name: 'Prüfen' })).toBeVisible();
  expect(await spokenTexts(page)).toEqual([]);

  // Einschalten und dieselbe Lektion spielen.
  await page.getByRole('button', { name: /Zurück/ }).click();
  await page.getByRole('button', { name: 'Einstellungen' }).click();
  await page.getByLabel('Automatisch abspielen').check();
  await page.getByRole('button', { name: /Zurück/ }).click();
  await startLesson();

  const expected: string[] = [];
  for (const ex of lesson.exercises) {
    const say = speakables(ex);
    await expect(page.getByRole('button', { name: 'Prüfen' })).toBeVisible();
    if (say.prompt) expected.push(say.prompt);
    await answer(page, ex, unit);
    await page.getByRole('button', { name: 'Prüfen' }).click();
    await expect(page.getByRole('status')).toContainText('Richtig!');
    if (say.solution) expected.push(say.solution);
    await page.getByRole('button', { name: 'Weiter' }).click();
  }
  expect(expected.length).toBeGreaterThan(0);
  await expect.poll(() => spokenTexts(page)).toEqual(expected);
});

test.describe('Hörlektion', () => {
  const unit = loadUnit('a1-u05');
  const lesson = unit.lessons.find((l) => l.type === 'listening')!;

  test('mit Stimme: Lektion erscheint, spielt den Satz und ist lösbar', async ({ page }) => {
    await fakeSpeech(page, TURKISH);
    await page.goto('/');
    await playLesson(page, 'a1-u05', lesson.id);
    await expect(
      page.getByText(`${lesson.exercises.length} von ${lesson.exercises.length}`),
    ).toBeVisible();
    // Jeder Satz wurde beim Anzeigen einmal von selbst gespielt (Autoplay-Einstellung ist aus).
    const spoken = await spokenTexts(page);
    for (const ex of lesson.exercises) {
      if (ex.type === 'listen') expect(spoken).toContain(ex.text);
    }
  });

  test('Text bleibt bis zur Antwort verborgen, danach mit Bedeutung sichtbar', async ({ page }) => {
    await fakeSpeech(page, TURKISH);
    await page.goto('/');
    const first = lesson.exercises[0]!;
    if (first.type !== 'listen') throw new Error('Hörübung erwartet');
    await page
      .getByRole('listitem')
      .filter({ has: page.getByRole('heading', { name: unit.title, exact: true }) })
      .getByRole('button', { name: new RegExp(`${lesson.title}$`) })
      .click();
    await expect(page.getByRole('button', { name: 'Anhören', exact: true })).toBeVisible();
    await expect(page.getByText(first.text, { exact: true })).toHaveCount(0);
    await answer(page, first, unit);
    await page.getByRole('button', { name: 'Prüfen' }).click();
    await expect(page.getByText(first.text, { exact: true }).first()).toBeVisible();
  });

  test('ohne Stimme: ausgeblendet mit Hinweis', async ({ page }) => {
    await fakeSpeech(page, []);
    await page.goto('/');
    await expect(page.getByText(/Hörübungen brauchen eine türkische Stimme/).first()).toBeVisible();
    await expect(page.getByRole('button', { name: /^Hören/ })).toHaveCount(0);
  });

  test('Jetzt nicht hören: Lektion endet ohne Wertung und ohne Abschluss', async ({ page }) => {
    await fakeSpeech(page, TURKISH);
    await page.goto('/');
    await page
      .getByRole('listitem')
      .filter({ has: page.getByRole('heading', { name: unit.title, exact: true }) })
      .getByRole('button', { name: new RegExp(`${lesson.title}$`) })
      .click();
    await page.getByRole('button', { name: 'Jetzt nicht hören' }).click();
    await expect(page.getByRole('heading', { name: 'Übersprungen' })).toBeVisible();
    await page.getByRole('button', { name: 'Zur Übersicht' }).click();
    await expect(page.getByText('Heute: 0 von 1 Lektionen')).toBeVisible();
  });
});
