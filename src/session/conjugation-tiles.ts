import { solveExercise } from '../content/lexicon';
import type { Exercise, Vocab } from '../content/schema';
import { verbStem, type Inflection } from '../morphology';
import { harmony2 } from '../morphology/phonology';
import { seededShuffle } from './grade';

type Conjugation = Extract<Exercise, { type: 'conjugation' }>;

const GROUPS = ['ıiuü', 'ea'];

/** Alle Formen, in denen ein Vokal des Bausteins durch einen anderen seiner Gruppe ersetzt ist. */
function harmonyVariants(text: string): string[] {
  const first = [...text].find((c) => GROUPS.some((g) => g.includes(c)));
  if (!first) return [];
  const group = GROUPS.find((g) => g.includes(first))!;
  return [...group].filter((v) => v !== first).map((v) => text.replaceAll(first, v));
}

/** Engine-Segmente plus typische Fehler: falsche Harmonie, unverengtes -me/-ma, unveränderter Stamm. */
export function conjugationTiles(
  ex: Conjugation,
  vocab: readonly Vocab[] = [],
): { tokens: string[]; solution: Inflection } {
  const solution = solveExercise(ex, vocab);
  const correct = solution.segments.map((s) => s.text).filter(Boolean);
  const distractors: string[] = [];
  const add = (candidates: string[], seed: string) => {
    const pool = candidates.filter((c) => c && !correct.includes(c) && !distractors.includes(c));
    distractors.push(...seededShuffle(pool, seed).slice(0, 1));
  };

  solution.segments.forEach((seg, i) => {
    const seed = `${ex.id}-${i}`;
    if (seg.tag === 'STEM' && ex.mode === 'verb') {
      // Ungeänderter Stamm (bekle statt bekl, git statt gid) als typischer Fehler
      add([verbStem(ex.lemma)], seed);
    } else if (seg.tag === 'NEG') {
      // Unverengte Verneinung: gel-me-yor
      add([`m${harmony2(seg.text.at(-1)!)}`], seed);
    } else if (seg.tag !== 'STEM' && seg.tag !== 'NEG_COP') {
      add(harmonyVariants(seg.text), seed);
    }
  });

  return { tokens: seededShuffle([...correct, ...distractors], ex.id), solution };
}
