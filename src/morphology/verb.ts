import { trLower } from '../lib/turkish';
import { asStem, MorphError, stemSpelling, type Inflection, type Stem } from './inflect';
import { isVowel, lastVowel, normalize, soften } from './phonology';
import type { VerbTag } from './tags';
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

export interface VerbStem {
  /** Infinitiv (gelmek) oder Stamm (gel). */
  form: string;
  /** Stammauslaut t → d vor Vokal (gitmek → gidiyor). */
  softens?: boolean;
}

export interface ConjugateOptions {
  tense: 'present';
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
  result(): Inflection {
    return { form: this.words.join(' '), segments: this.segments, steps: this.steps };
  }
}

/** Personalendung Typ 1, bei Fragen an der Partikel mI (außer 3. Pl.). */
function personAndQuestion(b: Builder, person: Person, question: boolean) {
  const tag = PERSON_TAG[person];
  if (!question) {
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

export function conjugate(input: VerbStem | string, opts: ConjugateOptions): Inflection {
  const verb = typeof input === 'string' ? { form: input } : input;
  let stem = verbStem(verb.form);
  if (!lastVowel(stem)) throw new MorphError(`Verbstamm "${verb.form}" enthält keinen Vokal`);
  const b = new Builder();

  if (opts.negative) {
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

  personAndQuestion(b, opts.person, opts.question ?? false);
  return b.result();
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
