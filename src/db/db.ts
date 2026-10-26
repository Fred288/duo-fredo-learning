import Dexie, { type EntityTable } from 'dexie';
import type { Verdict } from '../lib/answer';
import type { Completion } from '../progress/stats';
import type { Card } from '../srs/card';
import { leitner } from '../srs/leitner';
import { seedFromAttempts } from '../srs/seed';

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

/** SRS-Karte; Schlüssel ist die Karten-ID (ex:…, vo:…). */
export type CardRow = Card;

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
  cards!: EntityTable<CardRow, 'id'>;

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
    // v3: SRS-Karten, aus den bisherigen Versuchen vorbelegt (nur Übungen mit einem Fehler,
    // da die Versuche den Übungstyp nicht kennen). Ein anderer Scheduler braucht eine neue
    // Version, die den Kartenstand umrechnet.
    this.version(3)
      .stores({ cards: 'id, due, unitId' })
      .upgrade(async (tx) => {
        const attempts = await tx.table<AttemptRow>('attempts').toArray();
        await tx.table<CardRow>('cards').bulkPut(seedFromAttempts(attempts, leitner));
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
