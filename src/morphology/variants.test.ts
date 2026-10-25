import { describe, expect, it } from 'vitest';
import { suffixVariants } from './variants';

describe('suffixVariants', () => {
  it('liefert Harmonie-Varianten', () => {
    expect(suffixVariants('PL').sort()).toEqual(['lar', 'ler']);
    expect(suffixVariants('LOC').sort()).toEqual(['da', 'de', 'ta', 'te']);
  });

  it('liefert Varianten mit und ohne Pufferlaut', () => {
    const acc = suffixVariants('ACC');
    expect(acc).toEqual(expect.arrayContaining(['yi', 'yı', 'yü', 'yu', 'i', 'ı', 'ü', 'u']));
    expect(acc).toHaveLength(8);
  });
});
