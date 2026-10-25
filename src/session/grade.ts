import type { Exercise } from '../content/schema';
import { checkAnswer, type AnswerResult } from '../lib/answer';

export const SUPPORTED_TYPES = ['multiple_choice', 'word_bank', 'free_text'] as const;
type Supported = Extract<Exercise, { type: (typeof SUPPORTED_TYPES)[number] }>;

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
  }
}

/** Kanonische Lösung zur Anzeige im Feedback. */
export function solutionOf(ex: Supported): string {
  return ex.type === 'multiple_choice' ? ex.answer : ex.answers[0]!;
}

/** Bausteine der Wortbank: Wörter der kanonischen Lösung plus Ablenker, stabil gemischt. */
export function wordBankTokens(ex: Extract<Exercise, { type: 'word_bank' }>): string[] {
  const words = ex.answers[0]!.split(/\s+/).map((w) => w.replace(/^[„"«]+|[.,!?;:"“»]+$/g, ''));
  return seededShuffle([...words, ...(ex.distractors ?? [])], ex.id);
}

function seededShuffle<T>(items: T[], seed: string): T[] {
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
