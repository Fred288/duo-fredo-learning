import { z } from 'zod';
import { LEVELS, type Exercise, type Level, type Unit } from '../content/schema';
import { fnv1a } from '../lib/hash';

// Einstufungstest: Auswahl der Aufgaben im Build (rein). Nur vorhandene Übungen über stabile
// IDs, kein neuer türkischer Text. Je Unit eine Probe- und eine Bestätigungsaufgabe.

export interface PlacementItem {
  id: string;
  lessonId: string;
  /** Lektionstitel der Quelle, Thema in der Begründung. */
  topic: string;
}

export interface PlacementUnit {
  unitId: string;
  title: string;
  /** [Probe, Bestätigung]. */
  items: PlacementItem[];
}

export interface PlacementLevel {
  level: Level;
  units: PlacementUnit[];
}

/** Inhalt von `public/content/placement.json`. */
export interface PlacementPlan {
  levels: PlacementLevel[];
}

/** Korrekturen beim Review (`content/placement.yaml`): feste Übungs-IDs je Unit. */
export const PlacementOverrides = z.strictObject({
  overrides: z.record(z.string(), z.tuple([z.string().min(1), z.string().min(1)])).optional(),
});
export type PlacementOverrides = z.infer<typeof PlacementOverrides>;

/**
 * Erlaubte Typen, beste zuerst: von der Engine geprüfte Formen, dann Sätze, dann Wörter.
 * Nicht dabei: Tabellen (zu lang), Hören (Stimme), erzeugte Zerlegen-/Satzbau-Übungen.
 */
const TYPE_RANK: Partial<Record<Exercise['type'], number>> = {
  suffix_builder: 0,
  conjugation: 0,
  word_bank: 1,
  free_text: 2,
  multiple_choice: 3,
};

/** Lektionen, aus denen Aufgaben kommen dürfen, in Vorrangreihenfolge. */
const LESSON_RANK: Record<string, number> = { grammar: 0, dialog: 1, vocab: 2 };

interface Candidate {
  ex: Exercise;
  lessonId: string;
  topic: string;
  /** Vorrang der Lektionsart (`LESSON_RANK`). */
  rank: number;
}

const typeAllowed = (ex: Exercise, lessonType: string) =>
  TYPE_RANK[ex.type] !== undefined &&
  // Multiple Choice in Wortschatz und Dialog fragt nur Wörter ab, kaum den Stand der Unit.
  (ex.type !== 'multiple_choice' || lessonType === 'grammar');

/** Erlaubte Aufgaben der Unit, sortiert nach Lektionsart, Typ und Hash. */
function candidates(unit: Unit): Candidate[] {
  const list: Candidate[] = [];
  for (const l of unit.lessons) {
    const rank = LESSON_RANK[l.type];
    if (rank === undefined || l.passage) continue;
    for (const ex of l.exercises)
      if (typeAllowed(ex, l.type)) list.push({ ex, lessonId: l.id, topic: l.title, rank });
  }
  return list.sort(
    (a, b) =>
      a.rank - b.rank ||
      TYPE_RANK[a.ex.type]! - TYPE_RANK[b.ex.type]! ||
      fnv1a(a.ex.id) - fnv1a(b.ex.id) ||
      a.ex.id.localeCompare(b.ex.id),
  );
}

/**
 * Bestätigung aus derselben Lektionsart wie die Probe: möglichst aus einer anderen Lektion,
 * sonst mit anderem Typ, sonst die nächste; erst ohne solche eine aus nachrangigen Lektionen.
 */
function pickPair(list: Candidate[]): Candidate[] {
  const [probe, ...rest] = list;
  if (!probe) return [];
  const same = rest.filter((c) => c.rank === probe.rank);
  const confirm =
    same.find((c) => c.lessonId !== probe.lessonId) ??
    same.find((c) => c.ex.type !== probe.ex.type) ??
    rest[0];
  return confirm ? [probe, confirm] : [probe];
}

const item = (c: Candidate): PlacementItem => ({
  id: c.ex.id,
  lessonId: c.lessonId,
  topic: c.topic,
});

/** Sucht eine Übung samt Lektion in der Unit, für Overrides. */
function findExercise(unit: Unit, id: string): Candidate | undefined {
  for (const l of unit.lessons)
    for (const ex of l.exercises)
      if (ex.id === id)
        return { ex, lessonId: l.id, topic: l.title, rank: LESSON_RANK[l.type] ?? -1 };
  return undefined;
}

const levelOrder = (u: Unit) => LEVELS.indexOf(u.level);

/**
 * Plan des Einstufungstests: Niveaus und Units in Kursreihenfolge, je Unit Probe und
 * Bestätigung. `errors` nennt Units ohne zwei Aufgaben und ungültige Overrides (Build-Fehler).
 */
export function selectPlacement(
  units: readonly Unit[],
  { overrides = {} }: PlacementOverrides = {},
): { plan: PlacementPlan; errors: string[] } {
  const errors: string[] = [];
  const known = new Set(units.map((u) => u.id));
  for (const id of Object.keys(overrides)) {
    if (!known.has(id)) errors.push(`placement.yaml: Unit ${id} gibt es nicht`);
  }
  const sorted = [...units].sort(
    (a, b) => levelOrder(a) - levelOrder(b) || a.id.localeCompare(b.id),
  );
  const levels: PlacementLevel[] = [];
  for (const unit of sorted) {
    let pair: Candidate[];
    const fixed = overrides[unit.id];
    if (fixed) {
      pair = [];
      if (fixed[0] === fixed[1]) errors.push(`placement.yaml: ${unit.id}: zweimal ${fixed[0]}`);
      for (const id of fixed) {
        const c = findExercise(unit, id);
        const lesson = c && unit.lessons.find((l) => l.id === c.lessonId);
        if (!c || !lesson) errors.push(`placement.yaml: ${unit.id}: Übung ${id} gibt es nicht`);
        else if (
          TYPE_RANK[c.ex.type] === undefined ||
          lesson.passage ||
          !(lesson.type in LESSON_RANK)
        )
          errors.push(`placement.yaml: ${unit.id}: ${id} (${c.ex.type}) ist nicht erlaubt`);
        else pair.push(c);
      }
    } else {
      pair = pickPair(candidates(unit));
      if (pair.length < 2) errors.push(`${unit.id}: weniger als zwei Aufgaben für die Einstufung`);
    }
    let level = levels.at(-1);
    if (level?.level !== unit.level) {
      level = { level: unit.level, units: [] };
      levels.push(level);
    }
    level.units.push({ unitId: unit.id, title: unit.title, items: pair.map(item) });
  }
  return { plan: { levels }, errors };
}
