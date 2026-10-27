import type { Exercise, Unit } from '../content/schema';
import { trLower } from '../lib/turkish';

// Multiple-Choice-Prompts mischen Deutsch und Türkisch („Was heißt „hala“?“). Welche Teile
// vorgelesen werden, entscheidet der Build über die Wörter, die der Kurs selbst als türkisch
// bzw. deutsch führt. Korrekturen stehen als speak_prompt/speak_answer in der YAML.

export interface CourseWords {
  tr: Set<string>;
  de: Set<string>;
}

/** Wörter eines Textes, klein (trLower auf beiden Seiten, damit der Vergleich stimmt). */
export const wordsOf = (text: string): string[] =>
  text
    .replaceAll('’', "'")
    .split(/[^\p{L}']+/u)
    .map((w) => trLower(w.replace(/^'+|'+$/g, '')))
    .filter(Boolean);

/** Türkische und deutsche Wörter aus den eindeutig zugeordneten Feldern aller Units. */
export function courseWords(units: readonly Unit[]): CourseWords {
  const tr: string[] = [];
  const de: string[] = [];
  for (const unit of units) {
    for (const v of [...(unit.vocab ?? []), ...(unit.lexicon ?? [])]) {
      tr.push(v.tr);
      de.push(...v.de);
    }
    for (const ex of unit.lessons.flatMap((l) => l.exercises)) {
      if (ex.gloss_de) de.push(ex.gloss_de);
      switch (ex.type) {
        case 'word_bank':
          tr.push(...ex.answers, ...(ex.distractors ?? []));
          de.push(ex.prompt);
          break;
        case 'free_text':
          (ex.direction === 'de_tr' ? tr : de).push(...ex.answers);
          (ex.direction === 'de_tr' ? de : tr).push(ex.prompt);
          break;
        case 'suffix_builder':
          tr.push(ex.stem, ex.target);
          break;
        case 'conjugation':
          tr.push(ex.lemma, ex.target);
          break;
        case 'paradigm':
          tr.push(ex.lemma, ...ex.targets);
          break;
        case 'listen':
          tr.push(ex.text);
          break;
      }
    }
  }
  return { tr: new Set(tr.flatMap(wordsOf)), de: new Set(de.flatMap(wordsOf)) };
}

// Buchstaben, die es im Deutschen nicht gibt bzw. im Türkischen nicht.
const TURKISH_ONLY = /[ığşİĞŞ]/;
const GERMAN_ONLY = /[äÄß]/;

const germanOnlyWord = (words: string[], c: CourseWords) =>
  words.some((w) => c.de.has(w) && !c.tr.has(w));

/** Ein Wort aus türkischen Buchstaben oder nur bekannte türkische Wörter, kein rein deutsches. */
export function isTurkish(text: string, c: CourseWords): boolean {
  const words = wordsOf(text);
  if (!words.length || GERMAN_ONLY.test(text) || germanOnlyWord(words, c)) return false;
  return TURKISH_ONLY.test(text) || words.every((w) => c.tr.has(w));
}

/**
 * Die Antwort wird vorgelesen, wenn sie türkisch ist und keine Option deutsch. Optionen selbst
 * nie: falsche Formen wie „güllar“ sollen nicht ins Ohr gehen.
 */
export function answerIsTurkish(
  ex: Extract<Exercise, { type: 'multiple_choice' }>,
  c: CourseWords,
): boolean {
  return (
    isTurkish(ex.answer, c) &&
    ex.options.every((o) => !GERMAN_ONLY.test(o) && !germanOnlyWord(wordsOf(o), c))
  );
}

/** Türkische „…“-Teile des Prompts, sonst der ganze Prompt, wenn er türkisch ist. */
export function turkishInPrompt(prompt: string, c: CourseWords): string | undefined {
  const quoted = [...prompt.matchAll(/[„"]([^“”"]+)[“”"]/g)].map((m) => m[1]!.trim());
  if (quoted.length) {
    const tr = quoted.filter((q) => isTurkish(q, c));
    return tr.length ? tr.join(', ') : undefined;
  }
  return isTurkish(prompt, c) ? prompt : undefined;
}

/** Ergänzt speak_prompt/speak_answer bei Multiple Choice, wo die YAML sie nicht setzt. */
export function annotateSpeech(unit: Unit, c: CourseWords): Unit {
  return {
    ...unit,
    lessons: unit.lessons.map((lesson) => ({
      ...lesson,
      exercises: lesson.exercises.map((ex) => {
        if (ex.type !== 'multiple_choice') return ex;
        const out = { ...ex };
        if (out.speak_prompt === undefined) {
          const prompt = turkishInPrompt(ex.prompt, c);
          if (prompt) out.speak_prompt = prompt;
        }
        if (out.speak_answer === undefined && answerIsTurkish(ex, c)) out.speak_answer = true;
        return out;
      }),
    })),
  };
}
