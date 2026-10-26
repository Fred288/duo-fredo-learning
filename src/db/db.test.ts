import 'fake-indexeddb/auto';
import Dexie from 'dexie';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { db, safely } from './db';

beforeEach(async () => {
  if (!db.isOpen()) await db.open();
  await Promise.all([
    db.settings.clear(),
    db.attempts.clear(),
    db.completions.clear(),
    db.notes.clear(),
    db.cards.clear(),
  ]);
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

describe('Migration v1 → v2', () => {
  it('behält Daten aus Version 1 und ergänzt die Notizen-Tabelle', async () => {
    db.close();
    await Dexie.delete('yol');

    // Datenbank wie in Version 1 anlegen und befüllen
    const v1 = new Dexie('yol');
    v1.version(1).stores({
      settings: 'key',
      attempts: '++id, exerciseId, lessonId, at',
      completions: '++id, lessonId, day',
    });
    await v1.table('settings').put({ key: 'dailyGoal', value: 5 });
    v1.close();

    // Aktuelle Version öffnet und migriert
    await db.open();
    expect((await db.settings.get('dailyGoal'))?.value).toBe(5);
    await db.notes.add({ itemId: 'x', unitId: 'a1-u01', text: 'Tippfehler', at: 1 });
    expect(await db.notes.where('unitId').equals('a1-u01').count()).toBe(1);
  });
});

describe('Migration v2 → v3', () => {
  it('legt Karten für bisher falsch beantwortete Übungen an', async () => {
    db.close();
    await Dexie.delete('yol');

    const v2 = new Dexie('yol');
    v2.version(1).stores({
      settings: 'key',
      attempts: '++id, exerciseId, lessonId, at',
      completions: '++id, lessonId, day',
    });
    v2.version(2).stores({ notes: '++id, itemId, unitId, at' });
    const at = (day: string) => new Date(`${day}T12:00:00`).getTime();
    await v2.table('attempts').bulkAdd([
      { exerciseId: 'a1-u02-l1-e3', lessonId: 'a1-u02-l1', verdict: 'wrong', at: at('2026-04-02') },
      {
        exerciseId: 'a1-u02-l1-e3',
        lessonId: 'a1-u02-l1',
        verdict: 'correct',
        at: at('2026-04-03'),
      },
      {
        exerciseId: 'a1-u02-l1-e4',
        lessonId: 'a1-u02-l1',
        verdict: 'correct',
        at: at('2026-04-02'),
      },
    ]);
    v2.close();

    await db.open();
    expect(await db.attempts.count()).toBe(3);
    expect(await db.cards.toArray()).toEqual([
      {
        id: 'ex:a1-u02-l1-e3',
        ref: { kind: 'exercise', exerciseId: 'a1-u02-l1-e3' },
        unitId: 'a1-u02',
        box: 2,
        due: '2026-04-06',
        introduced: '2026-04-02',
        lastAt: at('2026-04-03'),
        lapses: 0,
      },
    ]);
    expect(await db.cards.where('due').belowOrEqual('2026-04-06').count()).toBe(1);
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
