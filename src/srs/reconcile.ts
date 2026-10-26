import type { Card } from './card';

interface UnitVocabIds {
  id: string;
  vocab: readonly string[];
}

export interface Reconciled {
  /** Karten, deren Inhalt es noch gibt (Vokabeln mit aktueller Unit). */
  cards: Card[];
  /** IDs von Karten, deren Unit oder Vokabel nicht mehr existiert. */
  gone: string[];
  /** Vokabelkarten, die in eine andere Unit gewandert sind (mit neuer `unitId`). */
  moved: Card[];
}

/**
 * Gleicht Karten mit dem Manifest ab. Übungs-IDs enthalten ihre Unit, Vokabel-IDs nicht: eine
 * verschobene Vokabel behält ihren Stand und bekommt nur die neue Unit.
 */
export function reconcileCards(units: readonly UnitVocabIds[], cards: readonly Card[]): Reconciled {
  const unitIds = new Set(units.map((u) => u.id));
  const unitOfVocab = new Map<string, string>();
  for (const u of units) for (const v of u.vocab) if (!unitOfVocab.has(v)) unitOfVocab.set(v, u.id);

  const out: Reconciled = { cards: [], gone: [], moved: [] };
  for (const card of cards) {
    const unitId =
      card.ref.kind === 'exercise'
        ? unitIds.has(card.unitId)
          ? card.unitId
          : undefined
        : unitOfVocab.get(card.ref.vocabId);
    if (!unitId) out.gone.push(card.id);
    else if (unitId === card.unitId) out.cards.push(card);
    else {
      const moved = { ...card, unitId };
      out.cards.push(moved);
      out.moved.push(moved);
    }
  }
  return out;
}
