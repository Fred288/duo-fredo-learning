// Lautklassen und Harmonieregeln des Türkischen.
import { trLower } from '../lib/turkish';

export const VOWELS = 'aeıioöuü';
const FRONT = 'eiöü';
const ROUNDED = 'oöuü';
// Merkwort für stimmlose Konsonanten: "fıstıkçı şahap"
const VOICELESS = 'fstkçşhp';

export const isVowel = (c: string): boolean => c.length === 1 && VOWELS.includes(c);
export const isFront = (v: string): boolean => FRONT.includes(v);
export const isRounded = (v: string): boolean => ROUNDED.includes(v);
export const isVoiceless = (c: string): boolean => c.length === 1 && VOICELESS.includes(c);

export function lastVowel(word: string): string | undefined {
  for (let i = word.length - 1; i >= 0; i--) {
    if (isVowel(word[i]!)) return word[i];
  }
  return undefined;
}

/** Zweifache Harmonie (Archiphonem A): hell → e, dunkel → a. */
export const harmony2 = (v: string): string => (isFront(v) ? 'e' : 'a');

/** Vierfache Harmonie (Archiphonem I): hell/dunkel × gerundet/ungerundet. */
export function harmony4(v: string): string {
  if (isFront(v)) return isRounded(v) ? 'ü' : 'i';
  return isRounded(v) ? 'u' : 'ı';
}

/** Erweichung am Stammauslaut vor Vokal: p→b, ç→c, t→d, k→ğ (nach n: k→g). */
export function soften(stem: string): { form: string; from: string; to: string } | undefined {
  const last = stem.at(-1);
  if (last === 'k' && stem.at(-2) === 'n')
    return { form: `${stem.slice(0, -1)}g`, from: 'k', to: 'g' };
  const map: Record<string, string> = { p: 'b', ç: 'c', t: 'd', k: 'ğ' };
  const to = last && map[last];
  return to ? { form: stem.slice(0, -1) + to, from: last, to } : undefined;
}

export const normalize = (s: string): string => trLower(s).trim();
