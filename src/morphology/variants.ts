import { NONFINITE } from './nonfinite';
import { SUFFIXES } from './suffixes';
import type { MorphTag, NonfiniteTag } from './tags';

const EXPANSIONS: Record<string, string[]> = {
  A: ['e', 'a'],
  I: ['i', 'ı', 'ü', 'u'],
  D: ['d', 't'],
  C: ['c', 'ç'],
};

/** Alle Oberflächenformen eines Suffix-Templates, inkl. mit/ohne Pufferlaut. */
export function suffixVariants(tag: MorphTag | NonfiniteTag): string[] {
  // -ki harmonisiert nicht: die harmonisierten Formen sind typische Fehler.
  if (tag === 'KI') return ['ki', 'kı', 'ku', 'kü'];
  const template =
    tag in NONFINITE ? NONFINITE[tag as NonfiniteTag] : SUFFIXES[tag as MorphTag].template;
  let forms = [''];
  for (let i = 0; i < template.length; i++) {
    const ch = template[i]!;
    if (ch === '(') {
      const inner = template[i + 1]!;
      i += 2;
      const options = [...(EXPANSIONS[inner] ?? [inner]), ''];
      forms = forms.flatMap((f) => options.map((o) => f + o));
    } else {
      const options = EXPANSIONS[ch] ?? [ch];
      forms = forms.flatMap((f) => options.map((o) => f + o));
    }
  }
  return [...new Set(forms)];
}
