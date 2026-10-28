import { verbStem } from '../morphology';
import { allForms, formKind, type FormLabel } from './forms';
import { exactKey, searchKey } from './key';
import type { LookupIndex, SectionEntry, VocabEntry } from './types';

// Rangstufen, kleiner ist besser. Abschnitte bilden eine eigene Liste mit eigenen Stufen.
// Eine vollständige gebeugte Form (evi, ona, ister) steht vor bloßen Präfix- und Teilwort-Treffern
// (sevinmek, Glosse „Monat“), sonst verdrängt Rauschen gerade die kurzen, häufigen Wörter.
export const TIER = { exact: 0, form: 1, prefix: 2, wordPrefix: 3, infix: 4 } as const;
export type Tier = (typeof TIER)[keyof typeof TIER];

/** Teilwortsuche (mitten im Wort) erst ab dieser Länge, sonst trifft fast alles. */
const MIN_INFIX = 3;
/** Rückführung gebeugter Formen erst ab dieser Länge. */
const MIN_FORM = 3;
export const MAX_RESULTS = 50;

interface Key {
  fold: string;
  exact: string;
}

interface PreparedVocab {
  entry: VocabEntry;
  order: number;
  tr: Key;
  de: Key[];
  /** Mögliche Stämme (gefaltet), deren Präfix eine gebeugte Form haben muss. */
  stems: string[];
  /** Gefaltete Form → Schreibung und Lesarten; wird beim ersten Bedarf aus der Engine gebaut. */
  forms?: Map<string, FormMatch>;
}

interface PreparedSection {
  section: SectionEntry;
  order: number;
  title: string[];
  words: Set<string>;
}

export interface PreparedLookup {
  index: LookupIndex;
  vocab: PreparedVocab[];
  sections: PreparedSection[];
}

const key = (s: string): Key => ({ fold: searchKey(s), exact: exactKey(s) });

/** Deutsche Glosse: Klammerzusatz und führendes „sich“ sind optional (tschüss (sagt, wer geht)). */
function glossKeys(gloss: string): Key[] {
  const bare = gloss.replace(/\([^)]*\)/g, ' ').trim() || gloss;
  const variants = new Set([gloss, bare, bare.replace(/^sich\s+/i, '')]);
  return [...variants].map(key).filter((k) => k.fold);
}

/**
 * Stammanfänge, mit denen jede gebeugte Form beginnt: Erweichung ändert den letzten Laut
 * (kitap → kitab-), Vokalausfall die letzten zwei (oğul → oğl-), de-/ye- werden di-/yi-.
 * Verbstämme auf -a/-e verlieren den Vokal vor dem Präsens -Iyor (anla- → anlıyor, bekle- → bekliyor).
 */
function stemsOf(e: VocabEntry): string[] {
  const kind = formKind(e);
  if (!kind) return [];
  if (kind === 'pronoun') return [searchKey(e.tr).slice(0, 1)];
  const base = searchKey(kind === 'verb' ? verbStem(e.tr) : e.tr);
  const irregular = kind === 'verb' && /^[dy]e$/.test(base);
  const cut = e.drops_vowel ? 2 : e.softens || irregular ? 1 : 0;
  const stems = [base.slice(0, base.length - cut)];
  if (kind === 'verb' && /[ae]$/.test(base)) stems.push(base.slice(0, -1));
  return stems.filter(Boolean);
}

/** Alle Engine-Formen der Vokabel nach Suchschlüssel, einmal je Vokabel berechnet. */
function formsOf(v: PreparedVocab): Map<string, FormMatch> {
  if (!v.forms) {
    v.forms = new Map();
    for (const f of allForms(v.entry)) {
      const k = searchKey(f.form);
      const known = v.forms.get(k);
      if (known) known.labels.push(f.label);
      else v.forms.set(k, { form: f.form, labels: [f.label] });
    }
  }
  return v.forms;
}

/** Einmal nach dem Laden: Suchschlüssel aller Einträge (wenige Millisekunden). */
export function prepareLookup(index: LookupIndex): PreparedLookup {
  return {
    index,
    vocab: index.vocab.map((entry, order) => ({
      entry,
      order,
      tr: key(entry.tr),
      de: entry.de.flatMap(glossKeys),
      stems: stemsOf(entry),
    })),
    sections: index.sections.map((section, order) => ({
      section,
      order,
      title: searchKey(section.title).split(' '),
      words: new Set(section.words),
    })),
  };
}

/** Beste Stufe eines Schlüssels für die Anfrage, undefined ohne Treffer. */
function tierOf(k: string, q: string): Tier | undefined {
  if (k === q) return TIER.exact;
  if (k.startsWith(q)) return TIER.prefix;
  if (k.split(' ').some((w) => w.startsWith(q))) return TIER.wordPrefix;
  if (q.length >= MIN_INFIX && k.includes(q)) return TIER.infix;
  return undefined;
}

export interface VocabHit {
  entry: VocabEntry;
  tier: Tier;
  /** Treffer im Türkischen oder in einer deutschen Glosse. */
  lang: 'tr' | 'de';
  /** Bei gebeugter Form: welche Form und woraus (evi: Akkusativ oder Possessiv 3. Sg.). */
  form?: FormMatch;
  /** Genau so geschrieben (mit Sonderzeichen) wie getippt. */
  exact: boolean;
  /** Länge des getroffenen Schlüssels, kürzer zuerst. */
  length: number;
  order: number;
}

function matchVocab(v: PreparedVocab, q: string, qExact: string): VocabHit | undefined {
  let best: VocabHit | undefined;
  const offer = (k: Key, lang: 'tr' | 'de') => {
    const tier = tierOf(k.fold, q);
    if (tier === undefined) return;
    const hit: VocabHit = {
      entry: v.entry,
      tier,
      lang,
      exact: ` ${k.exact}`.includes(` ${qExact}`),
      length: k.fold.length,
      order: v.order,
    };
    if (!best || compareVocab(hit, best) < 0) best = hit;
  };
  offer(v.tr, 'tr');
  for (const k of v.de) offer(k, 'de');
  return best;
}

export interface FormMatch {
  form: string;
  labels: FormLabel[];
}

/** Gebeugte Formen, die zur Anfrage passen (evlerde → ev + PL + LOC), je Vokabel alle Lesarten. */
export function lemmatize(
  prepared: PreparedLookup,
  query: string,
): ({ entry: VocabEntry } & FormMatch)[] {
  const q = searchKey(query);
  if (q.length < MIN_FORM) return [];
  return prepared.vocab.flatMap((v) => {
    if (!v.stems.some((s) => q.startsWith(s)) || q === v.tr.fold) return [];
    const found = formsOf(v).get(q);
    return found ? [{ entry: v.entry, ...found }] : [];
  });
}

function compareVocab(a: VocabHit, b: VocabHit): number {
  return (
    a.tier - b.tier ||
    Number(b.exact) - Number(a.exact) ||
    (a.lang === b.lang ? 0 : a.lang === 'tr' ? -1 : 1) ||
    a.length - b.length ||
    a.order - b.order
  );
}

export interface SectionHit {
  section: SectionEntry;
  /** 0: alle Wörter im Titel, eines genau; 1: alle als Anfang im Titel; 2: im Text genau; 3: im Text als Anfang. */
  tier: number;
  order: number;
}

function matchSection(s: PreparedSection, tokens: string[]): SectionHit | undefined {
  const inTitle = (t: string) => s.title.some((w) => w.startsWith(t));
  const inText = (t: string) => s.words.has(t) || [...s.words].some((w) => w.startsWith(t));
  let tier: number | undefined;
  if (tokens.every(inTitle)) tier = tokens.some((t) => s.title.includes(t)) ? 0 : 1;
  else if (tokens.every((t) => s.words.has(t))) tier = 2;
  else if (tokens.every((t) => t.length >= 2 && inText(t))) tier = 3;
  return tier === undefined ? undefined : { section: s.section, tier, order: s.order };
}

export interface SearchResult {
  vocab: VocabHit[];
  sections: SectionHit[];
  /** Es gab mehr Treffer als `limit`; die Listen sind abgeschnitten. */
  more: boolean;
}

/** Sucht in beiden Richtungen (Türkisch, Deutsch) und in den Grammatik-Abschnitten. */
export function search(prepared: PreparedLookup, query: string, limit = MAX_RESULTS): SearchResult {
  const q = searchKey(query);
  if (!q) return { vocab: [], sections: [], more: false };
  const qExact = exactKey(query);
  const hits = new Map<string, VocabHit>();
  for (const v of prepared.vocab) {
    const hit = matchVocab(v, q, qExact);
    if (hit) hits.set(v.entry.id, hit);
  }
  for (const f of lemmatize(prepared, query)) {
    // Ein direkter Treffer ohne Formbezug (Teilwort, Präfix) weicht dem genaueren Formtreffer.
    if ((hits.get(f.entry.id)?.tier ?? Infinity) <= TIER.form) continue;
    const v = prepared.vocab.find((x) => x.entry.id === f.entry.id)!;
    hits.set(f.entry.id, {
      entry: f.entry,
      tier: TIER.form,
      lang: 'tr',
      form: { form: f.form, labels: f.labels },
      exact: exactKey(f.form) === qExact,
      length: q.length,
      order: v.order,
    });
  }
  const tokens = q.split(' ');
  const sections =
    q.length < 2 ? [] : prepared.sections.flatMap((s) => matchSection(s, tokens) ?? []);
  const vocab = [...hits.values()].sort(compareVocab);
  sections.sort((a, b) => a.tier - b.tier || a.order - b.order);
  return {
    vocab: vocab.slice(0, limit),
    sections: sections.slice(0, limit),
    more: vocab.length > limit || sections.length > limit,
  };
}
