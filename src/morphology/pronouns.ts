// Personal- und Demonstrativpronomen sind unregelmäßig (bana, sana, onu …): Tabelle statt Regeln.
export const PRONOUN_CASES = ['NOM', 'ACC', 'DAT', 'LOC', 'ABL', 'GEN', 'INS'] as const;
export type PronounCase = (typeof PRONOUN_CASES)[number];

const TABLE = {
  ben: ['ben', 'beni', 'bana', 'bende', 'benden', 'benim', 'benimle'],
  sen: ['sen', 'seni', 'sana', 'sende', 'senden', 'senin', 'seninle'],
  o: ['o', 'onu', 'ona', 'onda', 'ondan', 'onun', 'onunla'],
  biz: ['biz', 'bizi', 'bize', 'bizde', 'bizden', 'bizim', 'bizimle'],
  siz: ['siz', 'sizi', 'size', 'sizde', 'sizden', 'sizin', 'sizinle'],
  onlar: ['onlar', 'onları', 'onlara', 'onlarda', 'onlardan', 'onların', 'onlarla'],
  bu: ['bu', 'bunu', 'buna', 'bunda', 'bundan', 'bunun', 'bununla'],
  şu: ['şu', 'şunu', 'şuna', 'şunda', 'şundan', 'şunun', 'şununla'],
} as const satisfies Record<string, readonly string[]>;

export type PronounLemma = keyof typeof TABLE;
export const PRONOUN_LEMMAS = Object.keys(TABLE) as PronounLemma[];

export function pronoun(lemma: PronounLemma, kase: PronounCase): string {
  return TABLE[lemma][PRONOUN_CASES.indexOf(kase)]!;
}
