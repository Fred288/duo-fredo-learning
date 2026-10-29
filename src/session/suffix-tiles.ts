import type { Exercise, Vocab } from '../content/schema';
import { verbStem, type Inflection, type Stem } from '../morphology';
import { suffixVariants } from '../morphology/variants';
import { solveExercise, stemFromVocab } from '../content/lexicon';
import { seededShuffle } from './grade';

type SuffixBuilder = Extract<Exercise, { type: 'suffix_builder' }>;

export interface SuffixTiles {
  /** Bausteine (Stammformen + Suffixvarianten), stabil gemischt. */
  tokens: string[];
  /** Zerlegung und Begründung der richtigen Lösung. */
  solution: Inflection;
}

/** Stamm samt lexikalischer Flags aus dem Wortschatz der Unit. */
export const stemFor = (ex: SuffixBuilder, vocab: readonly Vocab[] = []): Stem =>
  stemFromVocab(ex.stem, vocab);

const MAX_DISTRACTORS_PER_SLOT = 1;

/** Richtige Segmente aus der Engine plus plausibel falsche Varianten (falsche Harmonie etc.). */
export function suffixTiles(ex: SuffixBuilder, vocab: readonly Vocab[] = []): SuffixTiles {
  const solution = solveExercise(ex, vocab);
  const correct = new Set(solution.segments.map((s) => s.text));

  const distractors: string[] = [];
  const add = (candidates: string[], seed: string) => {
    const pool = candidates.filter((c) => c && !correct.has(c) && !distractors.includes(c));
    distractors.push(...seededShuffle(pool, seed).slice(0, MAX_DISTRACTORS_PER_SLOT));
  };

  // Stamm: ungeänderte Form als Ablenker, wenn die Erweichung sie verändert hat.
  // Bei Verben: Stamm ohne Erweichung/Hebung (git statt gid), dazu falsche Harmonie der Form.
  const plain = ex.verbal ? verbStem(ex.stem) : ex.stem;
  const stemSegment = solution.segments[0]!.text;
  if (stemSegment !== plain) add([plain], `${ex.id}-stem`);
  if (ex.verbal) {
    // Erweichtes -dığ/-acağ: Ablenker ebenfalls mit ğ, dazu die unerweichte Form (duk).
    const own = solution.segments.find((s) => s.tag === ex.verbal)?.text ?? '';
    const variants = suffixVariants(ex.verbal);
    if (own.endsWith('ğ')) {
      add([own.slice(0, -1) + 'k'], `${ex.id}-k`);
      add(
        variants.map((v) => v.replace(/k$/, 'ğ')),
        `${ex.id}-v`,
      );
    } else add(variants, `${ex.id}-v`);
  }
  ex.suffixes.forEach((tag, i) => add(suffixVariants(tag), `${ex.id}-${i}`));

  return {
    tokens: seededShuffle([...correct, ...distractors], ex.id),
    solution,
  };
}
