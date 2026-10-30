export {
  asStem,
  inflect,
  KNOWN_LIMITS,
  MorphError,
  stemSpelling,
  type Inflection,
  type Stem,
  type Step,
} from './inflect';
export {
  PRONOUN_CASES,
  PRONOUN_LEMMAS,
  pronoun,
  type PronounCase,
  type PronounLemma,
} from './pronouns';
export { NONFINITE, nonfinite, type NonfiniteOptions } from './nonfinite';
export {
  MORPH_TAGS,
  NONFINITE_TAGS,
  VERB_TAGS,
  type AnyTag,
  type MorphTag,
  type NonfiniteTag,
  type VerbTag,
} from './tags';
export {
  conjugate,
  conjugateVariants,
  CAUSATIVES,
  COMPOUND_TENSES,
  COMPOUNDS,
  COPULA_TENSES,
  DIR_TENSES,
  IMPERATIVE_PERSONS,
  OPTATIVE_PERSONS,
  PERSONS,
  predicate,
  TENSES,
  verbStem,
  type Causative,
  type Compound,
  type ConjugateOptions,
  type Tense,
  type Person,
  type PredicateOptions,
  type VerbStem,
} from './verb';
