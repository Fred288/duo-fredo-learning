import { trLower } from '../lib/turkish';
import {
  harmony2,
  harmony4,
  isFront,
  isRounded,
  isVoiceless,
  isVowel,
  lastVowel,
} from './phonology';
import type { AnyTag } from './tags';

export type Step =
  | {
      tag: AnyTag;
      rule: 'harmony2' | 'harmony4';
      vowel: string;
      front: boolean;
      rounded: boolean;
      chose: string;
    }
  | { tag: AnyTag; rule: 'assimilation'; after: string; chose: 'd' | 't' | 'c' | 'ç' }
  | { tag: AnyTag; rule: 'buffer'; letter: string }
  | { tag: AnyTag; rule: 'softening'; from: string; to: string }
  | { tag: AnyTag; rule: 'pronominal_n' }
  | { tag: AnyTag; rule: 'vowel_drop'; vowel: string }
  | { tag: AnyTag; rule: 'stem_vowel_drop'; vowel: string }
  | { tag: AnyTag; rule: 'narrowing'; chose: string }
  | { tag: AnyTag; rule: 'apostrophe' }
  | { tag: AnyTag; rule: 'stem_raising'; from: string; to: string }
  | {
      tag: AnyTag;
      rule: 'aorist_vowel';
      kind:
        | 'vowel_stem'
        | 'monosyllabic'
        | 'polysyllabic'
        | 'exception'
        | 'lexical'
        | 'ability'
        | 'passive';
      chose: string;
    };

export interface RealizeContext {
  /** Bisher gebildete Form vor diesem Suffix (Groß/Klein egal). */
  base: string;
  steps: Step[];
  /** Harmonievokal für die aktuelle Form; Standard: letzter Vokal. */
  harmonyOf?: (current: string) => string;
}

/**
 * Realisiert ein Suffix-Template in Archiphonem-Notation:
 * A = e/a, I = i/ı/ü/u, D = d/t; Klammer: (Vokal) nur nach Konsonant, (Konsonant) nur nach Vokal.
 */
export function realize(template: string, tag: AnyTag, ctx: RealizeContext): string {
  const harmonyOf = ctx.harmonyOf ?? ((current: string) => lastVowel(current)!);
  let out = '';
  for (let j = 0; j < template.length; j++) {
    const ch = template[j]!;
    // Apostroph (Eigennamen) ist für Puffer und Harmonie unsichtbar: Ayşe'yim.
    const current = trLower(ctx.base + out).replaceAll("'", '');
    const prevChar = current.at(-1) ?? '';

    if (ch === '(') {
      const inner = template[j + 1]!;
      j += 2; // inner + ')'
      const innerIsVowel = inner === 'I' || inner === 'A' || isVowel(inner);
      const keep = innerIsVowel ? !isVowel(prevChar) : isVowel(prevChar);
      if (!keep) continue;
      if (!innerIsVowel) {
        out += inner;
        ctx.steps.push({ tag, rule: 'buffer', letter: inner });
        continue;
      }
      out += realizeVowel(inner, harmonyOf(current), tag, ctx.steps);
      continue;
    }
    if (ch === 'A' || ch === 'I') {
      out += realizeVowel(ch, harmonyOf(current), tag, ctx.steps);
      continue;
    }
    if (ch === 'C') {
      const chose = isVoiceless(prevChar) ? 'ç' : 'c';
      ctx.steps.push({ tag, rule: 'assimilation', after: prevChar, chose });
      out += chose;
      continue;
    }
    if (ch === 'D') {
      const chose = isVoiceless(prevChar) ? 't' : 'd';
      ctx.steps.push({ tag, rule: 'assimilation', after: prevChar, chose });
      out += chose;
      continue;
    }
    out += ch;
  }
  return out;
}

export function realizeVowel(arch: string, vowel: string, tag: AnyTag, steps: Step[]): string {
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
