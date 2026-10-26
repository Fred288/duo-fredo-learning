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
  /** Neue Wörter (erste tr→de-Karte) im Durchgang. */
  fresh: number;
  /** Erstmals abgefragte Rückrichtungen (de→tr) bekannter Wörter im Durchgang. */
  recall: number;
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
  const fresh = queue.filter((e) => !known.has(cardId(e.ref)));
  const recall = fresh.filter((e) => e.ref.kind === 'vocab' && e.ref.dir === 'de_tr').length;
  return {
    queue,
    due: queue.length - fresh.length,
    fresh: fresh.length - recall,
    recall,
    gone,
    moved,
  };
}
