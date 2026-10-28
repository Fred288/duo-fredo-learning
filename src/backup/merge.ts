import type { Card } from '../srs/card';
import { TABLES, type BackupData, type Table } from './format';

export type ImportMode = 'merge' | 'replace';

export interface ImportSummary {
  mode: ImportMode;
  /** Zeilen, die durch den Import neu dazukommen (bei `replace`: alle aus der Datei). */
  added: Record<Table, number>;
  /** Vorhandene Karten, die der Import mit einem jüngeren Stand überschreibt (nur `merge`). */
  updatedCards: number;
  /** Lokale Zeilen, die verloren gehen (nur `replace`). */
  dropped: Record<Table, number>;
  /** Übernimmt der Import die Einstellungen der Datei? */
  settings: boolean;
}

export interface Merged {
  data: BackupData;
  summary: ImportSummary;
}

const zero = (): Record<Table, number> => ({ attempts: 0, completions: 0, cards: 0, notes: 0 });

/** Dublettenschlüssel je Tabelle: Auto-IDs sind gerätelokal, gleiche Einträge erkennt man am Inhalt. */
const KEYS: { [T in Exclude<Table, 'cards'>]: (row: BackupData[T][number]) => string } = {
  attempts: (a) => `${a.exerciseId}|${a.at}|${a.verdict}`,
  completions: (c) => `${c.lessonId}|${c.at}`,
  notes: (n) => `${n.itemId}|${n.at}|${n.text}`,
};

function union<T>(local: readonly T[], incoming: readonly T[], key: (row: T) => string) {
  const seen = new Set(local.map(key));
  const fresh: T[] = [];
  for (const row of incoming) {
    const k = key(row);
    if (seen.has(k)) continue;
    seen.add(k);
    fresh.push(row);
  }
  return { rows: [...local, ...fresh], added: fresh.length };
}

/** Gleiche Karten-ID: der zuletzt geübte Stand gewinnt, bei Gleichstand der lokale. */
function mergeCards(local: readonly Card[], incoming: readonly Card[]) {
  const byId = new Map(local.map((c) => [c.id, c]));
  let added = 0;
  let updated = 0;
  for (const card of incoming) {
    const mine = byId.get(card.id);
    if (!mine) added++;
    else if (card.lastAt > mine.lastAt) updated++;
    else continue;
    byId.set(card.id, card);
  }
  return { rows: [...byId.values()], added, updated };
}

/**
 * Berechnet den Stand nach dem Import (rein). `merge` vereinigt ohne Dubletten und behält die
 * lokalen Einstellungen; `replace` übernimmt die Datei vollständig, Einstellungen eingeschlossen.
 * Verwaiste Karten (Unit/Vokabel entfernt) bleiben drin; `reconcileCards` räumt sie wie sonst auf.
 */
export function mergeBackup(local: BackupData, incoming: BackupData, mode: ImportMode): Merged {
  if (mode === 'replace') {
    const added = zero();
    const dropped = zero();
    for (const t of TABLES) {
      added[t] = incoming[t].length;
      dropped[t] = local[t].length;
    }
    return {
      data: { ...incoming },
      summary: { mode, added, dropped, updatedCards: 0, settings: true },
    };
  }

  const attempts = union(local.attempts, incoming.attempts, KEYS.attempts);
  const completions = union(local.completions, incoming.completions, KEYS.completions);
  const notes = union(local.notes, incoming.notes, KEYS.notes);
  const cards = mergeCards(local.cards, incoming.cards);
  return {
    data: {
      settings: local.settings,
      attempts: attempts.rows,
      completions: completions.rows,
      notes: notes.rows,
      cards: cards.rows,
    },
    summary: {
      mode,
      added: {
        attempts: attempts.added,
        completions: completions.added,
        notes: notes.added,
        cards: cards.added,
      },
      dropped: zero(),
      updatedCards: cards.updated,
      settings: false,
    },
  };
}
