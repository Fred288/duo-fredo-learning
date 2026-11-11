import type { Verdict } from '../lib/answer';
import { daysBetween } from '../progress/day';
import type { Card } from '../srs/card';
import { LAST_PHASE } from '../srs/leitner';
import { t } from '../i18n';

/**
 * Dezente Zeile im Feedback: Phase im Wiederholen samt nächstem Termin und wie oft die Frage
 * schon falsch war. Ein einziger Fehler, der gerade passiert ist, wird nicht eigens genannt.
 * Keine Zeile, wenn es weder Karte noch Fehler gibt.
 */
export function cardNote(
  card: Pick<Card, 'box' | 'due'> | undefined,
  misses: number,
  verdict: Verdict,
  today: string,
): string | undefined {
  const parts: string[] = [];
  if (card) {
    const days = daysBetween(today, card.due);
    const when =
      days <= 0
        ? t('note.when.today')
        : days === 1
          ? t('note.when.tomorrow')
          : t('note.when.days', { days });
    parts.push(t('note.phase', { box: Math.min(card.box, LAST_PHASE), max: LAST_PHASE, when }));
  }
  if (misses > 1 || (misses === 1 && verdict !== 'wrong')) {
    parts.push(misses === 1 ? t('note.misses.one') : t('note.misses', { count: misses }));
  }
  return parts.length ? parts.join(' · ') : undefined;
}
