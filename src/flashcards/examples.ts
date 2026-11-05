import { annotatePassage, readingResolver } from '../content/reading';
import { LEVELS, vocabId, type Lesson, type PassageToken, type Unit } from '../content/schema';
import { exactKey } from '../lookup/key';
import type { PreparedLookup } from '../lookup/search';
import { SOURCE_TYPES } from './build';

// Beispielsätze und antippbare Wörter für Karteikarten (Build): nur vorhandene Sätze mit
// Übersetzung, kein neuer Text. Die Auflösung der Wörter folgt den Lesetexten (`annotatePassage`).

/** Längster Beispielsatz in Wörtern. */
export const MAX_EXAMPLE_WORDS = 10;
/** Ideale Länge; Abweichung um eins kostet nichts. */
const IDEAL_WORDS = 5;
/** Bis zu so vielen Units nach der Unit des Wortes gilt ein Satz als „nah“. */
const NEAR_UNITS = 3;
/** So viele Wörter ohne Auflösung darf ein Beispielsatz haben (nicht antippbar). */
const MAX_UNKNOWN = 1;
/** Ein Beispielsatz liegt höchstens so viele Niveaus über dem Wort (A1-Wort: Satz bis A2). */
const MAX_LEVEL_UP = 1;

/** Satz mit Übersetzung und aufgelösten Wörtern. */
export interface Example {
  tr: string;
  de: string;
  /** Übungs-ID oder `<lessonId>-p<n>` (n-ter Satz des Lesetextes, ab 1). */
  from: string;
  tokens: PassageToken[];
}

interface Candidate extends Example {
  unitAt: number;
  /** Index des Niveaus (A1 = 0). */
  level: number;
  /** Lesetext-Sätze hängen oft am Kontext (o, onu, sonra); Übungssätze stehen für sich. */
  passage: boolean;
  words: number;
  /** Vokabel-IDs im Satz. */
  vocab: Set<string>;
  /** Wörter ohne Auflösung (Fragepartikel, gebeugte Mehrwort-Verben); höchstens `MAX_UNKNOWN`. */
  unknown: number;
}

const SENTENCE_END = /[.?!…]["“”»)]*$/u;

/** Sätze mit Übersetzung aus einer Lektion (Türkisch, Deutsch, Quelle). */
function lessonSentences(
  lesson: Lesson,
): { tr: string; de: string; from: string; passage: boolean }[] {
  const out = (lesson.passage?.sentences ?? []).map((s, i) => ({
    tr: s.tr,
    de: s.de,
    from: `${lesson.id}-p${i + 1}`,
    passage: true,
  }));
  for (const ex of lesson.exercises) {
    if (ex.type === 'word_bank' || (ex.type === 'free_text' && ex.direction === 'de_tr'))
      out.push({ tr: ex.answers[0]!, de: ex.prompt, from: ex.id, passage: false });
    else if (ex.type === 'free_text')
      out.push({ tr: ex.prompt, de: ex.answers[0]!, from: ex.id, passage: false });
  }
  return out;
}

/**
 * Alle möglichen Beispielsätze im Kurs, in Kursreihenfolge: ganze Sätze (Satzzeichen am Ende)
 * mit höchstens `MAX_EXAMPLE_WORDS` Wörtern und `MAX_UNKNOWN` unaufgelösten; gleicher Satz nur einmal.
 */
export function examplePool(units: readonly Unit[], prepared: PreparedLookup): Candidate[] {
  const seen = new Set<string>();
  const out: Candidate[] = [];
  units.forEach((unit, unitAt) => {
    for (const lesson of unit.lessons) {
      if (!SOURCE_TYPES.has(lesson.type)) continue;
      const resolver = readingResolver(prepared, unit.id, lesson.passage?.glossary);
      for (const s of lessonSentences(lesson)) {
        const tr = s.tr.trim();
        const key = exactKey(tr);
        if (!SENTENCE_END.test(tr) || !s.de.trim() || seen.has(key)) continue;
        const { passage, unknown } = annotatePassage({ sentences: [{ tr, de: s.de }] }, resolver);
        const tokens = passage.tokens![0]!;
        const words = tokens.filter((t) => t.w).length;
        if (unknown.length > MAX_UNKNOWN || words < 2 || words > MAX_EXAMPLE_WORDS) continue;
        seen.add(key);
        const vocab = new Set(tokens.flatMap((t) => (t.vocab ? [t.vocab] : [])));
        const level = LEVELS.indexOf(unit.level);
        out.push({
          ...s,
          tr,
          de: s.de.trim(),
          tokens,
          unitAt,
          level,
          words,
          vocab,
          unknown: unknown.length,
        });
      }
    }
  });
  return out;
}

/** Rang eines Satzes für ein Wort aus Unit `at` (kleiner = besser), Gleichstand: Kursreihenfolge. */
function rank(c: Candidate, at: number): number[] {
  const distance = c.unitAt - at;
  const tier = distance === 0 ? 0 : distance <= NEAR_UNITS ? 1 : 2;
  return [
    tier,
    // Weit weg zählt zuerst die Nähe: lieber ein langer Satz aus A1 als ein kurzer aus A2.
    tier === 2 ? distance : 0,
    c.unknown,
    c.passage ? 1 : 0,
    Math.max(0, Math.abs(c.words - IDEAL_WORDS) - 1),
    distance,
  ];
}

const before = (a: number[], b: number[]) => {
  for (let i = 0; i < a.length; i++) if (a[i] !== b[i]) return a[i]! < b[i]!;
  return false;
};

export interface ExampleResult {
  /** Je Unit: Vokabel-ID → Beispielsatz. */
  examples: Map<string, Map<string, Example>>;
  errors: string[];
}

/**
 * Ein Beispielsatz je Vokabel: der Satz, der das Wort (genau oder gebeugt) enthält, aus derselben
 * oder einer späteren Unit (höchstens `MAX_LEVEL_UP` Niveaus darüber), mehr als nur das Wort.
 * Vorrang: eigene Unit, dann die nächsten `NEAR_UNITS`, dann die nächstgelegene; innerhalb davon
 * alle Wörter aufgelöst, Übungssatz vor Lesetext-Satz, Länge nahe `IDEAL_WORDS`, früher im Kurs.
 * Vokabel-Feld `example`: Quell-ID erzwingt den Satz (muss das Wort enthalten), `false` = keiner.
 */
export function vocabExamples(units: readonly Unit[], prepared: PreparedLookup): ExampleResult {
  const pool = examplePool(units, prepared);
  const byFrom = new Map(pool.map((c) => [c.from, c]));
  const examples = new Map<string, Map<string, Example>>();
  const errors: string[] = [];
  units.forEach((unit, at) => {
    const level = LEVELS.indexOf(unit.level);
    const found = new Map<string, Example>();
    for (const v of unit.vocab ?? []) {
      const id = vocabId(v);
      if (v.example === false) continue;
      let best: Candidate | undefined;
      if (v.example) {
        best = byFrom.get(v.example);
        if (!best || !best.vocab.has(id)) {
          errors.push(
            `${unit.id}: Vokabel ${id}: example ${v.example} ist kein Beispielsatz mit diesem Wort`,
          );
          continue;
        }
      } else {
        // Jeder Satz im Pool hat mindestens zwei Wörter (Mehrwort-Vokabeln zählen als eines),
        // enthält er das Wort, steht also noch etwas daneben.
        let bestRank: number[] | undefined;
        for (const c of pool) {
          if (c.unitAt < at || c.level > level + MAX_LEVEL_UP || !c.vocab.has(id)) continue;
          const r = rank(c, at);
          if (!bestRank || before(r, bestRank)) [best, bestRank] = [c, r];
        }
      }
      if (best) found.set(id, { tr: best.tr, de: best.de, from: best.from, tokens: best.tokens });
    }
    examples.set(unit.id, found);
  });
  return { examples, errors };
}

/** Antippbare Wörter je Satzkarte (Übungs-ID → Wörter der ersten Antwort). */
export function phraseTokens(
  unit: Unit,
  ids: Iterable<string>,
  prepared: PreparedLookup,
): Map<string, PassageToken[]> {
  const wanted = new Set(ids);
  const out = new Map<string, PassageToken[]>();
  const resolver = readingResolver(prepared, unit.id);
  for (const lesson of unit.lessons)
    for (const ex of lesson.exercises) {
      if (!wanted.has(ex.id) || (ex.type !== 'word_bank' && ex.type !== 'free_text')) continue;
      const tr = ex.answers[0]!;
      const { passage } = annotatePassage({ sentences: [{ tr, de: ex.prompt }] }, resolver);
      out.set(ex.id, passage.tokens![0]!);
    }
  return out;
}
