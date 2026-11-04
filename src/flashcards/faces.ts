import type { Exercise } from '../content/schema';
import { formKind, nounForms, verbForms, type Form } from '../lookup/forms';
import type { VocabEntry } from '../lookup/types';
import type { DeckCard } from './types';

// Was auf einer Karte steht (rein): Vorder- und Rückseite, Lösungen fürs Eintippen und der
// türkische Text zum Vorlesen. Wörter kommen aus dem Nachschlage-Index, Sätze aus den Unit-Daten.

export type PhraseExercise = Extract<Exercise, { type: 'word_bank' | 'free_text' }>;

export interface CardData {
  vocab: ReadonlyMap<string, VocabEntry>;
  phrases: ReadonlyMap<string, PhraseExercise>;
}

export interface Faces {
  front: string;
  back: string;
  frontLang: 'tr' | 'de';
  /** Akzeptierte Antworten beim Eintippen (Sprache der Rückseite). */
  answers: string[];
  /** Türkischer Text der Karte (Vorlesen, Nachsprechen). */
  turkish: string;
  vocab?: VocabEntry;
  phrase?: PhraseExercise;
  /** Hörkarte: Die Vorderseite ist nur der gespeicherte Ton, `front` ist leer. */
  listen?: true;
}

/** Vorder-/Rückseite; `undefined`, wenn Wort oder Satz nicht (mehr) im Inhalt steht. */
export function facesOf(card: DeckCard, data: CardData): Faces | undefined {
  const base = facesOfText(card, data);
  // Hören: wie Türkisch → Deutsch, aber ohne den türkischen Text vorn.
  return base && card.dir === 'listen' ? { ...base, front: '', listen: true } : base;
}

function facesOfText(card: DeckCard, data: CardData): Faces | undefined {
  if (card.kind === 'vocab') {
    const entry = data.vocab.get(card.ref);
    if (!entry) return undefined;
    const de = entry.de.join(', ');
    return card.dir !== 'de_tr'
      ? {
          front: entry.tr,
          back: de,
          frontLang: 'tr',
          answers: [...entry.de],
          turkish: entry.tr,
          vocab: entry,
        }
      : {
          front: de,
          back: entry.tr,
          frontLang: 'de',
          answers: [entry.tr],
          turkish: entry.tr,
          vocab: entry,
        };
  }
  const ex = data.phrases.get(card.ref);
  if (!ex) return undefined;
  const tr = ex.answers[0]!;
  return card.dir === 'de_tr'
    ? {
        front: ex.prompt,
        back: tr,
        frontLang: 'de',
        answers: [...ex.answers],
        turkish: tr,
        phrase: ex,
      }
    : {
        front: tr,
        back: ex.prompt,
        frontLang: 'tr',
        answers: [ex.prompt],
        turkish: tr,
        phrase: ex,
      };
}

const has = (forms: Form[], match: (f: Form) => boolean) => forms.find(match);

/**
 * Hinweise aus den Engine-Flags: die Form, an der die Besonderheit sichtbar wird
 * (kitap → kitabı, şehir → şehri, gitmek → gidiyorum). Ohne Flag nichts.
 */
export function flagHints(entry: VocabEntry): Form[] {
  const kind = formKind(entry);
  if (kind === 'noun') {
    const flagged =
      entry.softens ||
      entry.drops_vowel ||
      entry.doubles ||
      entry.y_stem ||
      entry.harmony_vowel ||
      entry.poss_no_s;
    if (!flagged) return [];
    const forms = nounForms(entry);
    const tagged = (tags: string) => (f: Form) =>
      f.label.kind === 'noun' && f.label.tags.join('+') === tags;
    return [
      has(forms, tagged('ACC')),
      entry.poss_no_s ? has(forms, tagged('POSS_3SG')) : undefined,
    ].filter((f): f is Form => !!f);
  }
  if (kind === 'verb') {
    if (!entry.softens && !entry.aorist) return [];
    const forms = verbForms(entry);
    const at = (tense: string, person: string) => (f: Form) =>
      f.label.kind === 'verb' &&
      f.label.tense === tense &&
      f.label.person === person &&
      !f.label.negative &&
      !f.label.compound;
    return [
      entry.softens ? has(forms, at('present', '1sg')) : undefined,
      entry.aorist ? has(forms, at('aorist', '3sg')) : undefined,
    ].filter((f): f is Form => !!f);
  }
  return [];
}
