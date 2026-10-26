import { completedLessonIds, type Completion } from '../progress/stats';
import { cardId, type Card } from './card';
import { buildQueue, vocabCandidates, type QueueEntry } from './queue';

/** Höchstzahl Karten pro Wiederholungsdurchgang. */
export const SESSION_MAX = 20;

export interface RepeatPlan {
  queue: QueueEntry[];
  /** Fällige Karten im Durchgang. */
  due: number;
  /** Neu eingeführte Vokabelkarten im Durchgang. */
  fresh: number;
}

/** Was heute ansteht: fällige Karten und neue Wörter aus Units mit abgeschlossener Lektion. */
export function planRepeat(
  units: Parameters<typeof vocabCandidates>[0],
  completions: readonly Completion[],
  cards: readonly Card[],
  today: string,
  newPerDay: number,
): RepeatPlan {
  const candidates = vocabCandidates(units, completedLessonIds(completions), cards);
  const queue = buildQueue(cards, candidates, today, { max: SESSION_MAX, newPerDay });
  const known = new Set(cards.map((c) => c.id));
  const due = queue.filter((e) => known.has(cardId(e.ref))).length;
  return { queue, due, fresh: queue.length - due };
}
