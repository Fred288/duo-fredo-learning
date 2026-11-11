import { describe, expect, it } from 'vitest';
import { cardNote } from './card-note';

describe('cardNote', () => {
  const today = '2026-05-01';

  it('nennt Phase und nächsten Termin', () => {
    expect(cardNote({ box: 1, due: '2026-05-02' }, 0, 'correct', today)).toBe(
      'Wiederholen: Phase 1 von 6, wieder morgen',
    );
    expect(cardNote({ box: 3, due: '2026-05-08' }, 0, 'correct', today)).toBe(
      'Wiederholen: Phase 3 von 6, wieder in 7 Tagen',
    );
    expect(cardNote({ box: 2, due: '2026-04-20' }, 0, 'almost', today)).toBe(
      'Wiederholen: Phase 2 von 6, wieder heute',
    );
  });

  it('nennt die Fehlerzahl, einen gerade passierten einzelnen Fehler aber nicht', () => {
    expect(cardNote(undefined, 1, 'wrong', today)).toBeUndefined();
    expect(cardNote(undefined, 1, 'correct', today)).toBe('bisher einmal falsch');
    expect(cardNote({ box: 1, due: '2026-05-02' }, 3, 'wrong', today)).toBe(
      'Wiederholen: Phase 1 von 6, wieder morgen · bisher 3-mal falsch',
    );
    expect(cardNote(undefined, 0, 'correct', today)).toBeUndefined();
  });
});
