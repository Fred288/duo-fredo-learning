import type { Page } from '@playwright/test';

// speechSynthesis wird gefälscht: Es gibt Stimmen (oder keine) und jede Wiedergabe landet in
// window.__spoken. So lässt sich Audio ohne echte Sprachausgabe prüfen.
export interface Spoken {
  text: string;
  rate: number;
  lang: string;
}
declare global {
  interface Window {
    __spoken: Spoken[];
  }
}

export async function fakeSpeech(
  page: Page,
  voices: { name: string; lang: string; local: boolean }[],
) {
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

export const TURKISH_VOICE = [{ name: 'Test Türkçe', lang: 'tr-TR', local: true }];
export const spokenTexts = (page: Page) => page.evaluate(() => window.__spoken.map((s) => s.text));
