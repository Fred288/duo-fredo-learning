import { trLower } from '../lib/turkish';
import { isVowel, lastVowel, normalize, soften, VOWELS } from './phonology';
import { DERIVATIONS, KI_ROUNDED, POSS_3PL_AFTER_PL, PRONOMINAL_N, SUFFIXES } from './suffixes';
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
  'Kausativ (B2); -DIkçA, -(y)IncAyA kadar, -(y)AsI, -mAktAnsA nicht gebildet',
  'Infinite Formen: -(y)An ohne Possessiv, -DIk ohne Possessiv nur mit Ablativ (geldikten), -mAk nur mit -DA/-DAn/-(y)lA, Konverbien ohne Endungen',
  'Optativ nur 1sg/1pl (gelesin, geleler veraltet); geldiydi, gelseymiş bewusst nicht',
  'Frage mit ise (geliyor muysa) nicht gebildet',
  'benimki/seninki: Pronomen + -ki nur als Text, nicht über die Engine',
  'Unregelmäßiges Passiv (anlamak → anlaşılmak) nicht abgedeckt',
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
    if (tag === 'KI' && i === 0 && KI_ROUNDED.has(normalize(stemForm))) template = 'kü';
    if ((prev === 'POSS_3SG' || prev === 'POSS_3PL' || prev === 'KI') && PRONOMINAL_N[tag]) {
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

    // -lık erweicht vor vokalischer Endung: güzellik → güzelliği.
    if (prev === 'LIK' && isVowel(out[0] ?? '')) {
      const s = soften(suffixTexts[i - 1]!);
      if (s) {
        suffixTexts[i - 1] = s.form;
        steps.push({ tag: prev, rule: 'softening', from: s.from, to: s.to });
      }
    }

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

  // Ableitungen bilden ein neues Wort ohne Apostroph: Ankaralı, Berlinliler.
  const apostrophe = stem.proper && tags.length > 0 && !DERIVATIONS.has(tags[0]!) ? "'" : '';
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
  let lastSlot = -1;
  for (const tag of tags) {
    const { slot } = SUFFIXES[tag];
    // Ableitungen dürfen sich stapeln (kitap-çı-lık).
    const ok = slot > lastSlot || (slot === 0 && lastSlot === 0);
    if (!ok) throw new MorphError(`Ungültige Suffixreihenfolge: ${tags.join(' + ')}`);
    // Nach -ki beginnt ein neues Wort: evde-ki-ler, odada-ki-ni.
    lastSlot = tag === 'KI' ? 0 : slot;
  }
}
