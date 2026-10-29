import Dexie, { type EntityTable } from 'dexie';
import type { Verdict } from '../lib/answer';
import type { Completion } from '../progress/stats';
import type { Placement } from '../placement/record';
import type { Card } from '../srs/card';
import { addDays } from '../progress/day';
import { seedFromAttempts } from '../srs/seed';
import { isDue, type Scheduler } from '../srs/scheduler';

/**
 * Eingefrorener Stand des Leitner-Verfahrens für das v3-Upgrade: ändert sich der laufende
 * Scheduler später, seedet das Upgrade bei Nachzüglern trotzdem wie bisher.
 */
const LEITNER_V3_DAYS = [1, 3, 7, 14, 30];
const leitnerV3: Scheduler = {
  id: 'leitner-v1',
  introduce: (verdict, today) => {
    const box = verdict === 'correct' ? 2 : 1;
    return { box, due: addDays(today, LEITNER_V3_DAYS[box - 1]!), lapses: 0 };
  },
  review: (card, verdict, today, at) => {
    if (verdict === 'wrong') {
      return {
        ...card,
        box: 1,
        due: addDays(today, LEITNER_V3_DAYS[0]!),
        lapses: card.lapses + 1,
        lastAt: at,
      };
    }
    if (!isDue(card, today)) return { ...card, lastAt: at };
    const box = verdict === 'correct' ? Math.min(card.box + 1, LEITNER_V3_DAYS.length) : card.box;
    return { ...card, box, due: addDays(today, LEITNER_V3_DAYS[box - 1]!), lastAt: at };
  },
};

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

/** Angenommene Einstufung; gültig ist die jüngste Zeile. */
export type PlacementRow = Placement & { id?: number };

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
  placements!: EntityTable<PlacementRow, 'id'>;

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
        await tx.table<CardRow>('cards').bulkPut(seedFromAttempts(attempts, leitnerV3));
      });
    // v4: angenommene Einstufungen (nur anhängen). Neue, leere Tabelle; nichts umzurechnen.
    this.version(4)
      .stores({ placements: '++id, at' })
      .upgrade(() => undefined);
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
