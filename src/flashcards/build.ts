import { annotatePassage, readingResolver } from '../content/reading';
import { vocabId, type Exercise, type Lesson, type Unit } from '../content/schema';
import { exactKey } from '../lookup/key';
import type { PreparedLookup } from '../lookup/search';

// Karteikarten (Build): Vokabeln hängen in der YAML an der Unit, Karteikarten an der Lektion.
// Hier entsteht beides aus vorhandenen Inhalten, ohne neuen türkischen Text.

/** Lektionsarten, deren Übungen ein Wort einführen; erzeugte und Wiederholung zählen nicht. */
const SOURCE_TYPES: ReadonlySet<Lesson['type']> = new Set([
  'vocab',
  'grammar',
  'dialog',
  'reading',
]);
/** Lektionsarten, aus denen Satzkarten kommen (Alltagssätze statt Drillsätze). */
const PHRASE_TYPES: ReadonlySet<Lesson['type']> = new Set(['vocab', 'dialog']);
/** Längste Satzkarte in Wörtern. */
export const MAX_PHRASE_WORDS = 7;

/** Türkische Texte einer Übung, in denen ein Wort vorkommen kann. */
function turkishTexts(ex: Exercise): string[] {
  switch (ex.type) {
    case 'multiple_choice':
      return [ex.speak_prompt ?? '', ex.speak_answer ? ex.answer : ''];
    case 'word_bank':
      return [ex.answers[0]!];
    case 'free_text':
      return [ex.direction === 'de_tr' ? ex.answers[0]! : ex.prompt];
    case 'suffix_builder':
      return [ex.stem, ex.target];
    case 'conjugation':
    case 'paradigm':
      return [ex.lemma];
    default:
      return [];
  }
}

function lessonTexts(lesson: Lesson): string[] {
  return [
    ...(lesson.passage?.sentences.map((s) => s.tr) ?? []),
    ...lesson.exercises.flatMap(turkishTexts),
  ].filter(Boolean);
}

/**
 * Vokabel-IDs je Lektion: Ein Wort gehört zur ersten Lektion, in der es vorkommt (genau, gebeugt
 * über die Engine oder als Mehrwort-Vokabel), sonst zur ersten Vokabel-Lektion der Unit. Das Feld
 * `lesson` an der Vokabel geht vor. Jede Vokabel steht in genau einer Lektion.
 */
export function lessonVocab(unit: Unit, prepared: PreparedLookup): Map<string, string[]> {
  const own = new Map((unit.vocab ?? []).map((v) => [vocabId(v), v]));
  const found = new Map<string, string>();
  const take = (id: string | undefined, lessonId: string) => {
    if (id && own.has(id) && !found.has(id)) found.set(id, lessonId);
  };
  // Lange Wendungen (mehr Wörter, als `annotatePassage` zusammenzieht) über den Text selbst.
  const phrases = [...own]
    .filter(([, v]) => v.tr.includes(' '))
    .map(([id, v]) => [id, exactKey(v.tr)] as const);

  for (const lesson of unit.lessons) {
    if (!SOURCE_TYPES.has(lesson.type)) continue;
    const texts = lessonTexts(lesson);
    const resolver = readingResolver(prepared, unit.id, lesson.passage?.glossary);
    const { passage } = annotatePassage(
      { sentences: texts.map((tr) => ({ tr, de: '-' })) },
      resolver,
    );
    for (const token of passage.tokens!.flat()) take(token.vocab, lesson.id);
    const keys = texts.map((t) => ` ${exactKey(t)} `);
    for (const [id, key] of phrases) {
      if (keys.some((k) => k.includes(` ${key} `))) take(id, lesson.id);
    }
  }

  const fallback = (
    unit.lessons.find((l) => l.type === 'vocab') ??
    unit.lessons.find((l) => SOURCE_TYPES.has(l.type)) ??
    unit.lessons[0]!
  ).id;
  const out = new Map<string, string[]>();
  for (const [id, v] of own) {
    const lessonId = v.lesson ?? found.get(id) ?? fallback;
    out.set(lessonId, [...(out.get(lessonId) ?? []), id]);
  }
  return out;
}

/** Satz statt Wortglosse: Prompt oder Antwort endet mit Satzzeichen. */
const SENTENCE_END = /[.?!…]\s*\)?$/u;

/**
 * Satzkarten je Unit und Lektion (Übungs-IDs): Wortbank- und Freitext-Übungen (de→tr) aus
 * Vokabel- und Dialog-Lektionen mit höchstens `MAX_PHRASE_WORDS` Wörtern, die ein Satz sind und
 * keine Vokabel wiederholen. `card: false` nimmt eine Übung heraus, `card: true` hinein. Gleiche
 * Sätze nur einmal, das erste Vorkommen im Kurs gewinnt.
 */
export function phraseCards(units: readonly Unit[]): Map<string, Map<string, string[]>> {
  const words = new Set(units.flatMap((u) => (u.vocab ?? []).map((v) => exactKey(v.tr))));
  const seen = new Set<string>();
  const out = new Map<string, Map<string, string[]>>();
  for (const unit of units) {
    const lessons = new Map<string, string[]>();
    for (const lesson of unit.lessons) {
      for (const ex of lesson.exercises) {
        if (ex.type !== 'word_bank' && !(ex.type === 'free_text' && ex.direction === 'de_tr'))
          continue;
        if (ex.card === false) continue;
        const answer = ex.answers[0]!;
        const key = exactKey(answer);
        const fits =
          PHRASE_TYPES.has(lesson.type) &&
          key.split(' ').length <= MAX_PHRASE_WORDS &&
          !words.has(key) &&
          (SENTENCE_END.test(ex.prompt.trim()) || SENTENCE_END.test(answer.trim()));
        if (!(ex.card ?? fits) || seen.has(key)) continue;
        seen.add(key);
        lessons.set(lesson.id, [...(lessons.get(lesson.id) ?? []), ex.id]);
      }
    }
    out.set(unit.id, lessons);
  }
  return out;
}

/** `lesson` an Vokabeln muss eine Lektion der Unit sein; `card` nur bei de→tr. */
export function checkCardFields(unit: Unit): string[] {
  const lessons = new Set(unit.lessons.map((l) => l.id));
  return [
    ...(unit.vocab ?? [])
      .filter((v) => v.lesson && !lessons.has(v.lesson))
      .map((v) => `Vokabel ${vocabId(v)}: lesson ${v.lesson} gibt es in ${unit.id} nicht`),
    ...unit.lessons.flatMap((l) =>
      l.exercises
        .filter((e) => e.type === 'free_text' && e.direction === 'tr_de' && e.card !== undefined)
        .map((e) => `${e.id}: card nur bei direction de_tr`),
    ),
  ];
}
