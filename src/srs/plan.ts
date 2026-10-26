import { completedLessonIds, type Completion } from '../progress/stats';
import { cardId, type Card } from './card';
import { buildQueue, vocabCandidates, type QueueEntry } from './queue';
import { reconcileCards } from './reconcile';

/** Höchstzahl Karten pro Wiederholungsdurchgang. */
export const SESSION_MAX = 20;

export interface RepeatPlan {
  queue: QueueEntry[];
  /** Fällige Karten im Durchgang. */
  due: number;
  /** Neu eingeführte Vokabelkarten im Durchgang. */
  fresh: number;
  /** Karten, deren Inhalt entfernt wurde; der Aufrufer räumt sie ab. */
  gone: string[];
  /** Vokabelkarten mit geänderter Unit; der Aufrufer speichert sie. */
  moved: Card[];
}

/**
 * Was heute ansteht: fällige Karten und neue Wörter aus Units mit abgeschlossener Lektion.
 * Karten zu entfernten Units/Vokabeln zählen nicht mit (verwaiste Karten).
 */
export function planRepeat(
  units: Parameters<typeof vocabCandidates>[0],
  completions: readonly Completion[],
  allCards: readonly Card[],
  today: string,
  newPerDay: number,
): RepeatPlan {
  const { cards, gone, moved } = reconcileCards(units, allCards);
  const candidates = vocabCandidates(units, completedLessonIds(completions), cards, today);
  const queue = buildQueue(cards, candidates, today, { max: SESSION_MAX, newPerDay });
  const known = new Set(cards.map((c) => c.id));
  const due = queue.filter((e) => known.has(cardId(e.ref))).length;
  return { queue, due, fresh: queue.length - due, gone, moved };
}
