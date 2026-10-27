import { expect, test, type Page } from '@playwright/test';
import { speakables } from '../src/audio/speakables';
import { answer, loadUnit } from './solve';

// speechSynthesis wird gefälscht: Es gibt Stimmen (oder keine) und jede Wiedergabe landet in
// window.__spoken. So lässt sich Audio ohne echte Sprachausgabe prüfen.
interface Spoken {
  text: string;
  rate: number;
  lang: string;
}
declare global {
  interface Window {
    __spoken: Spoken[];
  }
}

async function fakeSpeech(page: Page, voices: { name: string; lang: string; local: boolean }[]) {
  await page.addInitScript((list) => {
    window.__spoken = [];
    class Utterance {
      lang = '';
      rate = 1;
      voice: unknown = null;
      onend: (() => void) | null = null;
      onerror: (() => void) | null = null;
      constructor(public text: string) {}
    }
    const native = list.map((v) => ({
      voiceURI: v.name,
      name: v.name,
      lang: v.lang,
      localService: v.local,
      default: false,
    }));
    const synth = {
      getVoices: () => native,
      speak(u: Utterance) {
        window.__spoken.push({ text: u.text, rate: u.rate, lang: u.lang });
        setTimeout(() => u.onend?.(), 0);
      },
      cancel() {},
      addEventListener() {},
    };
    Object.defineProperty(window, 'speechSynthesis', { value: synth, configurable: true });
    Object.defineProperty(window, 'SpeechSynthesisUtterance', {
      value: Utterance,
      configurable: true,
    });
  }, voices);
}

const TURKISH = [{ name: 'Test Türkçe', lang: 'tr-TR', local: true }];
const spokenTexts = (page: Page) => page.evaluate(() => window.__spoken.map((s) => s.text));

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
  await page.waitForTimeout(300);
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
