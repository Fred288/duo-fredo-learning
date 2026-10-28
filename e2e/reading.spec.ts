import { expect, test } from '@playwright/test';
import { fakeSpeech, TURKISH_VOICE } from './speech';

declare global {
  interface Window {
    __recording: string[];
  }
}

// Mikrofon und MediaRecorder gefälscht: Aufnahme liefert einen leeren Audio-Blob.
test.beforeEach(async ({ page }) => {
  await fakeSpeech(page, TURKISH_VOICE);
  await page.addInitScript(() => {
    window.__recording = [];
    const stream = { getTracks: () => [{ stop: () => window.__recording.push('released') }] };
    Object.defineProperty(navigator, 'mediaDevices', {
      configurable: true,
      value: { getUserMedia: () => Promise.resolve(stream) },
    });
    class FakeRecorder {
      state = 'inactive';
      mimeType = 'audio/webm';
      ondataavailable: ((e: { data: Blob }) => void) | null = null;
      onstop: (() => void) | null = null;
      start() {
        this.state = 'recording';
        window.__recording.push('start');
      }
      stop() {
        this.state = 'inactive';
        window.__recording.push('stop');
        this.ondataavailable?.({ data: new Blob(['x'], { type: 'audio/webm' }) });
        this.onstop?.();
      }
    }
    (window as unknown as { MediaRecorder: unknown }).MediaRecorder = FakeRecorder;
  });
});

test('Lesetext: Wort nachschlagen, Übersetzung, Nachsprechen, dann Fragen', async ({ page }) => {
  await page.goto('/');
  const unit = page
    .getByRole('listitem')
    .filter({ has: page.getByRole('heading', { name: 'Was hast du gemacht?', exact: true }) });
  await unit.getByRole('button', { name: /Ein neues Leben in İzmir$/ }).click();
  await expect(
    page.getByRole('heading', { name: 'Lesetext: Ein neues Leben in İzmir' }),
  ).toBeVisible();

  // Gebeugte Form führt auf die Grundform.
  await page.getByRole('button', { name: 'taşındım', exact: true }).click();
  const sheet = page.getByRole('dialog', { name: 'Wort: taşındım' });
  await expect(sheet.getByRole('heading', { name: 'taşınmak' })).toBeVisible();
  await expect(sheet.getByText('umziehen')).toBeVisible();
  // Im Lesetext kein Sprung zur Erklärkarte.
  await expect(sheet.getByRole('button', { name: 'Erklärung' })).toHaveCount(0);
  await page.keyboard.press('Escape');
  await expect(sheet).toHaveCount(0);
  await expect(page.getByRole('button', { name: 'taşındım', exact: true })).toBeFocused();

  // Glossar-Wort zeigt die Glosse.
  await page.getByRole('button', { name: 'Elif', exact: true }).first().click();
  await expect(page.getByRole('dialog').getByText('Elif (Frauenname)')).toBeVisible();
  await page.getByRole('button', { name: 'Schließen' }).click();

  await page.getByLabel('Übersetzung zeigen').check();
  await expect(page.getByText('Letztes Jahr bin ich nach İzmir gezogen.')).toBeVisible();

  // Nachsprechen: aufnehmen, beenden, dann eigene Aufnahme und Vorbild.
  const first = "Geçen yıl İzmir'e taşındım.";
  await page.getByRole('button', { name: `Nachsprechen aufnehmen: ${first}` }).click();
  await page.getByRole('button', { name: 'Aufnahme beenden' }).click();
  await expect(
    page.getByRole('button', { name: `Eigene Aufnahme anhören: ${first}` }),
  ).toBeVisible();
  await expect.poll(() => page.evaluate(() => window.__spoken.map((s) => s.text))).toContain(first);
  expect(await page.evaluate(() => window.__recording)).toEqual(['start', 'stop', 'released']);

  await page.getByRole('button', { name: 'Zu den Fragen' }).click();
  await expect(page.getByText('Was hat die Person in İzmir zuerst gemacht?')).toBeVisible();
  await page.getByText('Text anzeigen').click();
  await expect(page.getByRole('button', { name: 'taşındım', exact: true })).toBeVisible();
});

test('Nachsprechen lässt sich in den Einstellungen abschalten', async ({ page }) => {
  await page.goto('/');
  await page.getByRole('button', { name: 'Einstellungen' }).click();
  await page.getByLabel('Nachsprechen (Mikrofon)').uncheck();
  await page.getByRole('button', { name: /Zurück/ }).click();
  await page.getByRole('button', { name: /Ein neues Leben in İzmir$/ }).click();
  await expect(page.getByRole('button', { name: /^Nachsprechen aufnehmen/ })).toHaveCount(0);
});
