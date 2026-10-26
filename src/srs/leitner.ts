import { addDays } from '../progress/day';
import { isDue, type Scheduler } from './scheduler';

/** Abstand in Tagen je Box (Box 1 = Index 0). */
export const INTERVALS = [1, 3, 7, 14, 30] as const;

const interval = (box: number): number => INTERVALS[box - 1]!;

/**
 * Vereinfachtes Leitner: richtig rückt eine fällige Karte eine Box vor, falsch setzt sie
 * immer auf Box 1. Fast richtig hält die Box. Vorzeitige richtige Antworten (Lektion
 * wiederholt, Fehler-Modus) schieben nichts vor, sonst ließe sich der Abstand überspringen.
 */
export const leitner: Scheduler = {
  id: 'leitner-v1',
  introduce: (verdict, today) => {
    const box = verdict === 'correct' ? 2 : 1;
    return { box, due: addDays(today, interval(box)), lapses: 0 };
  },
  review: (card, verdict, today, at) => {
    if (verdict === 'wrong') {
      return {
        ...card,
        box: 1,
        due: addDays(today, interval(1)),
        lapses: card.lapses + 1,
        lastAt: at,
      };
    }
    if (!isDue(card, today)) return { ...card, lastAt: at };
    const box = verdict === 'correct' ? Math.min(card.box + 1, INTERVALS.length) : card.box;
    return { ...card, box, due: addDays(today, interval(box)), lastAt: at };
  },
};
