import { describe, expect, it } from 'vitest';
import { foldDiacritics, levenshtein, normalizeAnswer, trLower, trUpper } from './turkish';

describe('Groß/Kleinschreibung (tr)', () => {
  it('behandelt I/ı und İ/i korrekt', () => {
    expect(trLower('ISPARTA')).toBe('ısparta');
    expect(trLower('İSTANBUL')).toBe('istanbul');
    expect(trUpper('istanbul')).toBe('İSTANBUL');
    expect(trUpper('ılık')).toBe('ILIK');
  });

  it('normalisiert auf NFC', () => {
    const decomposed = 'güzel'; // ü als u + Trema
    expect(trLower(decomposed)).toBe('güzel');
  });
});

describe('normalizeAnswer', () => {
  it('ignoriert Satzzeichen, Groß/Klein und Mehrfach-Leerzeichen', () => {
    expect(normalizeAnswer('  Günaydın!  ')).toBe('günaydın');
    expect(normalizeAnswer('Ben  çay içiyorum.')).toBe('ben çay içiyorum');
    expect(normalizeAnswer('„Merhaba“, nasılsın?')).toBe('merhaba nasılsın');
  });

  it("entfernt Apostrophe bei Eigennamen (İstanbul'da)", () => {
    expect(normalizeAnswer("İstanbul'da")).toBe('istanbulda');
    expect(normalizeAnswer('İstanbul’da')).toBe('istanbulda');
  });
});

describe('foldDiacritics', () => {
  it('ersetzt türkische Sonderzeichen durch Grundbuchstaben', () => {
    expect(foldDiacritics('çğıöşü')).toBe('cgiosu');
    expect(foldDiacritics('teşekkürler')).toBe('tesekkurler');
  });
});

describe('levenshtein', () => {
  it.each([
    ['ev', 'ev', 0],
    ['kitap', 'kitab', 1],
    ['merhaba', 'merhba', 1],
    ['günaydın', 'gnaydın', 1],
    ['evde', 'evda', 1],
    ['abc', 'cba', 2],
    ['', 'abc', 3],
  ])('%s ↔ %s = %i', (a, b, d) => expect(levenshtein(a, b)).toBe(d));
});
