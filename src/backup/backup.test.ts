import 'fake-indexeddb/auto';
import { beforeEach, describe, expect, it } from 'vitest';
import { db } from '../db/db';
import type { Placement } from '../placement/record';
import type { Attempt, Completion } from '../progress/stats';
import { cardId, type Card, type CardRef } from '../srs/card';
import { reconcileCards } from '../srs/reconcile';
import { useNotes } from '../store/notes';
import { useProgress } from '../store/progress';
import { DEFAULT_SETTINGS, useSettings } from '../store/settings';
import {
  BACKUP_FORMAT,
  BACKUP_VERSION,
  MAX_BACKUP_BYTES,
  backupFileName,
  makeBackup,
  parseBackup,
  type BackupData,
} from './format';
import { exportBackup, importBackup, planImport } from './io';
import { mergeBackup } from './merge';
import { currentPlacement } from '../placement/record';

const attempt = (
  exerciseId: string,
  at: number,
  verdict: Attempt['verdict'] = 'correct',
): Attempt => ({
  exerciseId,
  lessonId: exerciseId.replace(/-e\d+$/, ''),
  verdict,
  at,
});
const completion = (lessonId: string, at: number): Completion => ({
  lessonId,
  unitId: lessonId.replace(/-l\d+$/, ''),
  correct: 5,
  total: 6,
  at,
  day: '2026-10-01',
});
const card = (ref: CardRef, unitId: string, lastAt: number, box = 2): Card => ({
  id: cardId(ref),
  ref,
  unitId,
  box,
  due: '2026-10-05',
  introduced: '2026-10-01',
  lastAt,
  lapses: 0,
});
const placement = (at: number, startUnit: string | null = 'a1-u03'): Placement => ({
  at,
  startUnit,
  skipped: startUnit ? ['a1-u01', 'a1-u02'] : [],
  shaky: startUnit ? ['a1-u02'] : [],
});
const ev: CardRef = { kind: 'vocab', vocabId: 'ev', dir: 'tr_de' };
const ex: CardRef = { kind: 'exercise', exerciseId: 'a1-u02-l2-e1' };

const empty = (): BackupData => ({
  settings: {},
  attempts: [],
  completions: [],
  cards: [],
  notes: [],
  placements: [],
});
const sample = (): BackupData => ({
  settings: { dailyGoal: 3, theme: 'dark' },
  attempts: [attempt('a1-u02-l2-e1', 100, 'wrong'), attempt('a1-u02-l2-e2', 200)],
  completions: [completion('a1-u02-l2', 300)],
  cards: [card(ev, 'a1-u02', 300), card(ex, 'a1-u02', 100, 1)],
  notes: [{ itemId: 'a1-u02-l2-e1', unitId: 'a1-u02', text: 'Glosse prüfen', at: 400 }],
  placements: [placement(500)],
});
const json = (v: unknown) => JSON.stringify(v);
const file = (data: BackupData = sample()) => makeBackup(data, 3, new Date('2026-10-28T10:00:00Z'));

describe('parseBackup', () => {
  it('liest eine selbst erzeugte Datei unverändert zurück', () => {
    const r = parseBackup(json(file()));
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(r.backup.data).toEqual(sample());
    expect(r.backup.exportedAt).toBe('2026-10-28T10:00:00.000Z');
    expect(Object.values(r.skipped).every((n) => n === 0)).toBe(true);
  });

  it('lässt Auto-IDs der Tabellen weg', () => {
    const data = sample();
    const withIds = { ...data, attempts: data.attempts.map((a, i) => ({ ...a, id: i + 1 })) };
    expect(file(withIds).data.attempts[0]).not.toHaveProperty('id');
  });

  it('nennt den Grund, wenn die Datei nicht passt', () => {
    expect(parseBackup('kein json')).toEqual({ ok: false, reason: 'not_json' });
    expect(parseBackup(json({ format: 'anki', version: 1 }))).toEqual({
      ok: false,
      reason: 'foreign',
    });
    expect(parseBackup(json([1, 2]))).toEqual({ ok: false, reason: 'foreign' });
    expect(parseBackup(json({ ...file(), version: BACKUP_VERSION + 1 }))).toEqual({
      ok: false,
      reason: 'too_new',
    });
    expect(
      parseBackup(json({ format: BACKUP_FORMAT, version: 1, exportedAt: 'gestern', data: {} })),
    ).toEqual({
      ok: false,
      reason: 'damaged',
    });
    expect(
      parseBackup(json({ format: BACKUP_FORMAT, version: 1, exportedAt: '2026-10-28' })),
    ).toEqual({
      ok: false,
      reason: 'damaged',
    });
    expect(parseBackup(' '.repeat(MAX_BACKUP_BYTES + 1))).toEqual({
      ok: false,
      reason: 'too_large',
    });
  });

  it('überspringt ungültige Zeilen und zählt sie', () => {
    const f = file();
    const broken = {
      ...f,
      data: {
        ...f.data,
        settings: { ...f.data.settings, dailyGoal: 99, unbekannt: true },
        attempts: [...f.data.attempts, { exerciseId: 'x', verdict: 'vielleicht', at: 1 }],
        cards: [...f.data.cards, { ...card(ev, 'a1-u02', 1), id: 'vo:de_tr:ev' }, 'Unsinn'],
        notes: [...f.data.notes, { itemId: 'x', unitId: 'a1-u01', text: '', at: 1 }],
        placements: [...f.data.placements, { at: 1, startUnit: '', skipped: [], shaky: [] }],
      },
    };
    const r = parseBackup(json(broken));
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(r.skipped).toEqual({
      settings: 2,
      attempts: 1,
      completions: 0,
      cards: 2,
      notes: 1,
      placements: 1,
    });
    expect(r.backup.data.settings).toEqual({ theme: 'dark' });
    expect(r.backup.data.attempts).toHaveLength(2);
    expect(r.backup.data.cards).toHaveLength(2);
  });

  it('nimmt bei doppelter Karten-ID die zuletzt geübte', () => {
    const f = file({ ...empty(), cards: [card(ev, 'a1-u02', 500, 4), card(ev, 'a1-u02', 100, 1)] });
    const r = parseBackup(json(f));
    expect(r.ok && r.backup.data.cards).toEqual([card(ev, 'a1-u02', 500, 4)]);
    expect(r.ok && r.skipped.cards).toBe(1);
  });

  it('liest Dateien von vor dem Einstufungstest (ohne placements)', () => {
    const old = file() as { data: Partial<BackupData> };
    delete old.data.placements;
    const f = json(old);
    expect(f).not.toContain('placements');
    const r = parseBackup(f);
    expect(r.ok && r.backup.data.placements).toEqual([]);
  });

  it('akzeptiert fehlende Tabellen als leer', () => {
    const r = parseBackup(
      json({ format: BACKUP_FORMAT, version: 1, exportedAt: '2026-10-28T10:00:00Z', data: {} }),
    );
    expect(r.ok && r.backup.data).toEqual(empty());
  });

  it('benennt die Datei nach dem Tag', () => {
    expect(backupFileName('2026-10-28')).toBe('yol-backup-2026-10-28.json');
  });
});

describe('mergeBackup', () => {
  it('ersetzt alles, Einstellungen eingeschlossen', () => {
    const local = { ...sample(), settings: { dailyGoal: 1 } };
    const { data, summary } = mergeBackup(
      local,
      { ...empty(), settings: { theme: 'light' } },
      'replace',
    );
    expect(data).toEqual({ ...empty(), settings: { theme: 'light' } });
    expect(summary.settings).toBe(true);
    expect(summary.dropped).toEqual({
      attempts: 2,
      completions: 1,
      cards: 2,
      notes: 1,
      placements: 1,
    });
  });

  it('führt ohne Dubletten zusammen und behält die lokalen Einstellungen', () => {
    const incoming = sample();
    incoming.settings = { dailyGoal: 7 };
    incoming.attempts.push(attempt('a1-u03-l1-e1', 900));
    incoming.notes.push({ itemId: 'a1-u03-l1-e1', unitId: 'a1-u03', text: 'neu', at: 901 });
    incoming.placements.push(placement(950, null));
    const { data, summary } = mergeBackup(sample(), incoming, 'merge');
    expect(data.settings).toEqual(sample().settings);
    expect(data.attempts).toHaveLength(3);
    expect(data.completions).toHaveLength(1);
    expect(data.notes).toHaveLength(2);
    expect(summary.added).toEqual({
      attempts: 1,
      completions: 0,
      cards: 0,
      notes: 1,
      placements: 1,
    });
    expect(summary.settings).toBe(false);
    // Die jüngere Rücknahme aus der Datei gilt danach (`currentPlacement`).
    expect(currentPlacement(data.placements)).toBeUndefined();
  });

  it('nimmt bei gleicher Karte den jüngeren Stand, bei Gleichstand den lokalen', () => {
    const local = { ...empty(), cards: [card(ev, 'a1-u02', 300, 2), card(ex, 'a1-u02', 100, 1)] };
    const incoming = {
      ...empty(),
      cards: [
        card(ev, 'a1-u02', 500, 4),
        { ...card(ex, 'a1-u02', 100, 5) },
        card({ kind: 'vocab', vocabId: 'kitap', dir: 'tr_de' }, 'a1-u02', 50),
      ],
    };
    const { data, summary } = mergeBackup(local, incoming, 'merge');
    const box = (id: string) => data.cards.find((c) => c.id === id)?.box;
    expect(box(cardId(ev))).toBe(4);
    expect(box(cardId(ex))).toBe(1);
    expect(data.cards).toHaveLength(3);
    expect(summary).toMatchObject({ updatedCards: 1, added: { cards: 1 } });
  });

  it('lässt verwaiste Karten drin; reconcileCards räumt sie danach wie gewohnt auf', () => {
    const gone = card({ kind: 'vocab', vocabId: 'gibtsnicht', dir: 'tr_de' }, 'a1-u02', 1);
    const moved = card({ kind: 'vocab', vocabId: 'ev', dir: 'tr_de' }, 'a1-u01', 1);
    const { data } = mergeBackup(empty(), { ...empty(), cards: [gone, moved] }, 'merge');
    expect(data.cards).toHaveLength(2);
    const r = reconcileCards([{ id: 'a1-u02', vocab: ['ev'] }], data.cards);
    expect(r.gone).toEqual([gone.id]);
    expect(r.moved).toEqual([{ ...moved, unitId: 'a1-u02' }]);
  });
});

describe('Export und Import über IndexedDB', () => {
  beforeEach(async () => {
    await Promise.all(
      [db.settings, db.attempts, db.completions, db.cards, db.notes, db.placements].map((t) =>
        t.clear(),
      ),
    );
    useSettings.setState({ ...DEFAULT_SETTINGS, loaded: false });
    useProgress.setState({
      completions: [],
      attempts: [],
      cards: [],
      placements: [],
      loaded: false,
    });
    useNotes.setState({ notes: [] });
  });

  async function seed(data: BackupData) {
    await db.settings.bulkPut(
      Object.entries(data.settings).map(([key, value]) => ({ key, value })),
    );
    await db.attempts.bulkAdd(data.attempts);
    await db.completions.bulkAdd(data.completions);
    await db.cards.bulkPut(data.cards);
    await db.notes.bulkAdd(data.notes);
    await db.placements.bulkAdd(data.placements);
  }

  it('Rundlauf: Export, leeren, Import (ersetzen) ergibt denselben Stand', async () => {
    await seed(sample());
    const exported = await exportBackup(new Date('2026-10-28T10:00:00Z'));
    expect(exported.app.dbVersion).toBe(db.verno);

    await Promise.all([
      db.attempts.clear(),
      db.cards.clear(),
      db.notes.clear(),
      db.placements.clear(),
    ]);
    const parsed = parseBackup(json(exported));
    if (!parsed.ok) throw new Error(parsed.reason);
    await importBackup(parsed.backup, 'replace');

    const again = await exportBackup(new Date('2026-10-28T10:00:00Z'));
    expect(again).toEqual(exported);
    // Die Stores zeigen den importierten Stand ohne Neustart.
    expect(useProgress.getState()).toMatchObject({ loaded: true });
    expect(useProgress.getState().cards).toHaveLength(2);
    expect(useSettings.getState().dailyGoal).toBe(3);
    expect(useNotes.getState().notes).toHaveLength(1);
    expect(currentPlacement(useProgress.getState().placements)?.startUnit).toBe('a1-u03');
  });

  it('Zusammenführen zweimal hintereinander verdoppelt nichts', async () => {
    await seed(sample());
    const exported = await exportBackup();
    await importBackup(exported, 'merge');
    const twice = await importBackup(exported, 'merge');
    expect(twice.summary.added).toEqual({
      attempts: 0,
      completions: 0,
      cards: 0,
      notes: 0,
      placements: 0,
    });
    expect(await db.placements.count()).toBe(1);
    expect(await db.attempts.count()).toBe(2);
    expect(useProgress.getState().attempts).toHaveLength(2);
  });

  it('Vorschau schreibt nichts', async () => {
    await seed(sample());
    const plan = await planImport(file(empty()), 'replace');
    expect(plan.summary.dropped.attempts).toBe(2);
    expect(await db.attempts.count()).toBe(2);
  });

  it('Ersetzen setzt Einstellungen, die die Datei nicht kennt, auf den Standard zurück', async () => {
    await seed({ ...empty(), settings: { dailyGoal: 5, showStreak: false } });
    await importBackup(file({ ...empty(), settings: { dailyGoal: 2 } }), 'replace');
    expect(useSettings.getState()).toMatchObject({ dailyGoal: 2, showStreak: true });
  });
});
