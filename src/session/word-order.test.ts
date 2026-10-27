import { describe, expect, it } from 'vitest';
import type { Exercise } from '../content/schema';
import {
  gradeOrder,
  matchedVariant,
  orderHints,
  orderOf,
  orderTokens,
  sentenceFor,
  validOrders,
} from './word-order';

type SovPuzzle = Extract<Exercise, { type: 'sov_puzzle' }>;

const tea: SovPuzzle = {
  id: 'a1-u08-s1-l5-e1',
  type: 'sov_puzzle',
  prompt: 'Ich trinke jeden Morgen Tee.',
  text: 'Her sabah çay içiyorum.',
  chunks: [
    { text: 'her sabah', role: 'time' },
    { text: 'çay', role: 'object_bare' },
    { text: 'içiyorum', role: 'predicate' },
  ],
};

const now: SovPuzzle = {
  id: 'a1-u08-s1-l5-e5',
  type: 'sov_puzzle',
  prompt: 'Was machst du jetzt?',
  text: 'Şimdi ne yapıyorsun?',
  chunks: [
    { text: 'şimdi', role: 'time' },
    { text: 'ne', role: 'question' },
    { text: 'yapıyorsun', role: 'predicate' },
  ],
  orders: [{ order: [1, 2, 0], note: 'Nachgestellt wirkt „şimdi“ wie ein Nachtrag.' }],
};

const ahmet: SovPuzzle = {
  id: 'a1-u08-s1-l5-e2',
  type: 'sov_puzzle',
  prompt: 'Ahmet geht zur Schule.',
  text: 'Ahmet okula gidiyor.',
  chunks: [
    { text: 'Ahmet', role: 'subject' },
    { text: 'okula', role: 'place' },
    { text: 'gidiyor', role: 'predicate' },
  ],
};

const join = (...parts: string[]) => parts.join('|');

describe('orderTokens', () => {
  it('mischt stabil und nie in eine gültige Reihenfolge', () => {
    for (const ex of [tea, now, ahmet]) {
      const tokens = orderTokens(ex);
      expect([...tokens].sort()).toEqual(ex.chunks.map((c) => c.text).sort());
      const order = orderOf(ex, tokens.join('|'))!;
      expect(validOrders(ex)).not.toContainEqual(order);
      expect(orderTokens(ex)).toEqual(tokens);
    }
  });
});

describe('gradeOrder', () => {
  it('Grundreihenfolge ist richtig, der Satz kommt groß mit Satzzeichen zurück', () => {
    expect(gradeOrder(tea, join('her sabah', 'çay', 'içiyorum'))).toEqual({
      verdict: 'correct',
      matched: 'Her sabah çay içiyorum.',
      hints: [],
    });
  });

  it('hinterlegte Variante ist richtig, mit ihrem Hinweis', () => {
    const answer = join('ne', 'yapıyorsun', 'şimdi');
    expect(gradeOrder(now, answer)).toMatchObject({
      verdict: 'correct',
      matched: 'Ne yapıyorsun şimdi?',
    });
    expect(matchedVariant(now, answer)?.note).toContain('Nachtrag');
    expect(matchedVariant(now, join('şimdi', 'ne', 'yapıyorsun'))).toBeUndefined();
  });

  it('andere Reihenfolgen sind falsch, mit Regelhinweis', () => {
    expect(gradeOrder(tea, join('çay', 'her sabah', 'içiyorum'))).toEqual({
      verdict: 'wrong',
      hints: ['bare_object'],
    });
    expect(gradeOrder(ahmet, join('Ahmet', 'gidiyor', 'okula')).hints).toEqual(['predicate_last']);
    expect(gradeOrder(now, join('ne', 'şimdi', 'yapıyorsun')).hints).toEqual(['question_word']);
  });

  it('unvollständige oder fremde Antworten sind falsch ohne Hinweis', () => {
    expect(gradeOrder(tea, join('her sabah', 'içiyorum'))).toEqual({ verdict: 'wrong', hints: [] });
    expect(gradeOrder(tea, join('her sabah', 'su', 'içiyorum')).verdict).toBe('wrong');
    expect(gradeOrder(tea, '')).toEqual({ verdict: 'wrong', hints: [] });
  });

  it('Groß/Klein der Bausteine zählt nicht', () => {
    expect(gradeOrder(tea, join('Her sabah', 'çay', 'içiyorum')).verdict).toBe('correct');
  });
});

describe('sentenceFor und orderHints', () => {
  it('baut den Satz; Namen bleiben groß', () => {
    expect(sentenceFor(ahmet, [0, 1, 2])).toBe('Ahmet okula gidiyor.');
    expect(sentenceFor(now, [1, 2, 0])).toBe('Ne yapıyorsun şimdi?');
  });

  it('eine Regel, die schon die Grundreihenfolge nicht erfüllt, meldet sich nicht', () => {
    const again: SovPuzzle = {
      ...now,
      text: 'Ne zaman tekrar çalışabilirim?',
      chunks: [
        { text: 'ne zaman', role: 'question' },
        { text: 'tekrar', role: 'complement' },
        { text: 'çalışabilirim', role: 'predicate' },
      ],
      orders: undefined,
    };
    expect(orderHints(again, [1, 0, 2])).toEqual([]);
    expect(orderHints(again, [0, 2, 1])).toEqual(['predicate_last']);
  });

  it('keine Hinweise für die Grundreihenfolge', () => {
    expect(orderHints(tea, [0, 1, 2])).toEqual([]);
    expect(orderHints(now, [0, 1, 2])).toEqual([]);
  });
});
