import { describe, expect, it } from 'vitest';
import { cardId, vocabStatus, type Card, type VocabRef } from '.';

const card = (ref: VocabRef, box: number, due: string): Card => ({
  id: cardId(ref),
  ref,
  unitId: 'a1-u10',
  box,
  due,
  introduced: '2026-10-01',
  lastAt: 0,
  lapses: 0,
});

describe('vocabStatus', () => {
  const cards = [
    card({ kind: 'vocab', vocabId: 'yemek-essen', dir: 'tr_de' }, 2, '2026-10-28'),
    card({ kind: 'vocab', vocabId: 'yemek', dir: 'tr_de' }, 1, '2026-10-20'),
    card({ kind: 'vocab', vocabId: 'yemek', dir: 'de_tr' }, 3, '2026-10-27'),
  ];

  it('liest beide Richtungen über die vocabId, Homonyme getrennt', () => {
    expect(vocabStatus(cards, 'yemek', '2026-10-27')).toEqual({
      tr_de: { box: 1, due: '2026-10-20', isDue: true },
      de_tr: { box: 3, due: '2026-10-27', isDue: true },
    });
    expect(vocabStatus(cards, 'yemek-essen', '2026-10-27')).toEqual({
      tr_de: { box: 2, due: '2026-10-28', isDue: false },
      de_tr: undefined,
    });
  });

  it('ohne Karte: noch nicht eingeführt', () => {
    expect(vocabStatus(cards, 'kitap', '2026-10-27')).toEqual({
      tr_de: undefined,
      de_tr: undefined,
    });
  });
});
