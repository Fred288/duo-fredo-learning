import type { Exercise } from '../content/schema';
import { sameForm } from '../content/lexicon';
import { checkAnswer, type AnswerResult } from '../lib/answer';

export const SUPPORTED_TYPES = [
  'multiple_choice',
  'word_bank',
  'free_text',
  'suffix_builder',
  'conjugation',
] as const;
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
    case 'suffix_builder':
      // Genau die Form zählt: kein Tippfehler-Spielraum, sonst wäre evda ≈ evde.
      return checkAnswer(answer, [ex.target], { allowTypos: false });
    case 'conjugation': {
      // Fragepartikel und değil sind eigene Bausteine; Leerzeichen und Apostroph zählen nicht.
      const squash = (s: string) => s.replace(/[\s'’?]/g, '');
      return sameForm(squash(ex.target), squash(answer))
        ? { verdict: 'correct', matched: ex.target, hints: [] }
        : { verdict: 'wrong', hints: [] };
    }
  }
}

/** Kanonische Lösung zur Anzeige im Feedback. */
export function solutionOf(ex: Supported): string {
  if (ex.type === 'multiple_choice') return ex.answer;
  if (ex.type === 'suffix_builder' || ex.type === 'conjugation') return ex.target;
  return ex.answers[0]!;
}

/** Bausteine der Wortbank: Wörter der kanonischen Lösung plus Ablenker, stabil gemischt. */
export function wordBankTokens(ex: Extract<Exercise, { type: 'word_bank' }>): string[] {
  const words = ex.answers[0]!.split(/\s+/).map((w) => w.replace(/^[„"«]+|[.,!?;:"“»]+$/g, ''));
  return seededShuffle([...words, ...(ex.distractors ?? [])], ex.id);
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
