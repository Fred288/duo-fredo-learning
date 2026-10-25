import { describe, expect, it } from 'vitest';
import { harmony2, harmony4, isVoiceless, lastVowel } from './phonology';

describe('Vokalharmonie', () => {
  it.each([
    ['e', 'e'],
    ['i', 'e'],
    ['ö', 'e'],
    ['ü', 'e'],
    ['a', 'a'],
    ['ı', 'a'],
    ['o', 'a'],
    ['u', 'a'],
  ])('2-fach nach %s → %s', (v, out) => expect(harmony2(v)).toBe(out));

  it.each([
    ['e', 'i'],
    ['i', 'i'],
    ['ö', 'ü'],
    ['ü', 'ü'],
    ['a', 'ı'],
    ['ı', 'ı'],
    ['o', 'u'],
    ['u', 'u'],
  ])('4-fach nach %s → %s', (v, out) => expect(harmony4(v)).toBe(out));
});

describe('lastVowel', () => {
  it('findet den letzten Vokal', () => {
    expect(lastVowel('kitap')).toBe('a');
    expect(lastVowel('göz')).toBe('ö');
    expect(lastVowel('brr')).toBeUndefined();
  });
});

describe('isVoiceless (fıstıkçı şahap)', () => {
  it.each(['f', 's', 't', 'k', 'ç', 'ş', 'h', 'p'])('%s ist stimmlos', (c) =>
    expect(isVoiceless(c)).toBe(true),
  );
  it.each(['b', 'd', 'g', 'v', 'z', 'r', 'l', 'n', 'm', 'e'])('%s ist nicht stimmlos', (c) =>
    expect(isVoiceless(c)).toBe(false),
  );
});
