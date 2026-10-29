import { solveExercise } from '../content/lexicon';
import type { Exercise, Vocab } from '../content/schema';
import { verbStem, type Inflection } from '../morphology';
import { harmony2 } from '../morphology/phonology';
import { seededShuffle } from './grade';

type Conjugation = Extract<Exercise, { type: 'conjugation' }>;

const GROUPS = ['ıiuü', 'ea'];
// e/a → i/ı (verengte Verneinung als typischer Fehler außerhalb des Präsens)
const NARROW: Record<string, string> = { e: 'i', a: 'ı' };
const OTHER_AORIST: Record<string, string> = { i: 'e', ü: 'e', ı: 'a', u: 'a', e: 'i', a: 'ı' };

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
      // Präsens: unverengtes gel-me-yor; sonst die verengte Form als Fehler (gel-mi-di).
      const v = seg.text.at(-1)!;
      add([NARROW[v] ? `m${NARROW[v]}` : `m${harmony2(v)}`], seed);
      // Aorist 1. Person: gelmezim statt gelmem
      if (ex.tense === 'aorist' && (ex.person === '1sg' || ex.person === '1pl')) {
        add([`z${NARROW[v] ?? 'i'}${ex.person === '1sg' ? 'm' : 'z'}`], `${seed}-z`);
      }
    } else if (
      (seg.tag === 'PAST' || seg.tag === 'IMP' || seg.tag === 'COND' || seg.tag === 'EVID') &&
      seg.text.startsWith('y')
    ) {
      // Pufferlaut vergessen: öğrenci-dim, oku-in
      add([seg.text.slice(1)], seed);
      add(harmonyVariants(seg.text), `${seed}-h`);
    } else if (seg.tag === 'PAST') {
      // d/t-Verwechslung (gitdi) neben falscher Harmonie
      const swapped = (seg.text[0] === 't' ? 'd' : 't') + seg.text.slice(1);
      add([swapped], seed);
      add(harmonyVariants(seg.text), `${seed}-h`);
    } else if (seg.tag === 'FUT' && seg.text.endsWith('ğ')) {
      // ohne Erweichung: gelecekim
      add([seg.text.slice(0, -1) + 'k'], seed);
    } else if (seg.tag === 'AOR' && seg.text.length === 2) {
      // andere Aorist-Klasse: geler statt gelir, yapır statt yapar
      add([OTHER_AORIST[seg.text[0]!]! + 'r'], seed);
    } else if (seg.tag !== 'STEM' && seg.tag !== 'NEG_COP') {
      add(harmonyVariants(seg.text), seed);
    }
  });

  return { tokens: seededShuffle([...correct, ...distractors], ex.id), solution };
}
