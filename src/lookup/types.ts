import type { Vocab } from '../content/schema';

/** Felder einer Vokabel, die Suche, Formtabelle und Rückführung gebeugter Formen brauchen. */
export type VocabEntry = Pick<
  Vocab,
  | 'tr'
  | 'de'
  | 'pos'
  | 'softens'
  | 'harmony_vowel'
  | 'drops_vowel'
  | 'proper'
  | 'capitalized'
  | 'y_stem'
  | 'doubles'
  | 'poss_no_s'
  | 'compound_stem'
  | 'aorist'
  | 'register'
> & {
  /** `vocabId`: Schlüssel der SRS-Karten, trennt Homonyme (yemek / yemek-essen). */
  id: string;
  unit: string;
};

/** `##`-Abschnitt einer Erklärkarte; der Text selbst kommt beim Öffnen aus der .md. */
export interface SectionEntry {
  unit: string;
  title: string;
  /** Anker der Überschrift (`sectionSlug`). */
  slug: string;
  /** Suchschlüssel (`searchKey`) der Wörter aus Titel und Text, dedupliziert. */
  words: string[];
}

export interface LookupUnit {
  id: string;
  title: string;
  explainer?: string;
}

/** public/content/lookup.json, vom Build erzeugt (`buildLookup`). */
export interface LookupIndex {
  v: 1;
  /** Units in Kursreihenfolge; Vokabeln und Abschnitte verweisen über die ID. */
  units: LookupUnit[];
  vocab: VocabEntry[];
  sections: SectionEntry[];
}
