import { inflect, MorphError, type Inflection } from './inflect';
import { lastVowel } from './phonology';
import { DERIVATIONS } from './suffixes';
import type { MorphTag, NonfiniteTag } from './tags';
import type { Step } from './template';
import {
  abilityStem,
  Builder,
  causativeStem,
  isDe,
  raisedStem,
  passiveStem,
  reciprocalStem,
  softenedStem,
  splitDerived,
  verbStem,
  type VerbStem,
} from './verb';

// Infinite Verbformen (Partizipien, Verbalnomen, Konverbien) in Archiphonem-Notation.
// Danach folgen nominale Endungen über `inflect` (okuduğ-um-u, gelen-ler-e, gelme-si-ni).
export const NONFINITE: Record<NonfiniteTag, string> = {
  PART_AN: '(y)An',
  PART_DIK: 'DIk',
  PART_ACAK: '(y)AcAk',
  VN_MA: 'mA',
  VN_MAK: 'mAk',
  VN_IS: '(y)Iş',
  CV_IP: '(y)Ip',
  CV_ARAK: '(y)ArAk',
  CV_INCA: '(y)IncA',
  CV_ALI: '(y)AlI',
  CV_MADAN: 'mAdAn',
};

export interface NonfiniteOptions {
  form: NonfiniteTag;
  negative?: boolean;
  /** „können“: gelebilen, verneint gelemeyen. */
  ability?: boolean;
  /** Passiv: yapılan, okunduğu. */
  passive?: boolean;
  /** Kausativ: yaptıran, okutulan. */
  causative?: boolean;
  /** Reziprok: görüşen, anlaşmak. */
  reciprocal?: boolean;
  /** Nominale Endungen danach (Plural, Possessiv, Kasus). */
  tags?: MorphTag[];
}

const POSS: ReadonlySet<MorphTag> = new Set([
  'POSS_1SG',
  'POSS_2SG',
  'POSS_3SG',
  'POSS_1PL',
  'POSS_2PL',
  'POSS_3PL',
]);
const CONVERBS: ReadonlySet<NonfiniteTag> = new Set([
  'CV_IP',
  'CV_ARAK',
  'CV_INCA',
  'CV_ALI',
  'CV_MADAN',
]);

// de- bleibt vor diesen Endungen bei e (deyip, deyince, deyiş), ye- wird immer zu yi- (yiyip).
const DE_KEEPS_E: ReadonlySet<NonfiniteTag> = new Set(['CV_IP', 'CV_INCA', 'VN_IS']);

/** Welche nominalen Endungen nach der Form stehen dürfen; sonst MorphError. */
function checkTags(opts: NonfiniteOptions): void {
  const tags = opts.tags ?? [];
  const fail = (why: string) => {
    throw new MorphError(`${opts.form} + ${tags.join(' + ') || '∅'}: ${why}`);
  };
  if (tags.some((t) => DERIVATIONS.has(t) || t === 'KI')) fail('keine Ableitung, kein -ki');
  if (opts.form === 'CV_MADAN' && opts.negative)
    fail('-mAdAn ist schon verneint (gelemeden: ability)');
  const hasPoss = tags.some((t) => POSS.has(t));
  if (CONVERBS.has(opts.form)) {
    if (tags.length) fail('Konverbien nehmen keine Endungen');
    return;
  }
  switch (opts.form) {
    case 'PART_AN':
      if (hasPoss) fail('kein Possessiv am -(y)An-Partizip');
      return;
    case 'PART_DIK':
      // okuduğum, okuduklarım; ohne Possessiv nur geldikten (sonra)
      if (!hasPoss && !(tags.length === 1 && tags[0] === 'ABL')) fail('braucht ein Possessiv');
      return;
    case 'PART_ACAK':
      if (tags.length && !hasPoss) fail('Endungen nur mit Possessiv');
      return;
    case 'VN_MAK':
      if (tags.length > 1 || (tags[0] && !['LOC', 'ABL', 'INS'].includes(tags[0]))) {
        fail('-mAk nur mit -DA, -DAn, -(y)lA');
      }
      return;
    default:
      return;
  }
}

/**
 * Infinite Form eines Verbs: Stamm (Erweichung git → gid und Hebung ye → yi vor y + Vokal),
 * Verneinung, infinites Suffix, dann nominale Endungen; k-Auslaut von -DIk/-(y)AcAk wird vor
 * Vokal zu ğ (okuduğum, geleceğini).
 */
export function nonfinite(input: VerbStem | string, opts: NonfiniteOptions): Inflection {
  const verb: VerbStem = typeof input === 'string' ? { form: input } : input;
  const stem = verbStem(verb.form);
  if (!lastVowel(stem)) throw new MorphError(`Verbstamm "${verb.form}" enthält keinen Vokal`);
  checkTags(opts);
  if (opts.causative || opts.reciprocal) return voice(verb, stem, opts);
  if (opts.passive || opts.ability) return derived(verb, stem, opts);

  const b = new Builder();
  const template = NONFINITE[opts.form];
  const buffered = template.startsWith('(y)');
  if (opts.negative) {
    b.add('STEM', stem);
    b.suffix('NEG', 'mA');
  } else if (buffered && raisedStem(stem) && !(isDe(stem) && DE_KEEPS_E.has(opts.form))) {
    const raised = raisedStem(stem)!;
    b.steps.push({ tag: opts.form, rule: 'stem_raising', from: stem.at(-1)!, to: raised.at(-1)! });
    b.add('STEM', raised);
  } else {
    if (buffered && isDe(stem)) b.steps.push({ tag: opts.form, rule: 'no_raising' });
    b.add('STEM', buffered ? softenedStem(verb, stem, opts.form, b.steps) : stem);
  }
  b.suffix(opts.form, template);
  const verbal = b.result();
  const tags = opts.tags ?? [];
  if (!tags.length) return verbal;

  const softens = opts.form === 'PART_DIK' || opts.form === 'PART_ACAK';
  const noun = inflect({ form: verbal.form, softens }, tags);
  // Der Stamm der Nomenform ist der Verbteil, ggf. mit erweichtem Auslaut (okuduk → okuduğ).
  const head = noun.segments[0]!.text;
  const segments = verbal.segments.map((s) => ({ ...s }));
  const last = segments.at(-1)!;
  const before = segments
    .slice(0, -1)
    .map((s) => s.text)
    .join('');
  last.text = head.slice(before.length);
  return {
    form: noun.form,
    segments: [...segments, ...noun.segments.slice(1)],
    steps: [...verbal.steps, ...noun.steps],
  };
}

/** Kausativ- bzw. Reziprokstamm (yaptır-, görüş-) wie ein eigenes Verb. */
function voice(verb: VerbStem, stem: string, opts: NonfiniteOptions): Inflection {
  if (opts.causative && opts.reciprocal) {
    throw new MorphError('Kausativ und Reziprok nur über eine eigene Vokabel');
  }
  const steps: Step[] = [];
  const tag = opts.causative ? 'CAUS' : 'RECIP';
  const { base, tail } = (opts.causative ? causativeStem : reciprocalStem)(verb, stem, steps);
  const inner = nonfinite(
    { form: `${base}${tail}mek` },
    { ...opts, causative: false, reciprocal: false },
  );
  return splitDerived(inner, base, tail, tag, steps, 'derived');
}

/** Passiv- bzw. „können“-Stamm (yapıl-, gelebil-, verneint gele-) wie ein eigenes Verb. */
function derived(verb: VerbStem, stem: string, opts: NonfiniteOptions): Inflection {
  const steps: Step[] = [];
  if (opts.passive) {
    const { base, tail } = passiveStem(verb, stem, steps);
    const inner = nonfinite({ form: `${base}${tail}mek` }, { ...opts, passive: false });
    return splitDerived(inner, base, tail, 'PASS', steps, 'passive');
  }
  // „ohne … zu können“: gel-e-meden; die Verneinung steckt schon in -mAdAn.
  const madan = opts.form === 'CV_MADAN';
  const { base, tail } = abilityStem(verb, stem, madan || (opts.negative ?? false), steps);
  const inner = nonfinite({ form: `${base}${tail}mek` }, { ...opts, ability: false });
  return splitDerived(inner, base, tail, 'ABIL', steps, 'ability');
}
