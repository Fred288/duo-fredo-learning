import type { Exercise, Lesson } from '../content/schema';
import { fnv1a } from '../lib/hash';
import { attempt, nounStem, verbStemOf, type FormLabel } from '../lookup/forms';
import type { VocabEntry } from '../lookup/types';
import {
  conjugate,
  conjugateVariants,
  inflect,
  inflectVariants,
  PERSONS,
  type MorphTag,
  type Person,
  type Tense,
} from '../morphology';

// Formkarten (K6): „gitmek · Präsens, ich“ → „gidiyorum“. Die Form erzeugt die Engine, es gibt
// keinen neuen Text. Je Wort und Muster genau eine Karte (bei Verben eine Person per Hash), damit
// die Stapel überschaubar bleiben. Ein Muster gilt ab der Lektion, in der seine Grammatik zuerst
// in einer Grammatikübung vorkommt (`formIntro`).

/** Was ein Muster voraussetzt: Endung (`tag:ACC`), Zeit (`tense:past`), Verneinung je Zeit, können. */
type Feature = `tag:${MorphTag}` | `tense:${Tense}` | `neg:${Tense}` | 'ability';

interface NounPattern {
  kind: 'noun';
  key: string;
  tags: MorphTag[];
}
interface VerbPattern {
  kind: 'verb';
  key: string;
  tense: Tense;
  negative?: true;
  ability?: true;
}
export type FormPattern = NounPattern | VerbPattern;

const noun = (...tags: MorphTag[]): NounPattern => ({ kind: 'noun', key: tags.join('+'), tags });
const verb = (tense: Tense, more: { negative?: true; ability?: true } = {}): VerbPattern => ({
  kind: 'verb',
  key: [tense, more.negative && 'neg', more.ability && 'abil'].filter(Boolean).join('-'),
  tense,
  ...more,
});

/** Muster in Abfragereihenfolge; die Schlüssel sind Teil der Karten-ID und bleiben stabil. */
export const FORM_PATTERNS: readonly FormPattern[] = [
  noun('PL'),
  noun('ACC'),
  noun('DAT'),
  noun('LOC'),
  noun('ABL'),
  noun('GEN'),
  noun('POSS_1SG'),
  noun('POSS_3SG'),
  noun('PL', 'LOC'),
  noun('POSS_1SG', 'DAT'),
  verb('present'),
  verb('past'),
  verb('future'),
  verb('aorist'),
  verb('evidential'),
  verb('necessitative'),
  verb('conditional'),
  verb('present', { negative: true }),
  verb('past', { negative: true }),
  verb('aorist', { negative: true }),
  verb('present', { ability: true }),
];

/** Schlüssel eines Musters im Manifest und in der Karten-ID: `noun:ACC`, `verb:past-neg`. */
export const patternKey = (p: FormPattern): string => `${p.kind}:${p.key}`;
const BY_KEY = new Map(FORM_PATTERNS.map((p) => [patternKey(p), p]));

function requires(p: FormPattern): Feature[] {
  if (p.kind === 'noun') return p.tags.map((t) => `tag:${t}` as const);
  return [
    `tense:${p.tense}`,
    ...(p.negative ? [`neg:${p.tense}` as const] : []),
    ...(p.ability ? ['ability' as const] : []),
  ];
}

const verbFeatures = (
  tense: Tense = 'present',
  negative?: boolean,
  ability?: boolean,
): Feature[] => [
  `tense:${tense}`,
  ...(negative ? [`neg:${tense}` as const] : []),
  ...(ability ? ['ability' as const] : []),
];

/** Grammatik, die eine Übung abfragt (nur Grammatikübungen an Nomen und Verben). */
function featuresOf(ex: Exercise): Feature[] {
  switch (ex.type) {
    case 'suffix_builder':
      return ex.verbal ? [] : ex.suffixes.map((t) => `tag:${t}` as const);
    case 'conjugation':
      return ex.mode === 'verb' ? verbFeatures(ex.tense, ex.negative, ex.ability) : [];
    case 'paradigm':
      if (ex.kind === 'noun') return (ex.rows ?? []).flat().map((t) => `tag:${t}` as const);
      return ex.kind === 'verb' ? verbFeatures(ex.tense, ex.negative, ex.ability) : [];
    default:
      return [];
  }
}

/**
 * Lektion, ab der ein Muster gilt (Schlüssel wie `patternKey`): die späteste der ersten
 * Lektionen, in denen seine Bausteine in einer Grammatikübung vorkommen. Muster, deren Grammatik
 * der Kurs nicht übt, fehlen. `lessons` in Kursreihenfolge.
 */
export function formIntro(lessons: readonly Lesson[]): Record<string, string> {
  const first = new Map<Feature, number>();
  lessons.forEach((l, i) => {
    for (const ex of l.exercises)
      for (const f of featuresOf(ex)) if (!first.has(f)) first.set(f, i);
  });
  const out: Record<string, string> = {};
  for (const p of FORM_PATTERNS) {
    const at = requires(p).map((f) => first.get(f));
    if (at.some((i) => i === undefined)) continue;
    out[patternKey(p)] = lessons[Math.max(...(at as number[]))]!.id;
  }
  return out;
}

export type FormWordKind = 'noun' | 'verb';

/** Wörter mit Formkarten: Nomen (keine Adjektive, Mehrwort nur als Kompositum) und Verben. */
export function formWordKind(
  entry: Pick<VocabEntry, 'pos' | 'tr' | 'compound_stem'>,
): FormWordKind | undefined {
  if (entry.pos === 'verb') return 'verb';
  if (entry.pos === 'noun' && (entry.compound_stem || !entry.tr.includes(' '))) return 'noun';
  return undefined;
}

/** Was das Manifest je Formwort weiß: Art und die Flags, die die Muster einschränken. */
export interface FormWord {
  kind: FormWordKind;
  /** Eigenname: nur Kasus (İstanbul'da), kein Plural, kein Possessiv. */
  proper?: true;
  /** Kompositum: ohne „sein/ihr“, das steckt schon drin (atasözü). */
  compound?: true;
}

/** Im Manifest: Formwörter und die Lektion, ab der jedes Muster gilt. */
export interface FormIndex {
  /** Muster-Schlüssel (`patternKey`) → Lektions-ID. */
  intro: Record<string, string>;
  nouns: string[];
  verbs: string[];
  /** Teilmengen von `nouns` mit eingeschränkten Mustern. */
  proper?: string[];
  compound?: string[];
}

/** Formwörter aus den Vokabeln (Build); `vocabId` liefert die stabile ID. */
export function formIndex(
  lessons: readonly Lesson[],
  vocab: readonly (Pick<VocabEntry, 'pos' | 'tr' | 'compound_stem' | 'proper'> & { id: string })[],
): FormIndex {
  const of = (k: FormWordKind) => vocab.filter((v) => formWordKind(v) === k);
  const nouns = of('noun');
  const proper = nouns.filter((v) => v.proper).map((v) => v.id);
  const compound = nouns.filter((v) => v.compound_stem).map((v) => v.id);
  return {
    intro: formIntro(lessons),
    nouns: nouns.map((v) => v.id),
    verbs: of('verb').map((v) => v.id),
    ...(proper.length > 0 && { proper }),
    ...(compound.length > 0 && { compound }),
  };
}

/** Muster eines Wortes in Abfragereihenfolge. */
export function patternsFor(word: FormWord): FormPattern[] {
  return FORM_PATTERNS.filter((p) => {
    if (p.kind !== word.kind) return false;
    if (p.kind === 'noun' && word.proper)
      return p.tags.length === 1 && !['PL', 'POSS_1SG', 'POSS_3SG'].includes(p.tags[0]!);
    if (p.kind === 'noun' && word.compound) return !p.tags.includes('POSS_3SG');
    return true;
  });
}

/** Person einer Verbkarte: stabil je Wort und Muster, über die Wörter verteilt. */
export const personFor = (vocabId: string, key: string): Person =>
  PERSONS[fnv1a(`${vocabId}|${key}`) % PERSONS.length]!;

/** Karten-ID (`ref`) einer Formkarte: `<vocabId>|<noun|verb>:<muster>`. */
export const formRef = (vocabId: string, p: FormPattern): string => `${vocabId}|${patternKey(p)}`;

export function parseFormRef(ref: string): { vocabId: string; pattern: FormPattern } | undefined {
  const at = ref.lastIndexOf('|');
  const pattern = BY_KEY.get(ref.slice(at + 1));
  return at > 0 && pattern ? { vocabId: ref.slice(0, at), pattern } : undefined;
}

export interface FormAnswer {
  label: FormLabel;
  /** Engine-Form zuerst, dann gleichwertige Nebenformen (camii/camisi). */
  forms: string[];
}

/** Die Form einer Karte über die Engine; undefined, wo die Engine die Kombination ablehnt. */
export function formAnswer(entry: VocabEntry, ref: string): FormAnswer | undefined {
  const parsed = parseFormRef(ref);
  if (!parsed || parsed.vocabId !== entry.id) return undefined;
  const { pattern: p } = parsed;
  if (p.kind === 'noun') {
    const stem = nounStem(entry);
    const form = attempt(() => inflect(stem, p.tags).form);
    return form
      ? { label: { kind: 'noun', tags: p.tags }, forms: [form, ...inflectVariants(stem, p.tags)] }
      : undefined;
  }
  const person = personFor(entry.id, `${p.kind}:${p.key}`);
  const opts = { tense: p.tense, person, negative: p.negative, ability: p.ability };
  const stem = verbStemOf(entry);
  const form = attempt(() => conjugate(stem, opts).form);
  if (!form) return undefined;
  return {
    label: {
      kind: 'verb',
      tense: p.tense,
      person,
      ...(p.negative && { negative: true }),
      ...(p.ability && { ability: true }),
    },
    forms: [form, ...conjugateVariants(stem, opts)],
  };
}
