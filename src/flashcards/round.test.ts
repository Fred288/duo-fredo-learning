import { describe, expect, it } from 'vitest';
import { againCount, current, flip, grade, isDone, startRound, summary, type Round } from './round';
import type { DeckCard } from './types';

const card = (ref: string): DeckCard => ({
  kind: 'vocab',
  ref,
  dir: 'tr_de',
  unitId: 'a1-u01',
  lessonId: 'a1-u01-l1',
});
const refs = (r: Round) => r.queue.map((c) => c.ref);

describe('Runde', () => {
  it('nicht gewusst wandert ans Ende, bis alles gewusst ist', () => {
    let r = startRound([card('a'), card('b'), card('c')]);
    expect(current(r)?.ref).toBe('a');
    r = flip(r);
    expect(r.flipped).toBe(true);

    let g = grade(r, false);
    expect(g.record).toEqual({ card: card('a'), correct: false });
    r = g.round;
    expect(r.flipped).toBe(false);
    expect(refs(r)).toEqual(['b', 'c', 'a']);
    expect(againCount(r)).toBe(1);

    r = grade(r, true).round;
    r = grade(r, true).round;
    // Zweiter Versuch auf a: kein neuer Eintrag.
    g = grade(r, true);
    expect(g.record).toBeUndefined();
    r = g.round;
    expect(isDone(r)).toBe(true);
    expect(summary(r)).toEqual({ total: 3, firstTry: 2, retried: 1, wrong: [card('a')] });
  });

  it('bleibt bei einer einzelnen falschen Karte auf ihr', () => {
    let r = startRound([card('a')]);
    r = grade(r, false).round;
    expect(refs(r)).toEqual(['a']);
    r = grade(r, true).round;
    expect(isDone(r)).toBe(true);
  });

  it('doppelte Karten zählen einmal; fertig ändert nichts mehr', () => {
    const r = startRound([card('a'), card('a')]);
    expect(r.cards).toHaveLength(1);
    const done = grade(r, true).round;
    expect(grade(done, false)).toEqual({ round: done });
    expect(flip(done)).toBe(done);
  });

  it('Abbruch: noch offene Karten zählen nicht als gewusst', () => {
    let r = startRound([card('a'), card('b')]);
    r = grade(r, false).round;
    expect(summary(r)).toMatchObject({ total: 2, firstTry: 0, retried: 1 });
  });
});
