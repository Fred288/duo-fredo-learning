import { z } from 'zod';
import { solveExercise } from '../content/lexicon';
import { LEVELS, type Exercise, type Level, type Unit, type Vocab } from '../content/schema';
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
/**
 * Bauaufgaben mit nur einer Endung: Stamm plus zwei Kacheln, und die Formel nennt die Endung –
 * zur Hälfte geraten. Sie stehen hinter der Wortbank.
 */
const SINGLE_SUFFIX_RANK = 1.5;

/** Lektionen, aus denen Aufgaben kommen dürfen, in Vorrangreihenfolge. */
const LESSON_RANK: Record<string, number> = { grammar: 0, dialog: 1, vocab: 2 };

interface Candidate {
  ex: Exercise;
  lessonId: string;
  topic: string;
  /** Vorrang der Lektionsart (`LESSON_RANK`). */
  rank: number;
}

/** Endungen der Lösung ohne Stamm (Engine); nur für Bauaufgaben. */
function suffixCount(ex: Exercise, vocab: readonly Vocab[]): number {
  if (ex.type !== 'suffix_builder' && ex.type !== 'conjugation') return 0;
  try {
    return solveExercise(ex, vocab).segments.filter((s) => s.text && s.tag !== 'STEM').length;
  } catch {
    return 0; // Der Build prüft die Lösung ohnehin (checkSuffixTargets).
  }
}

function typeRank(ex: Exercise, vocab: readonly Vocab[]): number {
  const rank = TYPE_RANK[ex.type]!;
  return rank === 0 && suffixCount(ex, vocab) < 2 ? SINGLE_SUFFIX_RANK : rank;
}

/** Multiple Choice in Wortschatz und Dialog fragt nur Wörter ab, kaum den Stand der Unit. */
const typeAllowed = (ex: Exercise, lessonType: string) =>
  TYPE_RANK[ex.type] !== undefined && (ex.type !== 'multiple_choice' || lessonType === 'grammar');

/**
 * Erlaubte Aufgaben der Unit, sortiert nach Lektionsart, Typ und Hash. Vorschau-Lektionen auf
 * spätere Units (a1-u12 „Ausblick: -dı“) haben heute nur Multiple Choice und liegen daher
 * hinten; käme dort eine Bauaufgabe dazu, gehört die Unit in die Overrides.
 */
function candidates(unit: Unit, vocab: readonly Vocab[]): Candidate[] {
  const list: (Candidate & { typeRank: number })[] = [];
  for (const l of unit.lessons) {
    const rank = LESSON_RANK[l.type];
    if (rank === undefined || l.passage) continue;
    for (const ex of l.exercises)
      if (typeAllowed(ex, l.type))
        list.push({ ex, lessonId: l.id, topic: l.title, rank, typeRank: typeRank(ex, vocab) });
  }
  return list.sort(
    (a, b) =>
      a.rank - b.rank ||
      a.typeRank - b.typeRank ||
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

/** Feste Aufgaben aus `placement.yaml`; dieselben Regeln wie die Auswahl (Typ, Lektionsart). */
function fixedPair(unit: Unit, ids: readonly string[], errors: string[]): Candidate[] {
  if (ids[0] === ids[1]) errors.push(`placement.yaml: ${unit.id}: zweimal ${ids[0]}`);
  const pair: Candidate[] = [];
  for (const id of ids) {
    const lesson = unit.lessons.find((l) => l.exercises.some((e) => e.id === id));
    const ex = lesson?.exercises.find((e) => e.id === id);
    const rank = lesson && LESSON_RANK[lesson.type];
    if (!lesson || !ex) errors.push(`placement.yaml: ${unit.id}: Übung ${id} gibt es nicht`);
    else if (rank === undefined || lesson.passage || !typeAllowed(ex, lesson.type))
      errors.push(
        `placement.yaml: ${unit.id}: ${id} (${ex.type} in ${lesson.type}) ist nicht erlaubt`,
      );
    else pair.push({ ex, lessonId: lesson.id, topic: lesson.title, rank });
  }
  return pair;
}

/**
 * Plan des Einstufungstests: Niveaus in der Reihenfolge von `LEVELS`, darin die Units in der
 * Reihenfolge der Eingabe (= Manifest), je Unit Probe und Bestätigung. `vocab` ist der
 * Wortschatz des Kurses (Engine-Lösung der Bauaufgaben). `errors` nennt Units ohne zwei
 * Aufgaben und ungültige Overrides (Build-Fehler).
 */
export function selectPlacement(
  units: readonly Unit[],
  { overrides = {} }: PlacementOverrides = {},
  vocab: readonly Vocab[] = units.flatMap((u) => u.vocab ?? []),
): { plan: PlacementPlan; errors: string[] } {
  const errors: string[] = [];
  const known = new Set(units.map((u) => u.id));
  for (const id of Object.keys(overrides)) {
    if (!known.has(id)) errors.push(`placement.yaml: Unit ${id} gibt es nicht`);
  }
  const levels: PlacementLevel[] = LEVELS.map((level) => ({ level, units: [] }));
  for (const unit of units) {
    const fixed = overrides[unit.id];
    const pair = fixed ? fixedPair(unit, fixed, errors) : pickPair(candidates(unit, vocab));
    if (!fixed && pair.length < 2)
      errors.push(`${unit.id}: weniger als zwei Aufgaben für die Einstufung`);
    levels[LEVELS.indexOf(unit.level)]!.units.push({
      unitId: unit.id,
      title: unit.title,
      items: pair.map(item),
    });
  }
  return { plan: { levels: levels.filter((l) => l.units.length > 0) }, errors };
}
