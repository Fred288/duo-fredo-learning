import { describe, expect, it } from 'vitest';
import { speechText } from './speech-text';

describe('speechText', () => {
  it('lässt normalen Text unverändert', () => {
    expect(speechText('Bir çay lütfen.')).toBe('Bir çay lütfen.');
    expect(speechText("İstanbul'da")).toBe("İstanbul'da");
  });

  it('entfernt Klammerzusätze und Auslassungspunkte', () => {
    expect(speechText('dün (gestern)')).toBe('dün');
    expect(speechText('… ne kadar?')).toBe('ne kadar?');
  });

  it('nimmt bei Alternativen die erste', () => {
    expect(speechText('anne / ana')).toBe('anne');
  });

  it('Suffix-Notation ist nicht sprechbar', () => {
    expect(speechText('-de')).toBeUndefined();
    expect(speechText('-den sonra')).toBe('sonra');
    expect(speechText('…')).toBeUndefined();
    expect(speechText('  ')).toBeUndefined();
  });
});
