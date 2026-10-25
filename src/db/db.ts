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

class YolDb extends Dexie {
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
