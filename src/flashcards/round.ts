import { cardKey, type DeckCard } from './types';

// Eine Runde im Karteikasten (reine Zustandsmaschine): Nicht gewusste Karten wandern ans Ende
// und kommen wieder, bis jede einmal gewusst ist. Gezählt und gespeichert wird nur die erste
// Antwort je Karte, damit Wiederholungen in der Runde die Auswertung nicht schönen.

export interface Round {
  /** Noch offene Karten; die erste ist die aktuelle. */
  queue: readonly DeckCard[];
  flipped: boolean;
  /** Erste Antwort je Karte (`cardKey`) in Reihenfolge der Antworten. */
  first: ReadonlyMap<string, boolean>;
  /** Alle Karten der Runde in Startreihenfolge. */
  cards: readonly DeckCard[];
}

export function startRound(cards: readonly DeckCard[]): Round {
  const seen = new Set<string>();
  const unique = cards.filter((c) => !seen.has(cardKey(c)) && seen.add(cardKey(c)));
  return { queue: unique, flipped: false, first: new Map(), cards: unique };
}

export const current = (r: Round): DeckCard | undefined => r.queue[0];
export const isDone = (r: Round): boolean => r.queue.length === 0;

export const flip = (r: Round): Round => (isDone(r) ? r : { ...r, flipped: true });

export interface Graded {
  round: Round;
  /** Erste Antwort auf diese Karte in der Runde: speichern. */
  record?: { card: DeckCard; correct: boolean };
}

/** Bewertet die aktuelle Karte (auch ohne Umdrehen, etwa beim Eintippen). */
export function grade(r: Round, correct: boolean): Graded {
  const card = current(r);
  if (!card) return { round: r };
  const key = cardKey(card);
  const isFirst = !r.first.has(key);
  const first = isFirst ? new Map(r.first).set(key, correct) : r.first;
  const rest = r.queue.slice(1);
  const queue = correct ? rest : [...rest, card];
  return {
    round: { ...r, queue, flipped: false, first },
    record: isFirst ? { card, correct } : undefined,
  };
}

export interface RoundSummary {
  total: number;
  /** Beim ersten Mal gewusst. */
  firstTry: number;
  /** Erst nach Wiederholung in der Runde gewusst (oder noch offen bei Abbruch). */
  retried: number;
  /** Karten, die beim ersten Mal falsch waren, für „Nur die falschen nochmal“. */
  wrong: DeckCard[];
}

export function summary(r: Round): RoundSummary {
  const wrong = r.cards.filter((c) => r.first.get(cardKey(c)) === false);
  const firstTry = r.cards.filter((c) => r.first.get(cardKey(c)) === true).length;
  return { total: r.cards.length, firstTry, retried: wrong.length, wrong };
}

/** Wie viele Karten in der Runde schon einmal falsch waren und noch offen sind. */
export const againCount = (r: Round): number =>
  r.queue.filter((c) => r.first.get(cardKey(c)) === false).length;
