import { cardId, type Card, type VocabDir } from './card';
import { isDue } from './scheduler';

export interface DirStatus {
  box: number;
  due: string;
  isDue: boolean;
}

/** Stand einer Vokabel im Wiederholen, je Richtung; undefined = noch nicht eingeführt. */
export function vocabStatus(
  cards: readonly Card[],
  vocabId: string,
  today: string,
): Record<VocabDir, DirStatus | undefined> {
  const of = (dir: VocabDir): DirStatus | undefined => {
    const id = cardId({ kind: 'vocab', vocabId, dir });
    const card = cards.find((c) => c.id === id);
    return card && { box: card.box, due: card.due, isDue: isDue(card, today) };
  };
  return { tr_de: of('tr_de'), de_tr: of('de_tr') };
}
