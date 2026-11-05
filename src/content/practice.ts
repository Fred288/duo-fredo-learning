import type { PreparedLookup } from '../lookup/search';
import { annotatePassage, readingResolver } from './reading';
import type { Level, Unit } from './schema';

// Übungstexte nach der Lektion (`texts` der Unit, docs/TEXT_PRACTICE_PLAN.md): Der Build löst
// jedes Wort auf wie im Lesetext. Anders als dort ist ein unbekanntes Wort ein Fehler, und jede
// Vokabel muss aus dieser oder einer früheren Unit stammen: Der Text soll nur Gelerntes benutzen.
// Die Grammatik prüft der Build nicht (die Engine führt auch Formen späterer Units zurück).

/** Satzzahl je Niveau (Build-Warnung außerhalb). */
export const TEXT_SENTENCES: Record<Level, readonly [min: number, max: number]> = {
  A1: [3, 5],
  A2: [5, 7],
  B1: [6, 9],
  B2: [8, 12],
};

export function withTexts(
  unit: Unit,
  prepared: PreparedLookup,
): { unit: Unit; errors: string[]; warnings: string[] } {
  if (!unit.texts?.length) return { unit, errors: [], warnings: [] };
  const order = new Map(prepared.index.units.map((u, i) => [u.id, i]));
  const unitOf = new Map(prepared.vocab.map(({ entry }) => [entry.id, entry.unit]));
  const here = order.get(unit.id) ?? -1;
  const errors: string[] = [];
  const warnings: string[] = [];
  const [min, max] = TEXT_SENTENCES[unit.level];

  const texts = unit.texts.map((text) => {
    const resolver = readingResolver(prepared, unit.id, text.glossary);
    const { passage, unknown } = annotatePassage(text, resolver);
    for (const w of new Set(unknown)) {
      errors.push(`${text.id}: Wort unbekannt (Vokabel, Engine-Form oder glossary): ${w}`);
    }
    const later = new Set<string>();
    for (const token of passage.tokens?.flat() ?? []) {
      const from = token.vocab && unitOf.get(token.vocab);
      if (from && (order.get(from) ?? -1) > here) later.add(`${token.text} (${from})`);
    }
    for (const w of later) errors.push(`${text.id}: Wort aus einer späteren Unit: ${w}`);
    const n = text.sentences.length;
    if (n < min || n > max) {
      warnings.push(`${text.id}: ${n} Sätze, für ${unit.level} sind ${min}–${max} vorgesehen`);
    }
    return passage;
  });
  return { unit: { ...unit, texts }, errors, warnings };
}
