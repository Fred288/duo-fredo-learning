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

export const TENSES = [
  'present',
  'past',
  'future',
  'aorist',
  'evidential',
  'necessitative',
  'imperative',
  'conditional',
  'optative',
] as const;
export type Tense = (typeof TENSES)[number];

/** Kopula an einer Zeitform: idi (geliyordum), imiş (geliyormuş), ise (geliyorsa). */
export const COMPOUNDS = ['past', 'evidential', 'conditional'] as const;
export type Compound = (typeof COMPOUNDS)[number];

/** Zeiten, an die die Kopula treten kann (gelseydi ja, geldiydi nein). */
export const COMPOUND_TENSES: Record<Compound, readonly Tense[]> = {
  past: ['present', 'future', 'aorist', 'evidential', 'necessitative', 'conditional'],
  evidential: ['present', 'future', 'aorist', 'evidential', 'necessitative'],
  conditional: ['present', 'future', 'aorist', 'evidential', 'necessitative', 'past'],
};

// Kopula-Baustein; die Endung danach ist bei idi und ise Typ 2, bei imiş Typ 1.
const COMPOUND_SUFFIX: Record<Compound, { tag: VerbTag; template: string }> = {
  past: { tag: 'PAST', template: '(y)DI' },
  evidential: { tag: 'EVID', template: '(y)mIş' },
  conditional: { tag: 'COND', template: '(y)sA' },
};

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
  /** „können“ -(y)Abil, verneint -(y)AmA (gelebilir, gelemez). */
  ability?: boolean;
  /** Imperativ 2. Pl. höflich -(y)InIz (geliniz). */
  polite?: boolean;
  /** Passiv: -Il nach Konsonant, -In nach l, -n nach Vokal (yapıl-, bilin-, okun-). */
  passive?: boolean;
  /** Kopula idi/imiş/ise nach der Zeit (geliyordum, gelirmiş, gelecekse). */
  compound?: Compound;
}

export const COPULA_TENSES = ['present', 'past', 'evidential', 'conditional'] as const;

export interface PredicateOptions {
  person: Person;
  /** Vergangenheit -(y)DI (öğretmendim), -(y)mIş (öğretmenmiş), Bedingung -(y)sA (öğretmensem). */
  tense?: (typeof COPULA_TENSES)[number];
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

  /** Weiterbauen an einer fertigen Form (Kopula nach der Zeit). */
  static from(inf: Inflection): Builder {
    const b = new Builder();
    b.segments = inf.segments.map((s) => ({ ...s }));
    b.steps = [...inf.steps];
    b.words = [inf.form];
    return b;
  }
  get current(): string {
    return this.words.at(-1)!;
  }
  /** Fragepartikel mI als eigenes Wort, harmonisiert mit dem vorangehenden. */
  particle() {
    this.add(
      'Q',
      'm' + realizeVowel('I', lastVowel(trLower(this.current))!, 'Q', this.steps),
      true,
    );
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
  /**
   * Letzten Konsonanten des letzten Bausteins erweichen (-acak → -acağ vor Vokal).
   * Beim Stamm (çocuğum) nennt die Begründung die auslösende Endung.
   */
  softenLast(cause: AnyTag) {
    const seg = this.segments.at(-1)!;
    const s = soften(seg.text);
    if (!s) return;
    const tag = seg.tag === 'STEM' ? cause : (seg.tag as AnyTag);
    this.steps.push({ tag, rule: 'softening', from: s.from, to: s.to });
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
    if (softenBefore && isVowel(ending[0] ?? '')) b.softenLast(tag);
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
  if (question) b.particle();
}

export const OPTATIVE_PERSONS: readonly Person[] = ['1sg', '1pl'];

export const IMPERATIVE_PERSONS: readonly Person[] = ['2sg', '3sg', '2pl', '3pl'];

export function conjugate(input: VerbStem | string, opts: ConjugateOptions): Inflection {
  const verb: VerbStem = typeof input === 'string' ? { form: input } : input;
  const stem = verbStem(verb.form);
  if (!lastVowel(stem)) throw new MorphError(`Verbstamm "${verb.form}" enthält keinen Vokal`);
  if (opts.compound) return withCompound(verb, opts);
  if (opts.passive) return withPassive(verb, stem, opts);
  if (opts.ability) return withAbility(verb, stem, opts);
  if (opts.tense === 'imperative') return imperative(verb, stem, opts);
  if (opts.tense === 'optative') return optative(verb, stem, opts);
  const b = new Builder();
  const question = opts.question ?? false;

  switch (opts.tense) {
    case 'evidential':
    case 'necessitative':
      b.add('STEM', stem);
      if (opts.negative) b.suffix('NEG', 'mA');
      if (opts.tense === 'evidential') b.suffix('EVID', 'mIş');
      else b.suffix('NEC', 'mAlI');
      personAndQuestion(b, opts.person, question);
      break;
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
    case 'conditional':
      b.add('STEM', stem);
      if (opts.negative) b.suffix('NEG', 'mA');
      b.suffix('COND', 'sA');
      personType2AndQuestion(b, opts.person, question);
      break;
  }
  return b.result();
}

/**
 * Zeitform + Kopula: Die Zeit wird in der 3. Person gebildet (geliyor, gelmez, gelse), die
 * 3. Person Plural setzt -lAr davor (geliyorlardı), dann folgen Frage, Kopula und Endung.
 */
function withCompound(verb: VerbStem, opts: ConjugateOptions, latePlural = false): Inflection {
  const compound = opts.compound!;
  if (!COMPOUND_TENSES[compound].includes(opts.tense)) {
    throw new MorphError(`Keine Kopula ${compound} nach ${opts.tense}`);
  }
  if (opts.question && compound === 'conditional') throw new MorphError('Keine Frage mit ise');
  if (opts.polite) throw new MorphError('polite nur im Imperativ');
  const base = conjugate(verb, { ...opts, compound: undefined, person: '3sg', question: false });
  const b = Builder.from(base);
  const tag = PERSON_TAG[opts.person];
  if (opts.person === '3pl' && !latePlural) b.suffix(tag, TYPE1['3pl']);
  if (opts.question) b.particle();
  const cop = COMPOUND_SUFFIX[compound];
  b.suffix(cop.tag, cop.template);
  if (opts.person !== '3pl' || latePlural) {
    b.suffix(tag, (compound === 'evidential' ? TYPE1 : TYPE2)[opts.person]);
  }
  return b.result();
}

/**
 * Ebenso richtige Nebenformen: In der 3. Person Plural kann -lAr auch nach der Kopula stehen
 * (geliyordular, gelseydiler, geldiyseler, geliyormuşlar, geliyor muydular).
 */
export function conjugateVariants(input: VerbStem | string, opts: ConjugateOptions): string[] {
  if (!opts.compound || opts.person !== '3pl') return [];
  const verb: VerbStem = typeof input === 'string' ? { form: input } : input;
  return [withCompound(verb, opts, true).form];
}

/** Optativ (Wunsch, Vorschlag): geleyim, gelelim; verneint gelmeyeyim; ye → yiyeyim. */
function optative(verb: VerbStem, stem: string, opts: ConjugateOptions): Inflection {
  if (!OPTATIVE_PERSONS.includes(opts.person)) {
    throw new MorphError(`Optativ gibt es hier nur für 1sg und 1pl, nicht ${opts.person}`);
  }
  if (opts.polite) throw new MorphError('polite nur im Imperativ');
  const b = new Builder();
  if (opts.negative) {
    b.add('STEM', stem);
    b.suffix('NEG', 'mA');
  } else if (IRREGULAR_FUTURE[stem]) {
    const raised = IRREGULAR_FUTURE[stem]!;
    b.steps.push({ tag: 'OPT', rule: 'stem_raising', from: stem.at(-1)!, to: raised.at(-1)! });
    b.add('STEM', raised);
  } else {
    b.add('STEM', softenedStem(verb, stem, 'OPT', b.steps));
  }
  b.suffix('OPT', '(y)A');
  b.suffix(PERSON_TAG[opts.person], opts.person === '1sg' ? 'yIm' : 'lIm');
  if (opts.question) b.particle();
  return b.result();
}

/**
 * „können“: Stamm + (y)Abil, verneint Stamm + (y)A + Verneinung. Die Zeit wird auf dem
 * erweiterten Stamm gebildet (gelebil-ir, gele-mez); bil nimmt im Aorist -ir.
 */
function withAbility(verb: VerbStem, stem: string, opts: ConjugateOptions): Inflection {
  if (opts.tense === 'imperative') throw new MorphError('„können“ gibt es nicht im Imperativ');
  const steps: Step[] = [];
  let base: string;
  if (IRREGULAR_FUTURE[stem]) {
    base = IRREGULAR_FUTURE[stem]!;
    steps.push({ tag: 'ABIL', rule: 'stem_raising', from: stem.at(-1)!, to: base.at(-1)! });
  } else {
    base = softenedStem(verb, stem, 'ABIL', steps);
  }
  const tail = realize(opts.negative ? '(y)A' : '(y)Abil', 'ABIL', { base, steps });
  const inner = conjugate(
    { form: `${base}${tail}mek`, aorist: opts.negative ? undefined : 'ir' },
    { ...opts, ability: false },
  );
  const [first, ...rest] = inner.segments;
  if (first?.text !== base + tail) throw new MorphError(`Unerwarteter Stamm "${first?.text}"`);
  return {
    form: inner.form,
    segments: [{ tag: 'STEM', text: base }, { tag: 'ABIL', text: tail }, ...rest],
    steps: [
      ...steps,
      ...inner.steps.map((s) =>
        s.rule === 'aorist_vowel' && s.kind === 'lexical' ? { ...s, kind: 'ability' as const } : s,
      ),
    ],
  };
}

/**
 * Passiv: Der Passivstamm (yapıl-, okun-, bilin-) wird wie ein eigenes Verb konjugiert.
 * Passivstämme nehmen im Aorist immer -Ir (yapılır, yenir).
 */
function withPassive(verb: VerbStem, stem: string, opts: ConjugateOptions): Inflection {
  const steps: Step[] = [];
  let base = stem;
  let template: string;
  if (isVowel(stem.at(-1)!)) template = 'n';
  else {
    template = stem.at(-1) === 'l' ? 'In' : 'Il';
    base = softenedStem(verb, stem, 'PASS', steps);
  }
  const tail = realize(template, 'PASS', { base, steps });
  const inner = conjugate({ form: `${base}${tail}mek`, aorist: 'ir' }, { ...opts, passive: false });
  const [first, ...rest] = inner.segments;
  // Mit „können“ ist das erste Segment bereits gesplittet (yapıl + abil).
  const firstText = first?.text ?? '';
  if (!firstText.startsWith(base + tail)) throw new MorphError(`Unerwarteter Stamm "${firstText}"`);
  const own = firstText.slice((base + tail).length);
  return {
    form: inner.form,
    segments: [
      { tag: 'STEM', text: base },
      { tag: 'PASS', text: tail },
      ...(own ? [{ tag: first!.tag, text: own }] : []),
      ...rest,
    ],
    steps: [
      ...steps,
      ...inner.steps.map((s) =>
        s.rule === 'aorist_vowel' && s.kind === 'lexical' ? { ...s, kind: 'passive' as const } : s,
      ),
    ],
  };
}

/** Imperativ: gel, gelsin, gelin (höflich geliniz), gelsinler; verneint gelme, gelmeyin. */
function imperative(verb: VerbStem, stem: string, opts: ConjugateOptions): Inflection {
  if (!IMPERATIVE_PERSONS.includes(opts.person)) {
    throw new MorphError(`Imperativ gibt es nicht für ${opts.person}`);
  }
  const b = new Builder();
  if (opts.negative) {
    b.add('STEM', stem);
    b.suffix('NEG', 'mA');
  } else if (opts.person === '2pl' && stem === 'ye') {
    // ye → yiyin; de bleibt (deyin)
    b.steps.push({ tag: 'IMP', rule: 'stem_raising', from: 'e', to: 'i' });
    b.add('STEM', 'yi');
  } else if (opts.person === '2pl') {
    b.add('STEM', softenedStem(verb, stem, 'IMP', b.steps));
  } else {
    b.add('STEM', stem);
  }
  const template = {
    '2sg': '',
    '3sg': 'sIn',
    '2pl': opts.polite ? '(y)InIz' : '(y)In',
    '3pl': 'sInlAr',
  }[opts.person as '2sg' | '3sg' | '2pl' | '3pl'];
  b.suffix('IMP', template);
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
  if (opts.tense && opts.tense !== 'present') return copulaPast(b, stem, opts);

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
  // Erweichende Nomen erweichen vor -(y)Im/-(y)Iz: çocuğum, gencim (aber çocuksun, çocuktum).
  personAndQuestion(b, opts.person, opts.question ?? false, {
    softenBefore: !!stem.softens && !stem.proper && !opts.negative,
  });
  return b.result();
}

/**
 * „war“: -(y)DI + Typ 2 (öğrenciydim), „sei angeblich“: -(y)mIş + Typ 1 (öğretmenmiş),
 * „wenn … ist“: -(y)sA + Typ 2 (öğrenciysem).
 */
function copulaPast(b: Builder, stem: Stem, opts: PredicateOptions): Inflection {
  const compound = opts.tense as Compound;
  if (opts.question && compound === 'conditional') throw new MorphError('Keine Frage mit ise');
  const cop = COMPOUND_SUFFIX[compound];
  if (opts.negative) b.add('NEG_COP', 'değil', true);
  else if (stem.proper && !opts.question) {
    b.add('STEM', "'");
    b.segments.pop();
    b.steps.push({ tag: cop.tag, rule: 'apostrophe' });
  }
  if (opts.question) b.particle();
  b.suffix(cop.tag, cop.template);
  b.suffix(PERSON_TAG[opts.person], (compound === 'evidential' ? TYPE1 : TYPE2)[opts.person]);
  return b.result();
}
