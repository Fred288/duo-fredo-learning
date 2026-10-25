import { SUFFIXES } from './suffixes';
import type { MorphTag } from './tags';

const EXPANSIONS: Record<string, string[]> = {
  A: ['e', 'a'],
  I: ['i', 'ı', 'ü', 'u'],
  D: ['d', 't'],
};

/** Alle Oberflächenformen eines Suffix-Templates, inkl. mit/ohne Pufferlaut. */
export function suffixVariants(tag: MorphTag): string[] {
  const template = SUFFIXES[tag].template;
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
