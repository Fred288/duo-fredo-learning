import { trLower } from '../lib/turkish';
import { isVowel, lastVowel, normalize, soften, VOWELS } from './phonology';
import { POSS_3PL_AFTER_PL, PRONOMINAL_N, SUFFIXES } from './suffixes';
import type { AnyTag, MorphTag } from './tags';
import { realize, type Step } from './template';

export type { Step } from './template';

export interface Stem {
  form: string;
  /** Lexikalische Erweichung vor Vokal (kitap → kitabı). */
  softens?: boolean;
  /** Harmonievokal, falls abweichend vom letzten Vokal (saat → wie e). */
  harmonyVowel?: string;
  /** Letzter Stammvokal fällt vor vokalischem Suffix aus (oğul → oğlum). */
  dropsVowel?: boolean;
  /** Eigenname: Schreibung bleibt, Apostroph vor dem Suffix, keine geschriebene Erweichung. */
  proper?: boolean;
  /** Großgeschrieben, aber ohne Apostroph (Nationalitäten: Türkler, Almanım). */
  capitalized?: boolean;
  /** Stamm mit y vor Genitiv und Possessiv (su → suyun, suyum; ne → neyin). */
  yStem?: boolean;
}

// Suffixe, vor denen ein y-Stamm sein y zeigt (nicht POSS_3PL: suları).
const Y_STEM_TAGS: ReadonlySet<MorphTag> = new Set([
  'GEN',
  'POSS_1SG',
  'POSS_2SG',
  'POSS_3SG',
  'POSS_1PL',
  'POSS_2PL',
]);

export interface Inflection {
  form: string;
  segments: { tag: AnyTag | 'STEM'; text: string }[];
  steps: Step[];
}

export class MorphError extends Error {}

// Noch nicht abgedeckt; später über weitere Vocab-Flags lösbar.
export const KNOWN_LIMITS = [
  'Konsonantenverdopplung (hak → hakkı, ret → reddi)',
  'Stumme Endung arabischer Lehnwörter (cami → camii)',
  'ne + Possessiv 3. Sg. ist „nesi“, mit y_stem entstünde „neyi“',
  'Kopula imiş in der Frage (öğretmen miymiş) ungeprüft',
  'Verbmorphologie ab Stufe 4 (Voluntativ, -Iyordu, Konditional -sA, Partizipien, Verbalnomen, Passiv/Kausativ)',
] as const;

export const asStem = (input: Stem | string): Stem =>
  typeof input === 'string' ? { form: input } : input;

/** Schreibform des Stamms: Eigennamen und Nationalitäten behalten die Großschreibung. */
export const stemSpelling = (stem: Stem): string =>
  stem.proper || stem.capitalized ? stem.form.normalize('NFC').trim() : normalize(stem.form);

export function inflect(input: Stem | string, tags: MorphTag[]): Inflection {
  const stem = asStem(input);
  let stemForm = stemSpelling(stem);
  if (!lastVowel(trLower(stemForm)) && !stem.harmonyVowel) {
    throw new MorphError(`Stamm "${stem.form}" enthält keinen Vokal`);
  }
  checkOrder(tags);

  const steps: Step[] = [];
  const suffixTexts: string[] = [];
  // Die Harmonie-Ausnahme gilt, solange der letzte Vokal noch der des Stamms ist.
  const harmonyOf = (current: string) =>
    stem.harmonyVowel && !lastVowel(current.slice(stemForm.length))
      ? stem.harmonyVowel
      : lastVowel(current)!;

  tags.forEach((tag, i) => {
    const prev = tags[i - 1];
    let template = SUFFIXES[tag].template;
    if (tag === 'POSS_3PL' && prev === 'PL') template = POSS_3PL_AFTER_PL;
    if ((prev === 'POSS_3SG' || prev === 'POSS_3PL') && PRONOMINAL_N[tag]) {
      template = PRONOMINAL_N[tag]!;
      steps.push({ tag, rule: 'pronominal_n' });
    }

    // y-Stamm: das y gehört zum Suffix-Baustein (su-yun), danach gilt der Stamm als konsonantisch.
    const yPrefix = i === 0 && stem.yStem && Y_STEM_TAGS.has(tag) ? 'y' : '';
    if (yPrefix) steps.push({ tag, rule: 'buffer', letter: 'y' });
    const out =
      yPrefix +
      realize(template, tag, {
        base: stemForm + suffixTexts.join('') + yPrefix,
        steps,
        harmonyOf,
      });

    // Lautwandel am Stamm nur vor vokalisch anlautendem erstem Suffix.
    if (i === 0 && isVowel(out[0] ?? '')) {
      if (stem.dropsVowel) {
        const dropped = dropLastVowel(stemForm);
        if (dropped) {
          stemForm = dropped.form;
          steps.push({ tag, rule: 'vowel_drop', vowel: dropped.vowel });
        }
      }
      // Bei Eigennamen bleibt die Erweichung ungeschrieben (Mehmet'e).
      if (stem.softens && !stem.proper) {
        const s = soften(stemForm);
        if (s) {
          stemForm = s.form;
          steps.push({ tag, rule: 'softening', from: s.from, to: s.to });
        }
      }
    }
    suffixTexts.push(out);
  });

  const apostrophe = stem.proper && tags.length > 0 ? "'" : '';
  if (apostrophe) steps.push({ tag: tags[0]!, rule: 'apostrophe' });
  return {
    form: stemForm + apostrophe + suffixTexts.join(''),
    segments: [
      { tag: 'STEM', text: stemForm },
      ...tags.map((tag, i) => ({ tag, text: suffixTexts[i]! })),
    ],
    steps,
  };
}

/** Entfernt den letzten Vokal (oğul → oğl); nur wenn danach noch genau ein Konsonant folgt. */
function dropLastVowel(form: string): { form: string; vowel: string } | undefined {
  const i = form.length - 2;
  const vowel = form[i];
  if (!vowel || !VOWELS.includes(vowel) || isVowel(form.at(-1)!)) return undefined;
  return { form: form.slice(0, i) + form.slice(i + 1), vowel };
}

function checkOrder(tags: MorphTag[]): void {
  let lastSlot = 0;
  for (const tag of tags) {
    const { slot } = SUFFIXES[tag];
    if (slot <= lastSlot) {
      throw new MorphError(`Ungültige Suffixreihenfolge: ${tags.join(' + ')}`);
    }
    lastSlot = slot;
  }
}
