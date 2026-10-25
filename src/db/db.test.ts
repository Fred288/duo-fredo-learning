import 'fake-indexeddb/auto';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { db, safely } from './db';

beforeEach(async () => {
  await Promise.all([db.settings.clear(), db.attempts.clear(), db.completions.clear()]);
});

describe('db', () => {
  it('speichert und liest Einstellungen', async () => {
    await db.settings.put({ key: 'dailyGoal', value: 3 });
    expect((await db.settings.get('dailyGoal'))?.value).toBe(3);
  });

  it('schreibt Versuche und Abschlüsse und findet sie per Index', async () => {
    await db.attempts.add({
      exerciseId: 'a1-u01-l1-e1',
      lessonId: 'a1-u01-l1',
      verdict: 'wrong',
      at: 1,
    });
    await db.completions.add({
      lessonId: 'a1-u01-l1',
      unitId: 'a1-u01',
      correct: 2,
      total: 3,
      at: 2,
      day: '2026-03-01',
    });
    expect(await db.attempts.where('lessonId').equals('a1-u01-l1').count()).toBe(1);
    expect(await db.completions.where('day').equals('2026-03-01').count()).toBe(1);
  });
});

describe('safely', () => {
  it('liefert das Ergebnis, wenn die Operation klappt', async () => {
    expect(await safely(async () => 42, 0)).toBe(42);
  });

  it('fällt bei Fehlern auf den Ersatzwert zurück', async () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
    expect(await safely(() => Promise.reject(new Error('blockiert')), 'leer')).toBe('leer');
    expect(warn).toHaveBeenCalled();
    warn.mockRestore();
  });
});
