import { describe, expect, it } from 'vitest';
import { checkAnswer } from './answer';

const danke = ['Teşekkürler', 'Teşekkür ederim', 'Sağ ol'];

describe('checkAnswer', () => {
  it('akzeptiert jede gültige Alternative, tolerant bei Satzzeichen und Groß/Klein', () => {
    expect(checkAnswer('teşekkür ederim!', danke)).toEqual({
      verdict: 'correct',
      matched: 'Teşekkür ederim',
      hints: [],
    });
    expect(checkAnswer('SAĞ OL', danke).verdict).toBe('correct');
  });

  it('wertet fehlende Sonderzeichen mit Toleranz als richtig mit Hinweis', () => {
    expect(checkAnswer('tesekkurler', danke, { tolerateDiacritics: true })).toEqual({
      verdict: 'correct',
      matched: 'Teşekkürler',
      hints: ['diacritics'],
    });
  });

  it('wertet fehlende Sonderzeichen ohne Toleranz als fast richtig', () => {
    expect(checkAnswer('tesekkurler', danke, { tolerateDiacritics: false })).toEqual({
      verdict: 'almost',
      matched: 'Teşekkürler',
      hints: ['diacritics'],
    });
  });

  it('wertet einen Tippfehler bei längeren Wörtern als fast richtig', () => {
    expect(checkAnswer('teşekürler', danke)).toEqual({
      verdict: 'almost',
      matched: 'Teşekkürler',
      hints: ['typo'],
    });
  });

  it('toleriert keinen Tippfehler bei kurzen Wörtern', () => {
    expect(checkAnswer('el', ['ev']).verdict).toBe('wrong');
  });

  it('kombiniert Sonderzeichen und Tippfehler', () => {
    expect(checkAnswer('tesekurler', danke, { tolerateDiacritics: true })).toEqual({
      verdict: 'almost',
      matched: 'Teşekkürler',
      hints: ['diacritics', 'typo'],
    });
  });

  it('erlaubt in Grammatikübungen keine Tippfehler-Toleranz (evda ≠ evde)', () => {
    expect(checkAnswer('evda', ['evde'], { allowTypos: false }).verdict).toBe('wrong');
    expect(checkAnswer('evlarda', ['evlerde'], { allowTypos: false }).verdict).toBe('wrong');
  });

  it('wertet I/ı-Verwechslung nicht als Groß/Klein-Toleranz', () => {
    // "kiz" statt "kız" ist ein Sonderzeichenfehler, keine Schreibweise
    expect(checkAnswer('KIZ', ['kız']).verdict).toBe('correct');
    expect(checkAnswer('kiz', ['kız'], { tolerateDiacritics: false }).verdict).toBe('almost');
  });

  it('meldet falsche Antworten', () => {
    expect(checkAnswer('merhaba', danke)).toEqual({ verdict: 'wrong', hints: [] });
    expect(checkAnswer('   ', danke).verdict).toBe('wrong');
  });
});
