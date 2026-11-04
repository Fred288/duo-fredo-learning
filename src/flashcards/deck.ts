import type { Level } from '../content/schema';
import type { Card } from '../srs/card';
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
  | { scope: 'marked' }
  /** Wörter, die im SRS oft falsch waren (`HARD_MAX` mit den meisten Fehlern). */
  | { scope: 'hard' };

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
  /** SRS-Karten, nur gelesen (für „Schwer“); ohne sie ist der Stapel leer. */
  srsCards?: readonly Card[];
  /** Hörkarten nur mit Stimme; sonst fällt „Hören“ auf Türkisch → Deutsch zurück. */
  canListen?: boolean;
}

/** So viele Wörter enthält der „Schwer“-Stapel höchstens. */
export const HARD_MAX = 30;

/**
 * Vokabel-IDs mit den meisten Fehlern im SRS (beide Richtungen zusammen), höchstens `max`.
 * Gleichstand entscheidet die ID, damit die Auswahl stabil bleibt.
 */
export function hardVocabIds(cards: readonly Card[], max = HARD_MAX): Set<string> {
  const lapses = new Map<string, number>();
  for (const c of cards) {
    if (c.ref.kind !== 'vocab' || c.lapses <= 0) continue;
    lapses.set(c.ref.vocabId, (lapses.get(c.ref.vocabId) ?? 0) + c.lapses);
  }
  return new Set(
    [...lapses]
      .sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]))
      .slice(0, max)
      .map(([id]) => id),
  );
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

const DIRS: readonly FlashDir[] = ['tr_de', 'de_tr', 'listen'];
/** „Gemischt“ würfelt nur zwischen den Leserichtungen; Hören wählt man bewusst. */
const TEXT_DIRS: readonly FlashDir[] = ['tr_de', 'de_tr'];

function inScope(item: FlashItem, scope: Scope, units: readonly ManifestUnit[], state: DeckState) {
  switch (scope.scope) {
    case 'hard':
      return item.kind === 'vocab' && hardVocabIds(state.srsCards ?? []).has(item.ref);
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
  { scope, content, dir: wanted, order }: Selection,
  state: DeckState,
  random: () => number = Math.random,
): DeckCard[] {
  const canListen = state.canListen ?? false;
  // Ohne Stimme gibt es keine Hörkarten: die Wahl „Hören“ fällt auf Türkisch → Deutsch zurück.
  const dir: DirChoice = wanted === 'listen' && !canListen ? 'tr_de' : wanted;
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
      .filter(
        (c): c is DeckCard =>
          !!c && (canListen || c.dir !== 'listen') && (dir === 'mixed' || c.dir === dir),
      );
  } else {
    cards = items.map((i) => ({
      ...i,
      dir: dir === 'mixed' ? TEXT_DIRS[random() < 0.5 ? 0 : 1]! : dir,
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
