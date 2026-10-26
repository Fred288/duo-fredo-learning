import { trLower } from '../lib/turkish';
import { asStem, MorphError, stemSpelling, type Inflection, type Stem } from './inflect';
import { isVowel, lastVowel, normalize, soften } from './phonology';
import type { AnyTag, VerbTag } from './tags';
import { realize, realizeVowel, type Step } from './template';

export const PERSONS = ['1sg', '2sg', '3sg', '1pl', '2pl', '3pl'] as const;
export type Person = (typeof PERSONS)[number];

const PERSON_TAG: Record<Person, VerbTag> = {
  '1sg': 'P1SG',
  '2sg': 'P2SG',
  '3sg': 'P3SG',
  '1pl': 'P1PL',
  '2pl': 'P2PL',
  '3pl': 'P3PL',
};

// Personalendungen Typ 1 (nach -Iyor, im Nominalsatz, an der Fragepartikel).
const TYPE1: Record<Person, string> = {
  '1sg': '(y)Im',
  '2sg': 'sIn',
  '3sg': '',
  '1pl': '(y)Iz',
  '2pl': 'sInIz',
  '3pl': 'lAr',
};

// Personalendungen Typ 2 (nach -DI).
const TYPE2: Record<Person, string> = {
  '1sg': 'm',
  '2sg': 'n',
  '3sg': '',
  '1pl': 'k',
  '2pl': 'nIz',
  '3pl': 'lAr',
};

export const TENSES = ['present', 'past', 'future', 'aorist'] as const;
export type Tense = (typeof TENSES)[number];

export interface VerbStem {
  /** Infinitiv (gelmek) oder Stamm (gel). */
  form: string;
  /** Stammauslaut t → d vor Vokal (gitmek → gidiyor, gider, gideceğim). */
  softens?: boolean;
  /** Aorist-Vokal festlegen, wenn die Regel nicht greift. */
  aorist?: 'ar' | 'ir';
}

export interface ConjugateOptions {
  tense: Tense;
  person: Person;
  negative?: boolean;
  question?: boolean;
}

export interface PredicateOptions {
  person: Person;
  negative?: boolean;
  question?: boolean;
  /** -DIr in der 3. Person Singular (öğretmendir). */
  dir?: boolean;
}

// Einsilbige Stämme, die im Präsens unregelmäßig sind (de- → di-yor, ye- → yi-yor).
const IRREGULAR_PRESENT: Record<string, string> = { de: 'd', ye: 'y' };

export const verbStem = (form: string): string => normalize(form).replace(/m[ea]k$/, '');

type Segment = Inflection['segments'][number];

class Builder {
  segments: Segment[] = [];
  steps: Step[] = [];
  /** Wörter, aus denen die Form besteht (Fragepartikel und değil stehen getrennt). */
  words: string[] = [''];

  get current(): string {
    return this.words.at(-1)!;
  }
  add(tag: Segment['tag'], text: string, newWord = false) {
    if (newWord) this.words.push(text);
    else this.words[this.words.length - 1] += text;
    this.segments.push({ tag, text });
  }
  suffix(tag: VerbTag, template: string, newWord = false) {
    const base = newWord ? '' : this.current;
    const text = realize(template, tag, { base, steps: this.steps });
    if (text || newWord) this.add(tag, text, newWord);
    return text;
  }
  /** Letzten Konsonanten des letzten Bausteins erweichen (-acak → -acağ vor Vokal). */
  softenLast() {
    const seg = this.segments.at(-1)!;
    const s = soften(seg.text);
    if (!s) return;
    this.steps.push({ tag: seg.tag as AnyTag, rule: 'softening', from: s.from, to: s.to });
    const word = this.words.at(-1)!;
    this.words[this.words.length - 1] = word.slice(0, word.length - seg.text.length) + s.form;
    seg.text = s.form;
  }
  result(): Inflection {
    return { form: this.words.join(' '), segments: this.segments, steps: this.steps };
  }
}

/**
 * Personalendung Typ 1, bei Fragen an der Partikel mI (außer 3. Pl.).
 * softenBefore: -AcAk erweicht vor vokalischer Endung (geleceğim, aber geleceksin).
 */
function personAndQuestion(
  b: Builder,
  person: Person,
  question: boolean,
  { softenBefore = false } = {},
) {
  const tag = PERSON_TAG[person];
  if (!question) {
    const ending = realize(TYPE1[person], tag, { base: b.current, steps: [] });
    if (softenBefore && isVowel(ending[0] ?? '')) b.softenLast();
    b.suffix(tag, TYPE1[person]);
    return;
  }
  if (person === '3pl') b.suffix(tag, TYPE1[person]);
  // mI harmonisiert mit dem vorangehenden Wort und trägt die Personalendung.
  const particle = 'm' + realizeVowel('I', lastVowel(trLower(b.current))!, 'Q', b.steps);
  const ending =
    person === '3pl' ? '' : realize(TYPE1[person], tag, { base: particle, steps: b.steps });
  b.add('Q', particle + ending, true);
}

// Futur: ye-/de- heben den Stammvokal (yiyecek, diyecek).
const IRREGULAR_FUTURE: Record<string, string> = { de: 'di', ye: 'yi' };

// Einsilbige Konsonantenstämme mit Aorist -Ir statt -Ar.
const AORIST_IR = new Set([
  'al',
  'bil',
  'bul',
  'dur',
  'gel',
  'gör',
  'kal',
  'ol',
  'öl',
  'san',
  'ver',
  'var',
  'vur',
]);

const vowelCount = (s: string) => [...s].filter(isVowel).length;

/** Stammauslaut t → d vor vokalisch anlautendem Suffix (lexikalisch, git- → gid-). */
function softenedStem(verb: VerbStem, stem: string, tag: VerbTag, steps: Step[]): string {
  if (!verb.softens || isVowel(stem.at(-1)!)) return stem;
  const s = soften(stem);
  if (!s) return stem;
  steps.push({ tag, rule: 'softening', from: s.from, to: s.to });
  return s.form;
}

/** Personalendung Typ 2 am Verb, die Fragepartikel steht danach ohne Endung (geldin mi). */
function personType2AndQuestion(b: Builder, person: Person, question: boolean) {
  b.suffix(PERSON_TAG[person], TYPE2[person]);
  if (question) {
    const particle = 'm' + realizeVowel('I', lastVowel(trLower(b.current))!, 'Q', b.steps);
    b.add('Q', particle, true);
  }
}

export function conjugate(input: VerbStem | string, opts: ConjugateOptions): Inflection {
  const verb: VerbStem = typeof input === 'string' ? { form: input } : input;
  const stem = verbStem(verb.form);
  if (!lastVowel(stem)) throw new MorphError(`Verbstamm "${verb.form}" enthält keinen Vokal`);
  const b = new Builder();
  const question = opts.question ?? false;

  switch (opts.tense) {
    case 'present':
      present(b, verb, stem, opts.negative ?? false);
      personAndQuestion(b, opts.person, question);
      break;
    case 'past':
      b.add('STEM', stem);
      if (opts.negative) b.suffix('NEG', 'mA');
      b.suffix('PAST', 'DI');
      personType2AndQuestion(b, opts.person, question);
      break;
    case 'future':
      if (opts.negative) {
        b.add('STEM', stem);
        b.suffix('NEG', 'mA');
      } else if (IRREGULAR_FUTURE[stem]) {
        const raised = IRREGULAR_FUTURE[stem]!;
        b.steps.push({ tag: 'FUT', rule: 'stem_raising', from: stem.at(-1)!, to: raised.at(-1)! });
        b.add('STEM', raised);
      } else {
        b.add('STEM', softenedStem(verb, stem, 'FUT', b.steps));
      }
      b.suffix('FUT', '(y)AcAk');
      personAndQuestion(b, opts.person, question, { softenBefore: true });
      break;
    case 'aorist':
      aorist(b, verb, stem, opts.person, opts.negative ?? false, question);
      break;
  }
  return b.result();
}

function aorist(
  b: Builder,
  verb: VerbStem,
  stem: string,
  person: Person,
  negative: boolean,
  question: boolean,
) {
  if (negative) {
    b.add('STEM', stem);
    b.suffix('NEG', 'mA');
    // 1. Person ohne -z: gelmem, gelmeyiz (nicht in der Frage: gelmez miyim).
    if (!question && (person === '1sg' || person === '1pl')) {
      b.suffix(PERSON_TAG[person], person === '1sg' ? 'm' : '(y)Iz');
      return;
    }
    b.add('AOR', 'z');
    personAndQuestion(b, person, question);
    return;
  }

  if (isVowel(stem.at(-1)!)) {
    b.steps.push({ tag: 'AOR', rule: 'aorist_vowel', kind: 'vowel_stem', chose: 'r' });
    b.add('STEM', stem);
    b.add('AOR', 'r');
  } else {
    // Bei Verbverbindungen (ziyaret et-, alışveriş yap-) zählt nur das Verb selbst.
    const head = stem.split(' ').at(-1)!;
    const kind = verb.aorist
      ? 'lexical'
      : AORIST_IR.has(head)
        ? 'exception'
        : vowelCount(head) === 1
          ? 'monosyllabic'
          : 'polysyllabic';
    const archi = (verb.aorist ?? (kind === 'monosyllabic' ? 'ar' : 'ir')) === 'ar' ? 'A' : 'I';
    b.add('STEM', softenedStem(verb, stem, 'AOR', b.steps));
    const vowel = realizeVowel(archi, lastVowel(stem)!, 'AOR', b.steps);
    b.steps.push({ tag: 'AOR', rule: 'aorist_vowel', kind, chose: vowel });
    b.add('AOR', vowel + 'r');
  }
  personAndQuestion(b, person, question);
}

function present(b: Builder, verb: VerbStem, input: string, negative: boolean) {
  let stem = input;
  if (negative) {
    // -mA wird vor -yor zu -mI verengt: gel-mi-yor.
    b.add('STEM', stem);
    const chose = realizeVowel('I', lastVowel(stem)!, 'NEG', b.steps);
    b.steps.push({ tag: 'NEG', rule: 'narrowing', chose });
    b.add('NEG', 'm' + chose);
    b.add('PRES', 'yor');
  } else if (IRREGULAR_PRESENT[stem]) {
    const short = IRREGULAR_PRESENT[stem]!;
    b.steps.push({ tag: 'PRES', rule: 'stem_vowel_drop', vowel: stem.at(-1)! });
    b.add('STEM', short);
    b.add('PRES', 'iyor');
  } else {
    const last = stem.at(-1)!;
    let vowelForI: string;
    if (last === 'e' || last === 'a') {
      // Stammauslaut e/a fällt, I richtet sich nach dem neuen letzten Vokal: bekle- → bekl-iyor.
      stem = stem.slice(0, -1);
      b.steps.push({ tag: 'PRES', rule: 'stem_vowel_drop', vowel: last });
      vowelForI = lastVowel(stem)!;
    } else {
      vowelForI = lastVowel(stem)!;
      if (verb.softens && !isVowel(last)) {
        const s = soften(stem);
        if (s) {
          stem = s.form;
          b.steps.push({ tag: 'PRES', rule: 'softening', from: s.from, to: s.to });
        }
      }
    }
    b.add('STEM', stem);
    const linking = isVowel(stem.at(-1)!) ? '' : realizeVowel('I', vowelForI, 'PRES', b.steps);
    b.add('PRES', linking + 'yor');
  }
}

/** Nominalsatz mit Kopula: Almanım, öğrenciyiz, hasta mısın?, öğretmen değilim. */
export function predicate(input: Stem | string, opts: PredicateOptions): Inflection {
  const stem = asStem(input);
  const word = stemSpelling(stem);
  const b = new Builder();
  b.add('STEM', word);

  if (opts.negative) b.add('NEG_COP', 'değil', true);
  else if (stem.proper && (TYPE1[opts.person] || opts.dir) && !opts.question) {
    b.add('STEM', "'");
    b.segments.pop(); // Apostroph ist kein eigener Baustein
    b.steps.push({ tag: PERSON_TAG[opts.person], rule: 'apostrophe' });
  }

  if (opts.dir && opts.person === '3sg' && !opts.question) {
    b.suffix('DIR', 'DIr');
    return b.result();
  }
  personAndQuestion(b, opts.person, opts.question ?? false);
  return b.result();
}
