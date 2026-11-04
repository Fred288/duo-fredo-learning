import type { Level } from '../content/schema';
import {
  cardKey,
  itemKey,
  type DeckCard,
  type Flash,
  type FlashDir,
  type FlashItem,
  type FlashKind,
  type FlashMark,
} from './types';

// Stapel zusammenstellen (rein): aus dem Manifest (`lessons[].vocab`/`phrases`) und dem
// Protokoll der Antworten. Zufall wird hineingereicht, damit Tests stabil sind.

interface ManifestUnit {
  id: string;
  level: Level;
  lessons: readonly { id: string; vocab?: readonly string[]; phrases?: readonly string[] }[];
}

export type Scope =
  | { scope: 'lesson'; lessonId: string }
  | { scope: 'unit'; unitId: string }
  | { scope: 'level'; level: Level }
  /** Lektionen mit mindestens einem Abschluss. */
  | { scope: 'learned' }
  /** Karten, deren letzte Antwort falsch war (je Richtung). */
  | { scope: 'wrong' }
  | { scope: 'marked' };

export type Content = FlashKind | 'both';
export type DirChoice = FlashDir | 'mixed';
export type Order = 'course' | 'shuffled';

export interface Selection {
  scope: Scope;
  content: Content;
  dir: DirChoice;
  order: Order;
}

export interface DeckState {
  flashes: readonly Flash[];
  marks: readonly FlashMark[];
  completedLessons: ReadonlySet<string>;
}

/** Alle Wörter und Sätze in Kursreihenfolge (je Lektion erst Wörter, dann Sätze). */
export function allItems(units: readonly ManifestUnit[]): FlashItem[] {
  return units.flatMap((u) =>
    u.lessons.flatMap((l) => [
      ...(l.vocab ?? []).map((ref): FlashItem => ({
        kind: 'vocab',
        ref,
        unitId: u.id,
        lessonId: l.id,
      })),
      ...(l.phrases ?? []).map((ref): FlashItem => ({
        kind: 'phrase',
        ref,
        unitId: u.id,
        lessonId: l.id,
      })),
    ]),
  );
}

/** Letzte Antwort je Karte (Wort/Satz + Richtung). */
export function lastResults(flashes: readonly Flash[]): Map<string, Flash> {
  const last = new Map<string, Flash>();
  for (const f of flashes) {
    const k = cardKey(f);
    const prev = last.get(k);
    if (!prev || f.at >= prev.at) last.set(k, f);
  }
  return last;
}

/** Schlüssel der Karten, deren letzte Antwort falsch war, älteste zuerst. */
export function openWrong(flashes: readonly Flash[]): string[] {
  return [...lastResults(flashes).values()]
    .filter((f) => !f.correct)
    .sort((a, b) => a.at - b.at)
    .map(cardKey);
}

/** Markierte Wörter/Sätze (`itemKey`); je Schlüssel gilt der jüngste Stand. */
export function markedKeys(marks: readonly FlashMark[]): Set<string> {
  const latest = new Map<string, FlashMark>();
  for (const m of marks) {
    const prev = latest.get(m.key);
    if (!prev || m.at >= prev.at) latest.set(m.key, m);
  }
  return new Set([...latest.values()].filter((m) => m.marked).map((m) => m.key));
}

/** Fisher-Yates mit hineingereichtem Zufall. */
export function shuffle<T>(list: readonly T[], random: () => number): T[] {
  const out = [...list];
  for (let i = out.length - 1; i > 0; i--) {
    const j = Math.floor(random() * (i + 1));
    [out[i], out[j]] = [out[j]!, out[i]!];
  }
  return out;
}

const DIRS: readonly FlashDir[] = ['tr_de', 'de_tr'];

function inScope(item: FlashItem, scope: Scope, units: readonly ManifestUnit[], state: DeckState) {
  switch (scope.scope) {
    case 'lesson':
      return item.lessonId === scope.lessonId;
    case 'unit':
      return item.unitId === scope.unitId;
    case 'level':
      return units.find((u) => u.id === item.unitId)?.level === scope.level;
    case 'learned':
      return state.completedLessons.has(item.lessonId);
    case 'marked':
      return markedKeys(state.marks).has(itemKey(item));
    case 'wrong':
      return true;
  }
}

/**
 * Karten einer Runde. Bei „gemischt“ bekommt jedes Wort eine zufällige Richtung; der
 * Falsch-Stapel behält die Richtung, in der die Karte falsch war (bei fester Richtung nur diese).
 */
export function deckFor(
  units: readonly ManifestUnit[],
  { scope, content, dir, order }: Selection,
  state: DeckState,
  random: () => number = Math.random,
): DeckCard[] {
  const items = allItems(units).filter(
    (i) => (content === 'both' || i.kind === content) && inScope(i, scope, units, state),
  );
  let cards: DeckCard[];
  if (scope.scope === 'wrong') {
    const byKey = new Map(
      items.flatMap((i) =>
        DIRS.map((d): [string, DeckCard] => [cardKey({ ...i, dir: d }), { ...i, dir: d }]),
      ),
    );
    cards = openWrong(state.flashes)
      .map((k) => byKey.get(k))
      .filter((c): c is DeckCard => !!c && (dir === 'mixed' || c.dir === dir));
  } else {
    cards = items.map((i) => ({
      ...i,
      dir: dir === 'mixed' ? DIRS[random() < 0.5 ? 0 : 1]! : dir,
    }));
  }
  return order === 'shuffled' ? shuffle(cards, random) : cards;
}

export interface LessonSummary {
  total: number;
  /** Letzte Antwort (gleich welche Richtung) richtig. */
  known: number;
  /** Letzte Antwort falsch. */
  wrong: number;
}

/** „Zuletzt gewusst x von n“ je Wort/Satz einer Lektion. */
export function lessonSummary(
  items: readonly FlashItem[],
  flashes: readonly Flash[],
): LessonSummary {
  const latest = new Map<string, Flash>();
  for (const f of flashes) {
    const k = itemKey(f);
    const prev = latest.get(k);
    if (!prev || f.at >= prev.at) latest.set(k, f);
  }
  let known = 0;
  let wrong = 0;
  for (const i of items) {
    const f = latest.get(itemKey(i));
    if (f?.correct) known++;
    else if (f) wrong++;
  }
  return { total: items.length, known, wrong };
}
