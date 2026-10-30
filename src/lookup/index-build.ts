import { explainerSections, sectionSlug } from '../content/explainer-section';
import { vocabId, type Unit } from '../content/schema';
import { searchKey } from './key';
import type { LookupIndex, SectionEntry, VocabEntry } from './types';

/** Ab dieser Größe (Bytes, roh) warnt der Build: der Index liegt im Precache. */
export const LOOKUP_WARN_BYTES = 200_000;

/** Wörter ab zwei Zeichen, damit auch Suffixe wie „de“ oder „ki“ einen Abschnitt finden. */
const MIN_WORD = 2;

function sectionWords(title: string, body: string): string[] {
  const words = searchKey(`${title} ${body}`.replaceAll('**', '')).split(' ');
  return [...new Set(words.filter((w) => w.length >= MIN_WORD))];
}

/**
 * Index des Nachschlagewerks aus allen Units (Kursreihenfolge) und ihren Erklärkarten
 * (`explainers`: Pfad relativ zu content/ → Markdown). Formen stehen nicht darin, die bildet
 * die Engine zur Laufzeit.
 */
export function buildLookup(
  units: readonly Unit[],
  explainers: ReadonlyMap<string, string>,
): LookupIndex {
  const vocab: VocabEntry[] = units.flatMap((unit) =>
    (unit.vocab ?? []).map((v) => ({
      id: vocabId(v),
      tr: v.tr,
      de: v.de,
      pos: v.pos,
      unit: unit.id,
      softens: v.softens,
      harmony_vowel: v.harmony_vowel,
      drops_vowel: v.drops_vowel,
      proper: v.proper,
      capitalized: v.capitalized,
      y_stem: v.y_stem,
      doubles: v.doubles,
      poss_no_s: v.poss_no_s,
      aorist: v.aorist,
      register: v.register,
    })),
  );
  const sections: SectionEntry[] = units.flatMap((unit) => {
    const md = unit.explainer ? explainers.get(unit.explainer) : undefined;
    return md
      ? explainerSections(md).map((s) => ({
          unit: unit.id,
          title: s.title,
          slug: sectionSlug(s.title),
          words: sectionWords(s.title, s.body),
        }))
      : [];
  });
  return {
    v: 1,
    units: units.map((u) => ({ id: u.id, title: u.title, explainer: u.explainer })),
    vocab,
    sections,
  };
}

/** Doppelte Anker innerhalb einer Erklärkarte (der Sprung aus dem Nachschlagewerk wäre mehrdeutig). */
export function duplicateSlugs(markdown: string): string[] {
  const seen = new Set<string>();
  const dup = new Set<string>();
  for (const { title } of explainerSections(markdown)) {
    const slug = sectionSlug(title);
    if (seen.has(slug)) dup.add(slug);
    seen.add(slug);
  }
  return [...dup];
}
