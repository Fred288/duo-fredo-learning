import type { Exercise } from '../content/schema';
import type { AnswerHint, AnswerResult } from '../lib/answer';
import { seededShuffle } from '../lib/shuffle';
import { trLower, trUpper } from '../lib/turkish';

type SovPuzzle = Extract<Exercise, { type: 'sov_puzzle' }>;

// Satzbau: Die Antwort sind die Satzglieder in gewählter Reihenfolge, mit | verbunden.
// Richtig sind nur die Grundreihenfolge und die hinterlegten Varianten (`orders`).

export const ORDER_JOINER = '|';

/** Grundreihenfolge plus hinterlegte Varianten, als Indizes in `chunks`. */
export const validOrders = (ex: SovPuzzle): number[][] => [
  ex.chunks.map((_, i) => i),
  ...(ex.orders ?? []).map((o) => o.order),
];

const sameOrder = (a: readonly number[], b: readonly number[]) =>
  a.length === b.length && a.every((x, i) => x === b[i]);

/** Satzglieder gemischt, stabil je Übung; nie schon in einer gültigen Reihenfolge. */
export function orderTokens(ex: SovPuzzle): string[] {
  const valid = validOrders(ex);
  const indices = ex.chunks.map((_, i) => i);
  for (let attempt = 0; attempt < 20; attempt++) {
    const order = seededShuffle(indices, attempt ? `${ex.id}:${attempt}` : ex.id);
    if (!valid.some((v) => sameOrder(v, order))) return order.map((i) => ex.chunks[i]!.text);
  }
  // Drei Glieder mit vielen Varianten: rückwärts ist bei Verb am Ende nie gültig.
  return [...ex.chunks].reverse().map((c) => c.text);
}

/** Reihenfolge der Antwort als Indizes; undefined, wenn Glieder fehlen oder fremd sind. */
export function orderOf(ex: SovPuzzle, answer: string): number[] | undefined {
  const given = answer.split(ORDER_JOINER).map((s) => trLower(s.trim()));
  const keys = ex.chunks.map((c) => trLower(c.text));
  const order = given.map((g) => keys.indexOf(g));
  const complete =
    order.length === keys.length && !order.includes(-1) && new Set(order).size === order.length;
  return complete ? order : undefined;
}

/** Satz in einer Reihenfolge: erstes Wort groß, Satzzeichen vom Original. */
export function sentenceFor(ex: SovPuzzle, order: readonly number[]): string {
  const body = order.map((i) => ex.chunks[i]!.text).join(' ');
  const end = /[.!?…]+$/.exec(ex.text)?.[0] ?? '';
  return trUpper(body.charAt(0)) + body.slice(1) + end;
}

/** Hinterlegte Variante, auf die die Antwort passt (für den Fokus-Hinweis). */
export function matchedVariant(ex: SovPuzzle, answer: string) {
  const order = orderOf(ex, answer);
  return order && ex.orders?.find((o) => sameOrder(o.order, order));
}

/**
 * Warum eine Reihenfolge nicht passt, als Regel: Prädikat am Ende, unbestimmtes Objekt und
 * Fragewort direkt davor. Die Regeln erklären nur; richtig ist allein, was hinterlegt ist.
 */
export function orderHints(ex: SovPuzzle, order: readonly number[]): AnswerHint[] {
  // Eine Regel meldet sich nur, wenn die Grundreihenfolge ihr folgt (Ne zaman tekrar … nicht).
  const broken = (roles: string[]): AnswerHint[] => {
    const at = roles.indexOf('predicate');
    const before = roles[at - 1];
    return [
      ...(at !== roles.length - 1 ? (['predicate_last'] as const) : []),
      ...(roles.includes('object_bare') && before !== 'object_bare'
        ? (['bare_object'] as const)
        : roles.includes('question') && before !== 'question'
          ? (['question_word'] as const)
          : []),
    ];
  };
  const canonical = broken(ex.chunks.map((c) => c.role));
  return broken(order.map((i) => ex.chunks[i]!.role)).filter((h) => !canonical.includes(h));
}

export function gradeOrder(ex: SovPuzzle, answer: string): AnswerResult {
  const order = orderOf(ex, answer);
  if (!order) return { verdict: 'wrong', hints: [] };
  if (validOrders(ex).some((v) => sameOrder(v, order))) {
    return { verdict: 'correct', matched: sentenceFor(ex, order), hints: [] };
  }
  return { verdict: 'wrong', hints: orderHints(ex, order) };
}
