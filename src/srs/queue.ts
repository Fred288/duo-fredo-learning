import { cardId, type Card, type CardRef, type VocabRef } from './card';
import { isDue } from './scheduler';

export interface QueueEntry {
  ref: CardRef;
  unitId: string;
}

export interface VocabCandidate extends QueueEntry {
  ref: VocabRef;
}

/** Fällige Karten, schwächste Box zuerst, dann am längsten fällig. Rückstau bleibt einfach liegen. */
export function dueCards(cards: readonly Card[], today: string): Card[] {
  return cards
    .filter((c) => isDue(c, today))
    .sort((a, b) => a.box - b.box || a.due.localeCompare(b.due) || a.id.localeCompare(b.id));
}

interface UnitVocab {
  id: string;
  lessons: readonly { id: string }[];
  /** Vokabel-IDs der Unit in Inhaltsreihenfolge. */
  vocab: readonly string[];
}

/**
 * Noch nicht eingeführte Vokabelkarten aus Units mit mindestens einer abgeschlossenen Lektion.
 * Erst Erkennen (tr→de); Abrufen (de→tr) kommt dazu, sobald tr→de in Box 2 angekommen ist.
 */
export function vocabCandidates(
  units: readonly UnitVocab[],
  completedLessons: ReadonlySet<string>,
  cards: readonly Card[],
): VocabCandidate[] {
  const byId = new Map(cards.map((c) => [c.id, c]));
  return units
    .filter((u) => u.lessons.some((l) => completedLessons.has(l.id)))
    .flatMap((u) =>
      u.vocab.flatMap((vocabId): VocabCandidate[] => {
        const ref = (dir: VocabRef['dir']): VocabRef => ({ kind: 'vocab', vocabId, dir });
        const recognize = byId.get(cardId(ref('tr_de')));
        if (!recognize) return [{ ref: ref('tr_de'), unitId: u.id }];
        if (recognize.box >= 2 && !byId.has(cardId(ref('de_tr'))))
          return [{ ref: ref('de_tr'), unitId: u.id }];
        return [];
      }),
    );
}

export interface QueueOptions {
  /** Höchstzahl Karten pro Durchgang. */
  max: number;
  /** Neue Vokabelkarten pro Tag (0 = keine). */
  newPerDay: number;
}

/**
 * Warteschlange eines Durchgangs: fällige Karten und heute noch erlaubte neue Vokabeln.
 * Neue Wörter bekommen bei vollem Rückstau ein Viertel der Plätze, damit sie nicht verhungern.
 * Übungen und Vokabeln wechseln sich ab.
 */
export function buildQueue(
  cards: readonly Card[],
  candidates: readonly VocabCandidate[],
  today: string,
  { max, newPerDay }: QueueOptions,
): QueueEntry[] {
  const due = dueCards(cards, today);
  const introducedToday = cards.filter(
    (c) => c.ref.kind === 'vocab' && c.introduced === today,
  ).length;
  const freshWanted = Math.min(Math.max(newPerDay - introducedToday, 0), candidates.length);
  const reviewSlots = Math.min(due.length, max - Math.min(freshWanted, Math.ceil(max / 4)));
  const fresh = candidates.slice(0, Math.min(freshWanted, max - reviewSlots));
  const picked: QueueEntry[] = [...due.slice(0, reviewSlots), ...fresh];

  const exercises = picked.filter((e) => e.ref.kind === 'exercise');
  const vocab = picked.filter((e) => e.ref.kind === 'vocab');
  const mixed: QueueEntry[] = [];
  for (let i = 0; i < Math.max(exercises.length, vocab.length); i++) {
    if (exercises[i]) mixed.push(exercises[i]!);
    if (vocab[i]) mixed.push(vocab[i]!);
  }
  return mixed.map(({ ref, unitId }) => ({ ref, unitId }));
}
