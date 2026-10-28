import { vocabId, type Exercise, type Vocab } from '../content/schema';
import { fnv1a } from '../lib/hash';
import { trLower } from '../lib/turkish';
import { cardId, type VocabRef } from './card';

/** Deutsche Bedeutungen wie in der Vokabelliste: „Land, Staat“. */
export const glossOf = (v: Vocab): string => v.de.join(', ');

export const stableShuffle = <T>(items: readonly T[], key: (t: T) => string, seed: string): T[] =>
  [...items].sort((a, b) => fnv1a(seed + key(a)) - fnv1a(seed + key(b)));

const sharesMeaning = (a: Vocab, b: Vocab) => a.de.some((d) => b.de.includes(d));

/**
 * Übung zu einer Vokabelkarte, gebaut aus den Unit-Daten, damit Runner und Bewertung
 * unverändert bleiben. tr→de: Multiple Choice mit Ablenkern derselben Wortart aus dem Pool;
 * de→tr: Freitext, jedes Lemma mit gleicher Bedeutung gilt als richtig.
 */
export function vocabExercise(
  ref: VocabRef,
  vocab: Vocab,
  pool: readonly Vocab[],
  /** Heutiger Tag: mischt die Optionen je Tag neu, damit die Position nicht auswendig sitzt. */
  day = '',
): Exercise {
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
  const distractors = glossDistractors(vocab, others);
  if (!distractors.length) {
    return { id, type: 'free_text', direction: 'tr_de', prompt: vocab.tr, answers: vocab.de };
  }
  return {
    id,
    type: 'multiple_choice',
    prompt: vocab.tr,
    options: stableShuffle([answer, ...distractors], (o) => o, vocab.tr + day),
    answer,
    speak_prompt: vocab.tr,
  };
}

/**
 * Bis zu drei deutsche Bedeutungen anderer Vokabeln als Ablenker, gleiche Wortart zuerst, stabil
 * gemischt. Homonyme (gleiche tr, andere Bedeutung, z. B. yemek Verb/Nomen) sind keine Ablenker:
 * ihre Bedeutung wäre eine ebenfalls richtige Antwort.
 */
export function glossDistractors(vocab: Vocab, pool: readonly Vocab[], count = 3): string[] {
  const answer = glossOf(vocab);
  const distinct = pool.filter(
    (o) =>
      vocabId(o) !== vocabId(vocab) &&
      trLower(o.tr) !== trLower(vocab.tr) &&
      !sharesMeaning(o, vocab) &&
      glossOf(o) !== answer,
  );
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
  return [...new Set(ranked.map(glossOf))].slice(0, count);
}
