import { trLower } from '../lib/turkish';
import { inherited, insertLesson, localId, sample } from './generated';
import type { Exercise, Lesson, Unit } from './schema';

// Lektion „Satzbau“ je Unit, im Build aus Wortbank-Sätzen mit Satzglied-Annotation (`chunks`)
// erzeugt: derselbe türkische Satz, nur in Satzglieder geteilt. Auswahl je Satz per Hash.

type WordBank = Extract<Exercise, { type: 'word_bank' }>;
type SovPuzzle = Extract<Exercise, { type: 'sov_puzzle' }>;

export const ORDER_SENTENCES = 8;

export const wordOrderLessonId = (unitId: string): string => `${unitId}-s1`;

/** Wörter eines Satzes ohne Satzzeichen am Rand (Ziffern und Apostroph bleiben: 1990'da). */
const tokens = (text: string): string[] =>
  text
    .split(/\s+/)
    .map((w) => w.replace(/^[„"«(]+|[.,!?;:"“»)…]+$/g, ''))
    .filter(Boolean);

/** Was der Kurs über Groß- und Kleinschreibung weiß, für das erste Wort eines Satzbau-Satzes. */
export interface CaseHints {
  /** Namen: im Wortschatz als Eigenname/Nationalität oder mitten im Satz groß (Ali, Ahmet). */
  names: Set<string>;
  /** Wörter, die irgendwo kleingeschrieben stehen. */
  lower: Set<string>;
  /** Kleingeschriebene Vokabeln ab drei Buchstaben: babam, bileti, yolcular gehören dazu. */
  stems: string[];
}

export function caseHints(units: readonly Unit[]): CaseHints {
  const hints: CaseHints = { names: new Set(), lower: new Set(), stems: [] };
  const add = (text: string) => {
    for (const sentence of text.split(/(?<=[.!?…])\s+/)) {
      tokens(sentence).forEach((w, i) => {
        if (w === trLower(w)) hints.lower.add(w);
        else if (i > 0) hints.names.add(w.split(/['’]/)[0]!);
      });
    }
  };
  for (const unit of units) {
    for (const v of unit.vocab ?? []) {
      if (v.proper || v.capitalized) hints.names.add(v.tr);
      else if (v.tr.length >= 3 && !v.tr.includes(' ')) hints.stems.push(trLower(v.tr));
      add(v.tr);
    }
    for (const ex of unit.lessons.flatMap((l) => l.exercises)) {
      if (ex.type === 'word_bank') ex.answers.forEach(add);
      if (ex.type === 'free_text' && ex.direction === 'de_tr') ex.answers.forEach(add);
    }
  }
  return hints;
}

/**
 * Satzglied am Satzanfang: erstes Wort klein, sonst verrät die Großschreibung die Lösung.
 * Groß bleiben Namen und Formen mit Apostroph (İstanbul'daki, 1990'da) sowie Wörter, die der
 * Kurs weder kleingeschrieben noch als Form einer Vokabel kennt (dann vermutlich ein Name).
 */
export function display(text: string, hints: CaseHints): string {
  const first = text.split(' ')[0]!;
  if (/['’]/.test(first) || hints.names.has(first)) return text;
  const key = trLower(first);
  const known = hints.lower.has(key) || hints.stems.some((s) => key.startsWith(s));
  return known ? key + text.slice(first.length) : text;
}

/** Satzbau-Übung aus einem annotierten Wortbank-Satz. */
export function orderExercise(
  lessonId: string,
  unitId: string,
  src: WordBank & { chunks: NonNullable<WordBank['chunks']> },
  hints: CaseHints,
): SovPuzzle {
  return {
    id: `${lessonId}-${localId(unitId, src.id)}`,
    type: 'sov_puzzle',
    prompt: src.prompt,
    text: src.answers[0]!,
    chunks: src.chunks.map((c, i) => (i === 0 ? { ...c, text: display(c.text, hints) } : c)),
    ...(src.orders && { orders: src.orders }),
    from: src.id,
    ...inherited(src),
  };
}

/** Lektion „Satzbau“: bis zu ORDER_SENTENCES annotierte Sätze der Unit. */
export function wordOrderLesson(unit: Unit, title: string, hints: CaseHints): Lesson | undefined {
  const id = wordOrderLessonId(unit.id);
  const annotated = unit.lessons
    .flatMap((l) => l.exercises)
    .filter(
      (e): e is WordBank & { chunks: NonNullable<WordBank['chunks']> } =>
        e.type === 'word_bank' && !!e.chunks,
    );
  const exercises = sample(annotated, (e) => e.id, ORDER_SENTENCES).map((e) =>
    orderExercise(id, unit.id, e, hints),
  );
  return exercises.length ? { id, type: 'word_order', title, exercises } : undefined;
}

/** Fügt die Satzbau-Lektion vor der Wiederholung ein; eine handgeschriebene `-s1` bleibt. */
export function withWordOrder(unit: Unit, title: string, hints: CaseHints): Unit {
  return insertLesson(unit, wordOrderLesson(unit, title, hints));
}
