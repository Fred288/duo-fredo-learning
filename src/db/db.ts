import Dexie, { type EntityTable } from 'dexie';
import type { Verdict } from '../lib/answer';
import type { Completion } from '../progress/stats';

export interface SettingRow {
  key: string;
  value: unknown;
}

export interface AttemptRow {
  id?: number;
  exerciseId: string;
  lessonId: string;
  /** Bewertung beim ersten Versuch dieses Laufs. */
  verdict: Verdict;
  at: number;
}

export type CompletionRow = Completion & { id?: number };

export interface NoteRow {
  id?: number;
  /** ID der gemeldeten Übung. */
  itemId: string;
  unitId: string;
  text: string;
  at: number;
}

class YolDb extends Dexie {
  notes!: EntityTable<NoteRow, 'id'>;
  settings!: EntityTable<SettingRow, 'key'>;
  attempts!: EntityTable<AttemptRow, 'id'>;
  completions!: EntityTable<CompletionRow, 'id'>;

  constructor() {
    super('yol');
    // Schemaänderungen: neue version(n) mit .upgrade(), nie v1 umschreiben.
    this.version(1).stores({
      settings: 'key',
      attempts: '++id, exerciseId, lessonId, at',
      completions: '++id, lessonId, day',
    });
    // v2: lokale Fehlermeldungen/Notizen zu Inhalten. Bestehende Tabellen bleiben unverändert.
    this.version(2).stores({ notes: '++id, itemId, unitId, at' });
  }
}

export const db = new YolDb();

/** Führt eine DB-Operation aus; ohne verfügbares IndexedDB läuft die App im Speicher weiter. */
export async function safely<T>(op: () => Promise<T>, fallback: T): Promise<T> {
  try {
    return await op();
  } catch (e) {
    console.warn('IndexedDB nicht verfügbar, arbeite ohne Speicherung.', e);
    return fallback;
  }
}
