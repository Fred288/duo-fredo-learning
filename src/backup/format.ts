import { z } from 'zod';
import type { Attempt, Completion } from '../progress/stats';
import { cardId, type Card } from '../srs/card';
import { pickKnown, type Settings } from '../store/settings';

// Sicherung des Lernstands als JSON (SPEC 3.6): versioniert, Zeilen einzeln geprüft.

export const BACKUP_FORMAT = 'yol-backup';
/** Aktuelle Formatversion; eine ältere Datei läuft vor dem Prüfen durch `MIGRATIONS`. */
export const BACKUP_VERSION = 1;
/** Größere Dateien werden nicht gelesen (Schutz vor versehentlich gewählten Fremddateien). */
export const MAX_BACKUP_BYTES = 20 * 1024 * 1024;

export interface BackupNote {
  itemId: string;
  unitId: string;
  text: string;
  at: number;
}

export interface BackupData {
  settings: Partial<Settings>;
  attempts: Attempt[];
  completions: Completion[];
  cards: Card[];
  notes: BackupNote[];
}

export interface Backup {
  format: typeof BACKUP_FORMAT;
  version: number;
  /** ISO-Zeitpunkt des Exports. */
  exportedAt: string;
  app: { dbVersion: number };
  data: BackupData;
}

export type Table = Exclude<keyof BackupData, 'settings'>;
export const TABLES: readonly Table[] = ['attempts', 'completions', 'cards', 'notes'];

const day = z.string().regex(/^\d{4}-\d{2}-\d{2}$/);
const time = z.number().int().nonnegative();
const id = z.string().min(1);
const verdict = z.enum(['correct', 'almost', 'wrong']);

const AttemptRow = z.object({ exerciseId: id, lessonId: id, verdict, at: time });
const CompletionRow = z.object({
  lessonId: id,
  unitId: id,
  correct: z.number().int().nonnegative(),
  total: z.number().int().nonnegative(),
  at: time,
  day,
});
const CardRef = z.discriminatedUnion('kind', [
  z.object({ kind: z.literal('exercise'), exerciseId: id }),
  z.object({ kind: z.literal('vocab'), vocabId: id, dir: z.enum(['tr_de', 'de_tr']) }),
]);
const CardRow = z
  .object({
    id,
    ref: CardRef,
    unitId: id,
    box: z.number().int().min(1),
    due: day,
    introduced: day,
    lastAt: time,
    lapses: z.number().int().nonnegative(),
  })
  // Die ID ist aus der Referenz abgeleitet; passt sie nicht, wäre die Karte doppelt oder verwaist.
  .refine((c) => c.id === cardId(c.ref));
const NoteRow = z.object({ itemId: id, unitId: id, text: z.string().min(1), at: time });

const ROWS: { [T in Table]: z.ZodType<BackupData[T][number]> } = {
  attempts: AttemptRow,
  completions: CompletionRow,
  cards: CardRow,
  notes: NoteRow,
};

const Envelope = z.object({
  format: z.literal(BACKUP_FORMAT),
  version: z.number().int().min(1),
  exportedAt: z.string().refine((s) => !Number.isNaN(Date.parse(s))),
  app: z.object({ dbVersion: z.number().int() }).optional(),
  data: z.object({
    settings: z.record(z.string(), z.unknown()).optional(),
    attempts: z.array(z.unknown()).optional(),
    completions: z.array(z.unknown()).optional(),
    cards: z.array(z.unknown()).optional(),
    notes: z.array(z.unknown()).optional(),
  }),
});
type Envelope = z.infer<typeof Envelope>;

/**
 * Hebt eine Datei der Version v auf v + 1 (Schlüssel = Ausgangsversion). Heute leer; eine neue
 * Formatversion trägt hier ihren Schritt ein, statt den Leser alter Dateien zu ändern.
 */
export const MIGRATIONS: Record<number, (b: Envelope) => Envelope> = {};

/** Gründe, aus denen eine Datei nicht geladen wird; zugleich i18n-Schlüssel `backup.error.*`. */
export type BackupError = 'too_large' | 'not_json' | 'foreign' | 'too_new' | 'damaged';

export type Skipped = Record<Table, number> & { settings: number };

export type ParseResult =
  { ok: true; backup: Backup; skipped: Skipped } | { ok: false; reason: BackupError };

/** Liest eine Sicherung. Ungültige Zeilen fallen heraus und werden gezählt, statt alles zu verwerfen. */
export function parseBackup(text: string): ParseResult {
  if (text.length > MAX_BACKUP_BYTES) return { ok: false, reason: 'too_large' };
  let raw: unknown;
  try {
    raw = JSON.parse(text);
  } catch {
    return { ok: false, reason: 'not_json' };
  }
  if (!raw || typeof raw !== 'object' || (raw as { format?: unknown }).format !== BACKUP_FORMAT) {
    return { ok: false, reason: 'foreign' };
  }
  const version = (raw as { version?: unknown }).version;
  if (typeof version === 'number' && version > BACKUP_VERSION)
    return { ok: false, reason: 'too_new' };

  const parsed = Envelope.safeParse(raw);
  if (!parsed.success) return { ok: false, reason: 'damaged' };
  let env = parsed.data;
  while (env.version < BACKUP_VERSION) {
    const step = MIGRATIONS[env.version];
    if (!step) return { ok: false, reason: 'damaged' };
    env = step(env);
  }

  const skipped: Skipped = { settings: 0, attempts: 0, completions: 0, cards: 0, notes: 0 };
  const rows = <T extends Table>(table: T): BackupData[T] => {
    const out: BackupData[T][number][] = [];
    for (const row of env.data[table] ?? []) {
      const r = ROWS[table].safeParse(row);
      if (r.success) out.push(r.data);
      else skipped[table]++;
    }
    return out as BackupData[T];
  };

  const storedSettings = env.data.settings ?? {};
  const settings = pickKnown(storedSettings as Partial<Settings>);
  skipped.settings = Object.keys(storedSettings).length - Object.keys(settings).length;

  // Doppelte Karten-IDs in einer Datei: die zuletzt geübte gilt.
  const cards = new Map<string, Card>();
  for (const c of rows('cards')) {
    const prev = cards.get(c.id);
    if (prev) skipped.cards++;
    if (!prev || c.lastAt >= prev.lastAt) cards.set(c.id, c);
  }

  return {
    ok: true,
    skipped,
    backup: {
      format: BACKUP_FORMAT,
      version: BACKUP_VERSION,
      exportedAt: env.exportedAt,
      app: { dbVersion: env.app?.dbVersion ?? 0 },
      data: {
        settings,
        attempts: rows('attempts'),
        completions: rows('completions'),
        cards: [...cards.values()],
        notes: rows('notes'),
      },
    },
  };
}

/** Baut die Datei aus dem Stand (ohne Auto-IDs der Tabellen; beim Import werden sie neu vergeben). */
export function makeBackup(data: BackupData, dbVersion: number, now: Date): Backup {
  const strip = <T extends object>(rows: readonly T[]): T[] =>
    rows.map((r) => {
      const copy = { ...r } as T & { id?: unknown };
      delete copy.id;
      return copy;
    });
  return {
    format: BACKUP_FORMAT,
    version: BACKUP_VERSION,
    exportedAt: now.toISOString(),
    app: { dbVersion },
    data: {
      settings: { ...data.settings },
      attempts: strip(data.attempts),
      completions: strip(data.completions),
      cards: data.cards.map((c) => ({ ...c })),
      notes: strip(data.notes),
    },
  };
}

/** yol-backup-2026-10-28.json */
export const backupFileName = (today: string): string => `yol-backup-${today}.json`;
