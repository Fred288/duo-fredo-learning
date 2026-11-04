// Karteikarten (App): getrennt vom SRS, verändern keine Leitner-Boxen (Nutzerentscheidung).

/** Wortkarte (Vokabel-ID) oder Satzkarte (Übungs-ID). */
export type FlashKind = 'vocab' | 'phrase';
/** `listen`: nur der gesprochene türkische Text, die Bedeutung (Deutsch) ist die Antwort. */
export type FlashDir = 'tr_de' | 'de_tr' | 'listen';
/** Aufdecken und selbst bewerten oder Antwort eintippen. */
export type FlashMode = 'flip' | 'type';

/** Eine Antwort im Karteikasten (nur anhängen); die erste je Karte und Runde. */
export interface Flash {
  kind: FlashKind;
  /** Vokabel-ID bzw. Übungs-ID; `id` ist in Dexie der Auto-Schlüssel. */
  ref: string;
  dir: FlashDir;
  correct: boolean;
  mode: FlashMode;
  at: number;
}

/** Markierung je Wort/Satz (beide Richtungen); bei mehreren Geräten gilt der jüngste Stand. */
export interface FlashMark {
  /** `itemKey`: kind:ref */
  key: string;
  marked: boolean;
  at: number;
}

/** Wort oder Satz einer Lektion. */
export interface FlashItem {
  kind: FlashKind;
  ref: string;
  unitId: string;
  lessonId: string;
}

/** Karte einer Runde: Wort/Satz in einer Richtung. */
export interface DeckCard extends FlashItem {
  dir: FlashDir;
}

export const itemKey = (i: Pick<FlashItem, 'kind' | 'ref'>): string => `${i.kind}:${i.ref}`;
export const cardKey = (c: Pick<DeckCard, 'kind' | 'ref' | 'dir'>): string =>
  `${c.kind}:${c.ref}:${c.dir}`;
