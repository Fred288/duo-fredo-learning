import { dayKey } from '../progress/day';
import type { Attempt } from '../progress/stats';
import { cardId, tracks, unitOfExercise, type Card } from './card';
import { record, type Scheduler } from './scheduler';

/**
 * Karten aus vorhandenen Übungsversuchen (Upgrade). Die Versuche kennen den Übungstyp nicht,
 * daher entstehen Karten nur ab dem ersten Fehler; danach zählt jeder Versuch.
 */
export function seedFromAttempts(attempts: readonly Attempt[], scheduler: Scheduler): Card[] {
  const cards = new Map<string, Card>();
  for (const a of [...attempts].sort((x, y) => x.at - y.at)) {
    const unitId = unitOfExercise(a.exerciseId);
    if (!unitId) continue;
    const ref = { kind: 'exercise', exerciseId: a.exerciseId } as const;
    const id = cardId(ref);
    const card = cards.get(id);
    if (!tracks(undefined, a.verdict, !!card)) continue;
    cards.set(
      id,
      record(scheduler, card, { ref, unitId }, a.verdict, dayKey(new Date(a.at)), a.at),
    );
  }
  return [...cards.values()];
}
