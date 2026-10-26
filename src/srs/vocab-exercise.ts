import { vocabId, type Exercise, type Vocab } from '../content/schema';
import { cardId, type VocabRef } from './card';

/** Deutsche Bedeutungen wie in der Vokabelliste: „Land, Staat“. */
export const glossOf = (v: Vocab): string => v.de.join(', ');

// FNV-1a: stabile Pseudo-Zufallsreihenfolge ohne Math.random, gleich bei jedem Aufruf.
function hash(s: string): number {
  let h = 0x811c9dc5;
  for (let i = 0; i < s.length; i++) h = Math.imul(h ^ s.charCodeAt(i), 0x01000193);
  return h >>> 0;
}
const stableShuffle = <T>(items: readonly T[], key: (t: T) => string, seed: string): T[] =>
  [...items].sort((a, b) => hash(seed + key(a)) - hash(seed + key(b)));

const sharesMeaning = (a: Vocab, b: Vocab) => a.de.some((d) => b.de.includes(d));

/**
 * Übung zu einer Vokabelkarte, gebaut aus den Unit-Daten, damit Runner und Bewertung
 * unverändert bleiben. tr→de: Multiple Choice mit Ablenkern derselben Wortart aus dem Pool;
 * de→tr: Freitext, jedes Lemma mit gleicher Bedeutung gilt als richtig.
 */
export function vocabExercise(ref: VocabRef, vocab: Vocab, pool: readonly Vocab[]): Exercise {
  const id = `srs-${cardId(ref)}`;
  const others = pool.filter((o) => vocabId(o) !== vocabId(vocab));
  if (ref.dir === 'de_tr') {
    const synonyms = others.filter((o) => sharesMeaning(o, vocab)).map((o) => o.tr);
    return {
      id,
      type: 'free_text',
      direction: 'de_tr',
      prompt: glossOf(vocab),
      answers: [...new Set([vocab.tr, ...synonyms])],
      ...(vocab.register && { register: vocab.register }),
    };
  }

  const answer = glossOf(vocab);
  const distinct = others.filter((o) => !sharesMeaning(o, vocab) && glossOf(o) !== answer);
  const ranked = [
    ...stableShuffle(
      distinct.filter((o) => o.pos === vocab.pos),
      vocabId,
      vocab.tr,
    ),
    ...stableShuffle(
      distinct.filter((o) => o.pos !== vocab.pos),
      vocabId,
      vocab.tr,
    ),
  ];
  const distractors = [...new Set(ranked.map(glossOf))].slice(0, 3);
  if (!distractors.length) {
    return { id, type: 'free_text', direction: 'tr_de', prompt: vocab.tr, answers: vocab.de };
  }
  return {
    id,
    type: 'multiple_choice',
    prompt: vocab.tr,
    options: stableShuffle([answer, ...distractors], (o) => o, vocab.tr),
    answer,
  };
}
