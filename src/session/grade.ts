import type { Exercise } from '../content/schema';
import { sameForm } from '../content/lexicon';
import { checkAnswer, type AnswerResult } from '../lib/answer';
import { trLower } from '../lib/turkish';

export const SUPPORTED_TYPES = [
  'multiple_choice',
  'word_bank',
  'free_text',
  'suffix_builder',
  'conjugation',
  'paradigm',
] as const;
export type Supported = Extract<Exercise, { type: (typeof SUPPORTED_TYPES)[number] }>;

export const isSupported = (ex: Exercise): ex is Supported =>
  (SUPPORTED_TYPES as readonly string[]).includes(ex.type);

export interface GradeOptions {
  tolerateDiacritics: boolean;
}

/** Bewertet eine Antwort. MC: gewählte Option, Wortbank: Bausteine mit Leerzeichen verbunden. */
export function grade(ex: Supported, answer: string, opts: GradeOptions): AnswerResult {
  switch (ex.type) {
    case 'multiple_choice':
      return answer === ex.answer
        ? { verdict: 'correct', matched: ex.answer, hints: [] }
        : { verdict: 'wrong', hints: [] };
    case 'word_bank':
      // Bausteine sind vorgegeben, Tippfehler sind also ausgeschlossen.
      return checkAnswer(answer, ex.answers, { allowTypos: false });
    case 'free_text':
      return checkAnswer(answer, ex.answers, { tolerateDiacritics: opts.tolerateDiacritics });
    case 'suffix_builder':
      // Genau die Form zählt: kein Tippfehler-Spielraum, sonst wäre evda ≈ evde.
      return checkAnswer(answer, [ex.target], { allowTypos: false });
    case 'conjugation':
      return sameForm(squash(ex.target), squash(answer))
        ? { verdict: 'correct', matched: ex.target, hints: [] }
        : { verdict: 'wrong', hints: [] };
    case 'paradigm':
      return paradigmCells(ex, answer).every(Boolean)
        ? { verdict: 'correct', matched: ex.targets.join(', '), hints: [] }
        : { verdict: 'wrong', hints: [] };
  }
}

// Fragepartikel und değil sind eigene Bausteine; Leerzeichen und Apostroph zählen nicht.
const squash = (s: string) => s.replace(/[\s'’?]/g, '');

/**
 * Tabelle: Zellen sind mit Zeilenumbruch verbunden; je Zelle richtig oder falsch.
 * Groß/Klein zählt hier nicht (Felder ohne Autokorrektur), ein deutsches I gilt als İ.
 */
export function paradigmCells(ex: Extract<Exercise, { type: 'paradigm' }>, answer: string) {
  const cells = answer.split('\n');
  return ex.targets.map((target, i) => {
    const given = squash(cells[i] ?? '');
    const dotted = target.includes('İ') ? given.replaceAll('I', 'İ') : given;
    return trLower(squash(target)) === trLower(dotted);
  });
}

/** Kanonische Lösung zur Anzeige im Feedback. */
export function solutionOf(ex: Supported): string {
  if (ex.type === 'multiple_choice') return ex.answer;
  if (ex.type === 'suffix_builder' || ex.type === 'conjugation') return ex.target;
  if (ex.type === 'paradigm') return ex.targets.join(', ');
  return ex.answers[0]!;
}

/**
 * Bausteine der Wortbank: Wörter aller hinterlegten Lösungen (damit jede Variante baubar ist,
 * z. B. mit und ohne Pronomen) plus Ablenker, stabil gemischt. Groß/Klein gilt als gleiches Wort.
 */
export function wordBankTokens(ex: Extract<Exercise, { type: 'word_bank' }>): string[] {
  // Je Wort (ohne Groß/Klein) die Schreibungen der Antwort mit den meisten Vorkommen:
  // „Bir varmış, bir yokmuş“ braucht Bir und bir.
  const needed = new Map<string, string[]>();
  for (const answer of ex.answers) {
    const spellings = new Map<string, string[]>();
    for (const raw of answer.split(/\s+/)) {
      const word = raw.replace(/^[„"«]+|[.,!?;:"“»]+$/g, '');
      if (!word) continue;
      spellings.set(trLower(word), [...(spellings.get(trLower(word)) ?? []), word]);
    }
    for (const [key, list] of spellings) {
      if (list.length > (needed.get(key)?.length ?? 0)) needed.set(key, list);
    }
  }
  const words = [...needed.values()].flat();
  const extra = (ex.distractors ?? []).filter((d) => !needed.has(trLower(d)));
  return seededShuffle([...words, ...extra], ex.id);
}

export function seededShuffle<T>(items: T[], seed: string): T[] {
  let h = 2166136261;
  for (const c of seed) h = Math.imul(h ^ c.charCodeAt(0), 16777619);
  const rand = () => {
    h = Math.imul(h ^ (h >>> 15), 2246822507);
    h = Math.imul(h ^ (h >>> 13), 3266489909);
    return ((h ^= h >>> 16) >>> 0) / 4294967296;
  };
  const out = [...items];
  for (let i = out.length - 1; i > 0; i--) {
    const j = Math.floor(rand() * (i + 1));
    [out[i], out[j]] = [out[j]!, out[i]!];
  }
  return out;
}
