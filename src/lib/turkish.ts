// Textwerkzeuge für Türkisch. Groß/Klein nur locale-bewusst: I↔ı, İ↔i.

export const trLower = (s: string): string => s.normalize('NFC').toLocaleLowerCase('tr');
export const trUpper = (s: string): string => s.normalize('NFC').toLocaleUpperCase('tr');

export const SPECIAL_CHARS = ['ç', 'ğ', 'ı', 'İ', 'ö', 'ş', 'ü'] as const;

const FOLD: Record<string, string> = { ç: 'c', ğ: 'g', ı: 'i', ö: 'o', ş: 's', ü: 'u' };

/** Ersetzt türkische Sonderzeichen (Kleinbuchstaben) durch ihre Grundbuchstaben. */
export const foldDiacritics = (s: string): string => s.replace(/[çğıöşü]/g, (c) => FOLD[c]!);

/**
 * Vergleichsform einer Antwort: NFC, tr-Kleinschreibung, ohne Satzzeichen und
 * Apostrophe (İstanbul'da), Leerraum zusammengefasst.
 */
export function normalizeAnswer(s: string): string {
  return trLower(s)
    .replace(/['’`]/g, '')
    .replace(/[\p{P}\p{S}]/gu, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

export function levenshtein(a: string, b: string): number {
  const prev = Array.from({ length: b.length + 1 }, (_, j) => j);
  for (let i = 1; i <= a.length; i++) {
    let diag = prev[0]!;
    prev[0] = i;
    for (let j = 1; j <= b.length; j++) {
      const tmp = prev[j]!;
      prev[j] = Math.min(prev[j]! + 1, prev[j - 1]! + 1, diag + (a[i - 1] === b[j - 1] ? 0 : 1));
      diag = tmp;
    }
  }
  return prev[b.length]!;
}
