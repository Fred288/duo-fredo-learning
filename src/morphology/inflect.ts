import {
  harmony2,
  harmony4,
  isFront,
  isRounded,
  isVoiceless,
  isVowel,
  lastVowel,
  normalize,
  soften,
} from './phonology';
import { POSS_3PL_AFTER_PL, PRONOMINAL_N, SUFFIXES } from './suffixes';
import type { MorphTag } from './tags';

export interface Stem {
  form: string;
  /** Lexikalische Erweichung vor Vokal (kitap → kitabı). */
  softens?: boolean;
  /** Harmonievokal, falls abweichend vom letzten Vokal (saat → wie e). */
  harmonyVowel?: string;
}

export type Step =
  | {
      tag: MorphTag;
      rule: 'harmony2' | 'harmony4';
      vowel: string;
      front: boolean;
      rounded: boolean;
      chose: string;
    }
  | { tag: MorphTag; rule: 'assimilation'; after: string; chose: 'd' | 't' }
  | { tag: MorphTag; rule: 'buffer'; letter: string }
  | { tag: MorphTag; rule: 'softening'; from: string; to: string }
  | { tag: MorphTag; rule: 'pronominal_n' };

export interface Inflection {
  form: string;
  segments: { tag: MorphTag | 'STEM'; text: string }[];
  steps: Step[];
}

export class MorphError extends Error {}

// Noch nicht abgedeckt; später über weitere Vocab-Flags lösbar.
export const KNOWN_LIMITS = [
  'Konsonantenverdopplung (hak → hakkı)',
  'Unregelmäßige Stämme (su → suyu, ne → neyi)',
  'Vokalausfall (ağız → ağzı, burun → burnu)',
  "Eigennamen mit Apostroph (İstanbul'da)",
] as const;

export function inflect(input: Stem | string, tags: MorphTag[]): Inflection {
  const stem: Stem = typeof input === 'string' ? { form: input } : input;
  let stemForm = normalize(stem.form);
  if (!lastVowel(stemForm) && !stem.harmonyVowel) {
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

    const base = stemForm + suffixTexts.join('');
    let out = '';
    for (let j = 0; j < template.length; j++) {
      const ch = template[j]!;
      const current = base + out;
      const prevChar = current.at(-1)!;

      if (ch === '(') {
        const inner = template[j + 1]!;
        j += 2; // inner + ')'
        const innerIsVowel = inner === 'I' || inner === 'A' || isVowel(inner);
        const keep = innerIsVowel ? !isVowel(prevChar) : isVowel(prevChar);
        if (!keep) continue;
        if (!innerIsVowel) {
          out += inner;
          steps.push({ tag, rule: 'buffer', letter: inner });
          continue;
        }
        out += realizeVowel(inner, harmonyOf(current), tag, steps);
        continue;
      }
      if (ch === 'A' || ch === 'I') {
        out += realizeVowel(ch, harmonyOf(current), tag, steps);
        continue;
      }
      if (ch === 'D') {
        const chose = isVoiceless(prevChar) ? 't' : 'd';
        steps.push({ tag, rule: 'assimilation', after: prevChar, chose });
        out += chose;
        continue;
      }
      out += ch;
    }

    // Erweichung nur direkt am Stamm und nur vor vokalisch anlautendem Suffix.
    if (i === 0 && stem.softens && isVowel(out[0] ?? '')) {
      const s = soften(stemForm);
      if (s) {
        stemForm = s.form;
        steps.push({ tag, rule: 'softening', from: s.from, to: s.to });
      }
    }
    suffixTexts.push(out);
  });

  return {
    form: stemForm + suffixTexts.join(''),
    segments: [
      { tag: 'STEM', text: stemForm },
      ...tags.map((tag, i) => ({ tag, text: suffixTexts[i]! })),
    ],
    steps,
  };
}

function realizeVowel(arch: string, vowel: string, tag: MorphTag, steps: Step[]): string {
  if (arch !== 'A' && arch !== 'I') return arch;
  const chose = arch === 'A' ? harmony2(vowel) : harmony4(vowel);
  steps.push({
    tag,
    rule: arch === 'A' ? 'harmony2' : 'harmony4',
    vowel,
    front: isFront(vowel),
    rounded: isRounded(vowel),
    chose,
  });
  return chose;
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
