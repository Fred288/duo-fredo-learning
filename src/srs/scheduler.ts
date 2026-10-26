import type { Verdict } from '../lib/answer';
import type { Card, CardRef } from './card';
import { cardId } from './card';

/** Austauschbarer Wiederholungsalgorithmus. Rein; der heutige Tag wird hineingereicht. */
export interface Scheduler {
  readonly id: string;
  /** Stand nach der ersten Bewertung einer neuen Karte. */
  introduce(verdict: Verdict, today: string): Pick<Card, 'box' | 'due' | 'lapses'>;
  /** Stand nach einer weiteren Bewertung, fällig oder nicht. */
  review(card: Card, verdict: Verdict, today: string, at: number): Card;
}

export const isDue = (card: Pick<Card, 'due'>, today: string): boolean => card.due <= today;

/** Legt die Karte bei der ersten Bewertung an, sonst schreibt sie sie fort. */
export function record(
  scheduler: Scheduler,
  card: Card | undefined,
  init: { ref: CardRef; unitId: string },
  verdict: Verdict,
  today: string,
  at: number,
): Card {
  if (card) return scheduler.review(card, verdict, today, at);
  return {
    id: cardId(init.ref),
    ref: init.ref,
    unitId: init.unitId,
    ...scheduler.introduce(verdict, today),
    introduced: today,
    lastAt: at,
  };
}
