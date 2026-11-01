import { describe, expect, it } from 'vitest';
import type { Manifest } from '../../content/load';
import type { Placement } from '../../placement';
import type { Completion } from '../../progress/stats';
import { nextLesson } from './next-lesson';

const lesson = (id: string, type = 'grammar') => ({ id, type, title: id }) as never;
const unit = (id: string, lessons: ReturnType<typeof lesson>[]) =>
  ({ id, level: 'A1', title: id, unreviewed: 0, lessons, vocab: [] }) as Manifest['units'][number];

const units = [
  unit('u1', [lesson('u1-l1'), lesson('u1-l2')]),
  unit('u2', [lesson('u2-l1'), lesson('u2-h1', 'listening'), lesson('u2-l2')]),
  unit('u3', [lesson('u3-l1')]),
];

const done = (lessonId: string, at: number): Completion => ({
  lessonId,
  unitId: lessonId.replace(/-.\d+$/, ''),
  correct: 1,
  total: 1,
  at,
  day: '2026-05-01',
});

const placement = (startUnit: string | null, at = 100): Placement => ({
  at,
  startUnit,
  skipped: startUnit ? ['u1'] : [],
  shaky: [],
});

describe('nextLesson', () => {
  it('ohne Abschluss: die erste offene Lektion des Kurses', () => {
    expect(nextLesson(units, [])?.lesson.id).toBe('u1-l1');
  });

  it('nach einer Lektion: die nächste in derselben Unit', () => {
    expect(nextLesson(units, [done('u1-l1', 1)])?.lesson.id).toBe('u1-l2');
  });

  it('Unit fertig: die nächste Unit mit offener Lektion, Hören zählt nicht', () => {
    const c = [done('u1-l1', 1), done('u1-l2', 2), done('u2-l1', 3)];
    expect(nextLesson(units, c)?.lesson.id).toBe('u2-l2');
    expect(nextLesson(units, [...c, done('u2-l2', 4)])?.lesson.id).toBe('u3-l1');
  });

  it('der jüngste Abschluss entscheidet, nicht die Reihenfolge im Kurs', () => {
    const c = [done('u3-l1', 5), done('u1-l1', 9)];
    expect(nextLesson(units, c)?.lesson.id).toBe('u1-l2');
  });

  it('springt hinter dem Kursende zum ersten offenen Rest zurück', () => {
    const c = [done('u3-l1', 9), done('u2-l1', 1), done('u2-l2', 2)];
    expect(nextLesson(units, c)?.lesson.id).toBe('u1-l1');
  });

  it('alles geschafft: nichts', () => {
    const all = ['u1-l1', 'u1-l2', 'u2-l1', 'u2-l2', 'u3-l1'].map((id, i) => done(id, i + 1));
    expect(nextLesson(units, all)).toBeUndefined();
  });

  it('Wiederholen (srs), Hören und unbekannte Lektionen zählen nicht', () => {
    const c = [done('srs', 50), done('u2-h1', 60), done('u9-l1', 70)];
    expect(nextLesson(units, c)?.lesson.id).toBe('u1-l1');
  });

  it('mit Einstufung ohne neuen Abschluss: die Start-Unit', () => {
    expect(nextLesson(units, [done('u1-l1', 10)], placement('u2'))?.lesson.id).toBe('u2-l1');
  });

  it('Abschlüsse vor der Einstufung zählen nicht, danach schon', () => {
    const p = placement('u2', 100);
    expect(nextLesson(units, [done('u1-l1', 90)], p)?.lesson.id).toBe('u2-l1');
    expect(nextLesson(units, [done('u1-l1', 90), done('u2-l1', 110)], p)?.lesson.id).toBe('u2-l2');
  });

  it('verwaiste Start-Unit: die erste nicht bekannte Unit', () => {
    expect(nextLesson(units, [], placement('u9'))?.lesson.id).toBe('u2-l1');
  });

  const known = (startUnit: string | null, skipped: string[]): Placement => ({
    at: 100,
    startUnit,
    skipped,
    shaky: [],
  });

  it('Nachzuholendes geht vor Bekanntes (kein Start, u2 unsicher)', () => {
    expect(nextLesson(units, [], known(null, ['u1', 'u3']))?.lesson.id).toBe('u2-l1');
  });

  it('alles bekannt: die Karte bleibt, Kurs von vorn', () => {
    expect(nextLesson(units, [], known(null, ['u1', 'u2', 'u3']))?.lesson.id).toBe('u1-l1');
  });

  it('nach dem Kursende: Nachzuholendes vor bekannten Units', () => {
    const c = [done('u3-l1', 110)];
    expect(nextLesson(units, c, known('u3', ['u1']))?.lesson.id).toBe('u2-l1');
  });

  it('Auffrischung in bekannter Unit: Rest der Unit, danach zurück zur Start-Unit', () => {
    const p = known('u3', ['u1', 'u2']);
    expect(nextLesson(units, [done('u1-l1', 110)], p)?.lesson.id).toBe('u1-l2');
    const c = [done('u1-l1', 110), done('u1-l2', 120)];
    expect(nextLesson(units, c, p)?.lesson.id).toBe('u3-l1');
  });

  it('Start-Unit längst fertig, davor offen: die Karte fehlt nicht', () => {
    const c = [done('u3-l1', 10)];
    expect(nextLesson(units, c, known('u3', []))?.lesson.id).toBe('u1-l1');
  });

  it('die Unit kommt aus dem Kursverzeichnis, nicht aus dem Abschluss', () => {
    const moved = { ...done('u2-l1', 5), unitId: 'alt' };
    expect(nextLesson(units, [moved])?.lesson.id).toBe('u2-l2');
  });

  it('Einstufung ohne Start (alles bekannt): der Kurs von vorn', () => {
    expect(nextLesson(units, [], placement(null))?.lesson.id).toBe('u1-l1');
  });
});
