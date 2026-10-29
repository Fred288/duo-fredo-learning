import type { Lesson } from '../content/schema';
import { placementMark, type Placement } from '../placement/record';
import type { Card, VocabDir } from '../srs/card';
import { unitOfExercise } from '../srs/card';
import { INTERVALS } from '../srs/leitner';
import { reconcileCards } from '../srs/reconcile';
import { addDays } from './day';
import { completedLessonIds, progressLessons, type Attempt, type Completion } from './stats';

// Dezente Statistik (SPEC 2): Zahlen, die beim Lernen helfen. Bewusst keine Punkte, Ränge,
// Rekorde oder Vergleiche. Reine Funktionen; der heutige Tag wird hineingereicht.

export interface InsightUnit {
  id: string;
  title: string;
  lessons: Pick<Lesson, 'id' | 'type'>[];
  vocab: readonly string[];
}

/** Ab dieser Box gilt eine Karte als gefestigt (Abstand zwei Wochen und mehr). */
export const SETTLED_BOX = 4;
/** Zeitraum für die Trefferquote je Unit. */
export const ACCURACY_DAYS = 30;

export interface BoxCounts {
  /** Anzahl je Box, Index 0 = Box 1. */
  boxes: number[];
  /** Vokabeln der Kurs-Units ohne Karte in dieser Richtung. */
  unseen: number;
}

/** Vokabeln je Leitner-Box und Richtung. de→tr entsteht erst später, `unseen` zählt dort mit. */
export function vocabBoxes(
  units: readonly InsightUnit[],
  cards: readonly Card[],
  dir: VocabDir,
): BoxCounts {
  const boxes = INTERVALS.map(() => 0);
  const seen = new Set<string>();
  for (const c of cards) {
    if (c.ref.kind !== 'vocab' || c.ref.dir !== dir) continue;
    seen.add(c.ref.vocabId);
    const i = Math.min(Math.max(c.box, 1), INTERVALS.length) - 1;
    boxes[i]!++;
  }
  const all = new Set(units.flatMap((u) => u.vocab));
  return { boxes, unseen: [...all].filter((v) => !seen.has(v)).length };
}

export interface DueDay {
  day: string;
  count: number;
}

/** Fällige Karten je Tag ab heute; Überfälliges zählt auf heute. */
export function dueForecast(cards: readonly Card[], today: string, days = 7): DueDay[] {
  const out = Array.from({ length: days }, (_, i) => ({ day: addDays(today, i), count: 0 }));
  const last = out[out.length - 1]?.day;
  for (const c of cards) {
    if (!last || c.due > last) continue;
    const day = c.due < today ? today : c.due;
    const slot = out.find((d) => d.day === day);
    if (slot) slot.count++;
  }
  return out;
}

/** Karten, die am häufigsten falsch waren; Gleichstand: niedrigere Box, länger nicht geübt. */
export function hardItems(cards: readonly Card[], kind: Card['ref']['kind'], limit = 10): Card[] {
  return cards
    .filter((c) => c.ref.kind === kind && c.lapses > 0)
    .sort((a, b) => b.lapses - a.lapses || a.box - b.box || a.lastAt - b.lastAt)
    .slice(0, limit);
}

/**
 * Lektion einer Übung über das ID-Präfix, nicht über „-e<n>“ abschneiden: erzeugte Übungen
 * tragen die Quell-ID (a2-u01-z1-l3-e8, a1-u01-h1-v-merhaba).
 */
export function lessonOfExercise<L extends { id: string }>(
  lessons: readonly L[],
  exerciseId: string,
): L | undefined {
  return lessons.find((l) => exerciseId.startsWith(`${l.id}-`));
}

export interface UnitInsight {
  id: string;
  title: string;
  done: number;
  total: number;
  /** Anteil richtiger (auch fast richtiger) erster Versuche der letzten `ACCURACY_DAYS` Tage; undefined ohne Versuche. */
  accuracy?: number;
  attempts: number;
  /** Karten der Unit insgesamt und davon gefestigt (Box ≥ SETTLED_BOX). */
  cards: number;
  settled: number;
  /** Laut Einstufung bekannt (übersprungen). */
  skipped: boolean;
}

export function unitOverview(
  units: readonly InsightUnit[],
  completions: readonly Completion[],
  attempts: readonly Attempt[],
  cards: readonly Card[],
  today: string,
  placement?: Placement,
): UnitInsight[] {
  const completed = completedLessonIds(completions);
  const since = addDays(today, -(ACCURACY_DAYS - 1));
  const fromMs = new Date(`${since}T00:00:00`).getTime();
  const tally = new Map<string, { right: number; all: number }>();
  for (const a of attempts) {
    if (a.at < fromMs) continue;
    const unit = unitOfExercise(a.exerciseId);
    if (!unit) continue;
    const t = tally.get(unit) ?? { right: 0, all: 0 };
    t.all++;
    if (a.verdict !== 'wrong') t.right++;
    tally.set(unit, t);
  }
  return units.map((u) => {
    const lessons = progressLessons(u.lessons);
    const t = tally.get(u.id);
    const own = cards.filter((c) => c.unitId === u.id);
    return {
      id: u.id,
      title: u.title,
      done: lessons.filter((l) => completed.has(l.id)).length,
      total: lessons.length,
      accuracy: t ? t.right / t.all : undefined,
      attempts: t?.all ?? 0,
      cards: own.length,
      settled: own.filter((c) => c.box >= SETTLED_BOX).length,
      skipped: placementMark(placement, u.id) === 'skipped',
    };
  });
}

export interface Insights {
  vocab: Record<VocabDir, BoxCounts>;
  due: DueDay[];
  hardWords: Card[];
  hardForms: Card[];
  units: UnitInsight[];
}

/**
 * Alles für den Statistik-Screen. Karten zu entfernten Inhalten zählen nicht (wie beim
 * Wiederholen über `reconcileCards`); `skip` nimmt Karten aus, die gerade nicht geübt werden
 * können (Hörkarten ohne Stimme).
 */
export function insights(
  units: readonly InsightUnit[],
  completions: readonly Completion[],
  attempts: readonly Attempt[],
  allCards: readonly Card[],
  today: string,
  opts: { skip?: (card: Card) => boolean; placement?: Placement } = {},
): Insights {
  const cards = reconcileCards(units, allCards).cards.filter((c) => !opts.skip?.(c));
  return {
    vocab: { tr_de: vocabBoxes(units, cards, 'tr_de'), de_tr: vocabBoxes(units, cards, 'de_tr') },
    due: dueForecast(cards, today),
    hardWords: hardItems(cards, 'vocab'),
    hardForms: hardItems(cards, 'exercise'),
    units: unitOverview(units, completions, attempts, cards, today, opts.placement),
  };
}
