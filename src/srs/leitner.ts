import { addDays } from '../progress/day';
import { isDue, type Scheduler } from './scheduler';

/**
 * Abstand in Tagen je Phase (Phase 1 = Index 0). Sechs Phasen wie in klassischen
 * Karteikasten-Programmen, die letzte nach drei Monaten.
 */
export const INTERVALS = [1, 3, 7, 14, 30, 90] as const;

/** Letzte Phase; in ihr wieder richtig = Langzeit-Abstand, die Karte bleibt im Umlauf. */
export const LAST_PHASE = INTERVALS.length;

/** Abstand, wenn eine Karte der letzten Phase erneut gewusst wurde (etwa ein halbes Jahr). */
export const LONG_TERM_DAYS = 180;

const interval = (box: number): number => INTERVALS[box - 1]!;

/**
 * Phasenmodell (Leitner): richtig rückt eine fällige Karte eine Phase vor, falsch setzt sie
 * immer auf Phase 1. Fast richtig hält die Phase. Vorzeitige richtige Antworten (Lektion
 * wiederholt, Fehler-Modus) schieben nichts vor, sonst ließe sich der Abstand überspringen.
 * Karten der letzten Phase kommen alle `LONG_TERM_DAYS` Tage wieder, nie gar nicht mehr.
 *
 * v2 (sechs Phasen statt fünf): Die gespeicherten Phasen 1–5 behalten Abstand und Bedeutung,
 * daher muss nichts umgerechnet werden; Karten in Phase 5 rücken beim nächsten Treffer in Phase 6.
 */
export const leitner: Scheduler = {
  id: 'leitner-v2',
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
    const box = verdict === 'correct' ? Math.min(card.box + 1, LAST_PHASE) : card.box;
    const days =
      verdict === 'correct' && card.box >= LAST_PHASE
        ? LONG_TERM_DAYS
        : interval(Math.min(box, LAST_PHASE));
    return { ...card, box, due: addDays(today, days), lastAt: at };
  },
};
