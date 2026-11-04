import { db, safely } from '../db/db';
import { useFlashcards } from '../store/flashcards';
import { useNotes } from '../store/notes';
import { useProgress } from '../store/progress';
import { DEFAULT_SETTINGS, pickKnown, useSettings, type Settings } from '../store/settings';
import { makeBackup, type Backup, type BackupData } from './format';
import { mergeBackup, type ImportMode, type Merged } from './merge';

/** Liest den gespeicherten Stand aus IndexedDB (wirft ohne IndexedDB). */
async function readLocal(): Promise<BackupData> {
  return db.transaction(
    'r',
    [
      db.settings,
      db.attempts,
      db.completions,
      db.cards,
      db.notes,
      db.placements,
      db.flashes,
      db.flashMarks,
    ],
    async () => {
      const [settings, attempts, completions, cards, notes, placements, flashes, flashMarks] =
        await Promise.all([
          db.settings.toArray(),
          db.attempts.toArray(),
          db.completions.toArray(),
          db.cards.toArray(),
          db.notes.toArray(),
          db.placements.toArray(),
          db.flashes.toArray(),
          db.flashMarks.toArray(),
        ]);
      return {
        settings: pickKnown(
          Object.fromEntries(settings.map((r) => [r.key, r.value])) as Partial<Settings>,
        ),
        attempts,
        completions,
        cards,
        notes,
        placements,
        flashes,
        flashMarks,
      };
    },
  );
}

/** Stand im Speicher, falls IndexedDB fehlt (privater Modus, gesperrter Speicher). */
function fromStores(): BackupData {
  const { completions, attempts, cards, placements } = useProgress.getState();
  const s = useSettings.getState();
  const settings = Object.fromEntries(
    (Object.keys(DEFAULT_SETTINGS) as (keyof Settings)[]).map((k) => [k, s[k]]),
  ) as Partial<Settings>;
  return {
    settings,
    completions,
    attempts,
    cards,
    notes: useNotes.getState().notes,
    placements,
    flashes: useFlashcards.getState().flashes,
    flashMarks: useFlashcards.getState().marks,
  };
}

export async function exportBackup(now: Date = new Date()): Promise<Backup> {
  const data = (await safely(readLocal, undefined)) ?? fromStores();
  return makeBackup(data, db.verno, now);
}

/** Was der Import ändern würde (für die Vorschau), ohne zu schreiben. */
export async function planImport(backup: Backup, mode: ImportMode): Promise<Merged> {
  return mergeBackup(await readLocal(), backup.data, mode);
}

/**
 * Schreibt den Import in einer Transaktion (alles oder nichts) und lädt die Stores neu. Wirft,
 * wenn IndexedDB fehlt: ein Import nur in den Speicher wäre beim nächsten Start verloren.
 */
export async function importBackup(backup: Backup, mode: ImportMode): Promise<Merged> {
  const tables = [
    db.settings,
    db.attempts,
    db.completions,
    db.cards,
    db.notes,
    db.placements,
    db.flashes,
    db.flashMarks,
  ];
  const merged = await db.transaction('rw', tables, async () => {
    const result = mergeBackup(await readLocal(), backup.data, mode);
    const { data } = result;
    await Promise.all(tables.map((t) => t.clear()));
    await db.settings.bulkPut(
      Object.entries(data.settings).map(([key, value]) => ({ key, value })),
    );
    await db.attempts.bulkAdd(data.attempts.map(withoutId));
    await db.completions.bulkAdd(data.completions.map(withoutId));
    await db.cards.bulkPut(data.cards.map((c) => ({ ...c })));
    await db.notes.bulkAdd(data.notes.map(withoutId));
    await db.placements.bulkAdd(data.placements.map(withoutId));
    await db.flashes.bulkAdd(data.flashes.map(withoutId));
    await db.flashMarks.bulkPut(data.flashMarks.map((m) => ({ ...m })));
    return result;
  });
  await Promise.all([
    useProgress.getState().reload(),
    useSettings.getState().load(),
    useNotes.getState().reload(),
    useFlashcards.getState().reload(),
  ]);
  return merged;
}

/** Auto-IDs neu vergeben: lokale und importierte Zeilen können dieselbe ID tragen. */
function withoutId<T extends object>(row: T): T {
  const copy = { ...row } as T & { id?: unknown };
  delete copy.id;
  return copy;
}
