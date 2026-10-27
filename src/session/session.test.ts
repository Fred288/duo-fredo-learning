import { describe, expect, it } from 'vitest';
import type { Exercise } from '../content/schema';
import { createSession, currentExercise, next, skip, submit, summary } from './session';

const ex = (id: string): Exercise => ({
  id,
  type: 'free_text',
  direction: 'de_tr',
  prompt: id,
  answers: [id],
});

const ok = { verdict: 'correct' as const, hints: [] };
const wrong = { verdict: 'wrong' as const, hints: [] };

describe('Session', () => {
  it('läuft durch alle Übungen bis done', () => {
    let s = createSession([ex('a'), ex('b')]);
    s = next(submit(s, ok));
    expect(currentExercise(s)?.id).toBe('b');
    s = next(submit(s, ok));
    expect(s.phase).toBe('done');
    expect(summary(s)).toEqual({ correct: 2, total: 2 });
  });

  it('wiederholt falsche Übungen genau einmal am Ende', () => {
    let s = createSession([ex('a'), ex('b')]);
    s = submit(s, wrong);
    expect(s.phase).toBe('feedback');
    s = next(s);
    s = next(submit(s, ok)); // b
    expect(currentExercise(s)?.id).toBe('a');
    s = next(submit(s, wrong)); // a erneut falsch → nicht nochmal
    expect(s.phase).toBe('done');
    expect(summary(s)).toEqual({ correct: 1, total: 2 });
  });

  it('wertet den ersten Versuch, nicht die Wiederholung', () => {
    let s = createSession([ex('a')]);
    s = next(submit(s, wrong));
    s = next(submit(s, ok));
    expect(s.phase).toBe('done');
    expect(s.firstTry).toEqual({ a: 'wrong' });
  });

  it('ignoriert submit außerhalb der Antwortphase', () => {
    const s = submit(createSession([ex('a')]), ok);
    expect(submit(s, wrong)).toBe(s);
  });

  it('ist bei leerer Lektion sofort fertig', () => {
    expect(createSession([]).phase).toBe('done');
  });

  it('überspringt ohne Versuch, auch die Wiederholung am Ende', () => {
    let s = createSession([ex('a'), ex('b')]);
    s = next(submit(s, wrong));
    s = skip(next(submit(s, ok)));
    expect(s.phase).toBe('done');
    expect(summary(s)).toEqual({ correct: 1, total: 2 });

    s = skip(createSession([ex('a'), ex('b')]));
    expect(currentExercise(s)?.id).toBe('b');
    expect(s.firstTry).toEqual({});
  });

  it('überspringt mit sameType alle folgenden Übungen desselben Typs', () => {
    const listen = (id: string): Exercise => ({ id, type: 'listen', mode: 'dictation', text: id });
    let s = createSession([listen('h1'), ex('a'), listen('h2')]);
    s = skip(s, { sameType: true });
    expect(s.queue.map((e) => e.id)).toEqual(['a']);
    s = next(submit(s, ok));
    expect(s.phase).toBe('done');
    expect(skip(s)).toBe(s);
  });
});
