import { allForms } from '../lookup/forms';
import type { VocabEntry } from '../lookup/types';
import { trLower } from '../lib/turkish';
import {
  conjugate,
  inflect,
  MorphError,
  predicate,
  type Inflection,
  type MorphTag,
  type Person,
} from '../morphology';
import { inherited, insertLesson, localId, sample } from './generated';
import { formSpecOf, paradigmRows, solveForm, stemFromVocab } from './lexicon';
import type { Exercise, FormSpec, Lesson, SegmentTag, Unit, Vocab } from './schema';

// Lektion „Wörter zerlegen“ je Unit, im Build aus den Formen der Grammatikübungen erzeugt
// (Suffix-Builder, Konjugation, Tabellenzeilen): Zerlegung und Begründung liefert die Engine,
// es entsteht kein neuer türkischer Text. Auswahl je Form per Hash wie bei den Hörlektionen.

type Segment = Extract<Exercise, { type: 'segment' }>;
type Source = Extract<Exercise, { type: 'suffix_builder' | 'conjugation' | 'paradigm' }>;

export const SEGMENT_WORDS = 8;
const PER_SOURCE = 2;

export const segmentLessonId = (unitId: string): string => `${unitId}-z1`;

const PERSON_TAG: Record<Person, SegmentTag> = {
  '1sg': 'P1SG',
  '2sg': 'P2SG',
  '3sg': 'P3SG',
  '1pl': 'P1PL',
  '2pl': 'P2PL',
  '3pl': 'P3PL',
};

/**
 * Bausteine einer Engine-Form; leere (3. Person Singular) fallen weg. Die Engine führt die
 * Personalendung an der Fragepartikel im selben Baustein (musun, miyim); hier wird sie als
 * eigenes Stück abgetrennt (mu-sun), damit jede Endung ihre Rolle bekommt.
 */
export function pieces(inf: Inflection, person?: Person): { text: string; tag: SegmentTag }[] {
  return inf.segments.flatMap((s): { text: string; tag: SegmentTag }[] => {
    if (!s.text) return [];
    if (s.tag === 'Q' && person && s.text.length > 2) {
      return [
        { text: s.text.slice(0, 2), tag: 'Q' },
        { text: s.text.slice(2), tag: PERSON_TAG[person] },
      ];
    }
    return [{ text: s.text, tag: s.tag }];
  });
}

const personOf = (spec: FormSpec): Person | undefined =>
  spec.kind === 'noun' ? undefined : spec.person;

const suffixTags = (inf: Inflection, person?: Person): string =>
  pieces(inf, person)
    .slice(1)
    .map((p) => p.tag)
    .join(' ');

/** Vokabel als Eintrag für `allForms`; Wörter außerhalb des Wortschatzes gelten als Nomen. */
function entryOf(spec: FormSpec, vocab: readonly Vocab[]): VocabEntry {
  const v = vocab.find((x) => x.tr === spec.lemma);
  const stem = stemFromVocab(spec.lemma, vocab);
  return {
    id: spec.lemma,
    unit: '',
    tr: spec.lemma,
    de: v?.de ?? ['-'],
    pos: spec.kind === 'verb' ? 'verb' : v?.pos === 'adj' || v?.pos === 'num' ? v.pos : 'noun',
    softens: stem.softens,
    harmony_vowel: stem.harmonyVowel,
    drops_vowel: stem.dropsVowel,
    proper: stem.proper,
    capitalized: stem.capitalized,
    y_stem: stem.yStem,
    aorist: stem.aorist,
  };
}

const DERIVATIONS: MorphTag[] = ['LI', 'SIZ', 'LIK', 'CI'];

/** Engine-Form oder undefined, wo die Engine die Kombination ablehnt. */
function attempt(fn: () => Inflection): string | undefined {
  try {
    return trLower(fn().form);
  } catch (e) {
    if (e instanceof MorphError) return undefined;
    throw e;
  }
}

/**
 * Ist der Stamm selbst eine Ableitung eines Kurs-Nomens (evli = ev-li, işsiz = iş-siz)? Dann ist
 * die feinere Zerlegung ebenso richtig, gerade in der Unit, die die Ableitungen lehrt.
 */
function derivedStem(lemma: string, vocab: readonly Vocab[]): boolean {
  const word = trLower(lemma);
  return vocab.some(
    (v) =>
      v.pos !== 'verb' &&
      v.tr !== lemma &&
      word.startsWith(trLower(v.tr)) &&
      DERIVATIONS.some((tag) => attempt(() => inflect(stemFromVocab(v.tr, vocab), [tag])) === word),
  );
}

// Kopula-Personen, die als Lesart einer Nomenform in Frage kommen (kızım: meine Tochter / ich bin
// ein Mädchen). Die 3. Person Plural fehlt wie in den Kopula-Tabellen des Kurses (-lar optional).
const COPULA_PERSONS: Person[] = ['1sg', '2sg', '1pl', '2pl'];

/**
 * Lässt sich dieselbe Form desselben Stamms anders zerlegen oder benennen? evleri ist PL+ACC,
 * PL+POSS_3SG oder POSS_3PL; evim ist „mein Haus“ oder „ich bin ein Haus“. Solche Formen
 * fallen weg, denn ohne Satz ist keine Zerlegung die einzig richtige. Verglichen wird mit allen
 * Formen des Nachschlagewerks (Nomen: Plural × Possessiv × Kasus, Verben: alle Zeiten), bei
 * Nomen ohne deutsche Bedeutung (`glossed`) auch mit der Kopula. Ableitungen kennt das
 * Formenraster nicht; ein Stamm, der selbst abgeleitet ist (evli), gilt daher als mehrdeutig.
 */
export function isAmbiguous(
  spec: FormSpec,
  inf: Inflection,
  vocab: readonly Vocab[],
  { glossed = false } = {},
): boolean {
  const form = trLower(inf.form);
  if (spec.kind !== 'verb' && derivedStem(spec.lemma, vocab)) return true;
  if (spec.kind === 'noun' && !glossed) {
    const stem = stemFromVocab(spec.lemma, vocab);
    if (COPULA_PERSONS.some((person) => attempt(() => predicate(stem, { person })) === form)) {
      return true;
    }
  }
  const own = suffixTags(inf, personOf(spec));
  const entry = entryOf(spec, vocab);
  for (const other of allForms(entry)) {
    if (trLower(other.form) !== form) continue;
    const label = other.label;
    const verb = { form: entry.tr, softens: entry.softens, aorist: entry.aorist };
    const tags =
      label.kind === 'noun'
        ? label.tags.join(' ')
        : label.kind === 'verb'
          ? suffixTags(conjugate(verb, label), label.person)
          : 'PRONOUN';
    if (tags !== own) return true;
  }
  return false;
}

/** Zerlege-Übung zu einer Form; undefined, wenn die Engine sie nicht bildet. */
export function segmentExercise(
  lessonId: string,
  unitId: string,
  src: Source,
  row: number | undefined,
  vocab: readonly Vocab[],
): { exercise: Segment; inflection: Inflection } | undefined {
  const analysis = formSpecOf(src, row);
  let inflection: Inflection;
  try {
    inflection = solveForm(analysis, vocab);
  } catch (e) {
    if (e instanceof MorphError) return undefined;
    throw e;
  }
  const segments = pieces(inflection, personOf(analysis));
  // Ein Stamm ohne Vokal (ye- → y-iyor) taugt nicht zum Zerlegen, ein Stamm aus mehreren
  // Wörtern (seyahat et-) auch nicht: Leerzeichen sind feste Grenzen zwischen Stücken.
  if (segments.length < 2 || !/[aeıioöuü]/i.test(trLower(segments[0]!.text))) return undefined;
  if (segments.some((s) => /\s/.test(s.text))) return undefined;
  const suffix = row === undefined ? '' : `-r${row + 1}`;
  return {
    exercise: {
      id: `${lessonId}-${localId(unitId, src.id)}${suffix}`,
      type: 'segment',
      word: inflection.form,
      segments,
      analysis,
      from: src.id,
      // Die deutsche Bedeutung passt nur zur einzelnen Form, nicht zur ganzen Tabelle.
      ...(row === undefined && src.gloss_de && { gloss_de: src.gloss_de }),
      ...inherited(src),
    },
    inflection,
  };
}

/** Alle Formen der Grammatikübungen einer Unit, je Oberflächenform einmal, ohne mehrdeutige. */
export function segmentCandidates(
  unit: Unit,
  vocab: readonly Vocab[],
  lessonId = segmentLessonId(unit.id),
): Segment[] {
  const out: Segment[] = [];
  const seen = new Set<string>();
  for (const src of unit.lessons.flatMap((l) => l.exercises)) {
    if (src.type !== 'suffix_builder' && src.type !== 'conjugation' && src.type !== 'paradigm')
      continue;
    const rows = src.type === 'paradigm' ? paradigmRows(src).map((_, i) => i) : [undefined];
    for (const row of rows) {
      const made = segmentExercise(lessonId, unit.id, src, row, vocab);
      if (!made) continue;
      const key = trLower(made.exercise.word);
      if (seen.has(key)) continue;
      seen.add(key);
      const glossed = !!made.exercise.gloss_de;
      if (!isAmbiguous(made.exercise.analysis, made.inflection, vocab, { glossed })) {
        out.push(made.exercise);
      }
    }
  }
  return out;
}

/**
 * Lektion „Wörter zerlegen“: bevorzugt Formen mit mindestens zwei Endungen, aufgefüllt mit
 * einfacheren, wenn die Unit nicht genug hat. `vocab` = Wortschatz aller Units (Flags der Stämme).
 */
export function segmentLesson(
  unit: Unit,
  title: string,
  vocab: readonly Vocab[],
): Lesson | undefined {
  const id = segmentLessonId(unit.id);
  // Höchstens zwei Formen je Quelle, sonst füllt eine Tabelle die Lektion mit einem Wort.
  const candidates = segmentCandidates(unit, vocab, id);
  const bySource = Map.groupBy(candidates, (e) => e.from);
  const kept = new Set(
    [...bySource.values()].flatMap((group) => sample(group, (e) => e.id, PER_SOURCE)),
  );
  const all = candidates.filter((e) => kept.has(e));
  const rich = all.filter((e) => e.segments.length >= 3);
  const chosen = sample(rich, (e) => e.id, SEGMENT_WORDS);
  if (chosen.length < SEGMENT_WORDS) {
    const simple = all.filter((e) => e.segments.length < 3);
    chosen.push(...sample(simple, (e) => e.id, SEGMENT_WORDS - chosen.length));
  }
  const order = new Map(all.map((e, i) => [e.id, i]));
  const exercises = chosen.sort((a, b) => order.get(a.id)! - order.get(b.id)!);
  return exercises.length ? { id, type: 'segmenting', title, exercises } : undefined;
}

/** Fügt die Zerlege-Lektion vor der Wiederholung ein; eine handgeschriebene `-z1` bleibt. */
export function withSegments(unit: Unit, title: string, vocab: readonly Vocab[]): Unit {
  return insertLesson(unit, segmentLesson(unit, title, vocab));
}
