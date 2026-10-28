import { exactKey } from '../lookup/key';
import { lemmatize, type PreparedLookup } from '../lookup/search';
import type { VocabEntry } from '../lookup/types';
import type { Passage, PassageToken, Unit } from './schema';

// Lesetexte (Lektionstyp `reading` mit `passage`): Der Build zerlegt jeden Satz in Wörter und
// Lücken und löst jedes Wort auf (Vokabel, gebeugte Form über die Engine, Glossar des Textes),
// damit die App offline ohne Engine-Lauf antippen kann. Unaufgelöste Wörter sind eine Warnung.

/** Wort mit Buchstaben/Ziffern, Apostroph-Suffixe gehören dazu (Ayşe'yle, 3'te). */
const WORD = /[\p{L}\p{N}]+(?:['’][\p{L}\p{N}]+)*/gu;

/** Satz → Wörter und Lücken in Textreihenfolge; zusammen ergeben sie den Satz. */
export function tokenize(sentence: string): { text: string; word: boolean }[] {
  const out: { text: string; word: boolean }[] = [];
  let last = 0;
  for (const m of sentence.matchAll(WORD)) {
    if (m.index > last) out.push({ text: sentence.slice(last, m.index), word: false });
    out.push({ text: m[0], word: true });
    last = m.index + m[0].length;
  }
  if (last < sentence.length) out.push({ text: sentence.slice(last), word: false });
  return out;
}

/** Längste Mehrwort-Vokabel (hafta sonu, yatak odası), die hier beginnen kann. */
const MAX_PHRASE = 3;

export interface Resolution {
  vocab?: string;
  gloss?: string;
}

export interface ReadingResolver {
  /** Auflösung eines Wortes oder einer Wortgruppe; undefined = unbekannt. */
  resolve(text: string): Resolution | undefined;
  /** Mehrwort-Vokabeln nach Schlüssel (für den Abgleich über Leerzeichen hinweg). */
  phrases: ReadonlySet<string>;
}

/**
 * Löst Wörter für einen Text der Unit `unitId` auf. Bei mehreren Lesarten gewinnt eine Vokabel
 * dieser Unit, sonst die aus der nächstfrüheren Unit (altında in A2-09: alt aus A2-08, nicht
 * altı aus A1-05), sonst die erste im Kurs. Abgleich mit
 * Sonderzeichen (`exactKey`): gefaltet wären olur (ol-) und ölür (öl-) dasselbe.
 */
export function readingResolver(
  prepared: PreparedLookup,
  unitId: string,
  glossary: Passage['glossary'] = [],
): ReadingResolver {
  const order = new Map(prepared.index.units.map((u, i) => [u.id, i]));
  const here = order.get(unitId) ?? Number.MAX_SAFE_INTEGER;
  const rank = (e: VocabEntry) => {
    const at = order.get(e.unit) ?? Number.MAX_SAFE_INTEGER;
    return at === here ? -1 : at < here ? here - at : here + at;
  };
  const best = (entries: VocabEntry[]) =>
    entries.length ? entries.reduce((a, b) => (rank(b) < rank(a) ? b : a)) : undefined;

  const base = new Map<string, VocabEntry[]>();
  for (const { entry } of prepared.vocab) {
    const k = exactKey(entry.tr);
    base.set(k, [...(base.get(k) ?? []), entry]);
  }
  const glossed = new Map(glossary.map((g) => [exactKey(g.tr), g]));

  const lookup = (text: string): Resolution | undefined => {
    const k = exactKey(text);
    const g = glossed.get(k);
    if (g) return { gloss: g.de, vocab: g.vocab };
    const plain = best(base.get(k) ?? []);
    if (plain) return { vocab: plain.id };
    const inflected = best(
      lemmatize(prepared, text)
        .filter((m) => exactKey(m.form) === k)
        .map((m) => m.entry),
    );
    return inflected ? { vocab: inflected.id } : undefined;
  };

  return {
    phrases: new Set([...base.keys()].filter((k) => k.includes(' '))),
    resolve: (text) => {
      if (/^\p{N}+$/u.test(text)) return {};
      const found = lookup(text);
      if (found) return found;
      // Eigenname mit Suffix: der Teil vor dem Apostroph (Ayşe'yle → Ayşe).
      const stem = /^(.+?)['’]/u.exec(text)?.[1];
      return stem ? lookup(stem) : undefined;
    },
  };
}

/** Zerlegt und löst die Sätze auf; `unknown` = Wörter ohne Auflösung (Build-Warnung). */
export function annotatePassage(
  passage: Passage,
  resolver: ReadingResolver,
): { passage: Passage; unknown: string[] } {
  const unknown: string[] = [];
  const tokens = passage.sentences.map((s) => {
    const parts = tokenize(s.tr);
    const out: PassageToken[] = [];
    for (let i = 0; i < parts.length; i++) {
      const part = parts[i]!;
      if (!part.word) {
        out.push({ text: part.text });
        continue;
      }
      // Mehrwort-Vokabel: Wörter, nur durch ein Leerzeichen getrennt.
      let phrase: { text: string; end: number } | undefined;
      for (let n = MAX_PHRASE; n >= 2 && !phrase; n--) {
        const end = i + 2 * (n - 1);
        const slice = parts.slice(i, end + 1);
        if (slice.length !== 2 * n - 1 || slice.some((p, j) => p.word !== (j % 2 === 0))) continue;
        if (slice.some((p) => !p.word && p.text !== ' ')) continue;
        const text = slice.map((p) => p.text).join('');
        if (resolver.phrases.has(exactKey(text))) phrase = { text, end };
      }
      const text = phrase?.text ?? part.text;
      const r = resolver.resolve(text);
      if (!r) unknown.push(text);
      out.push({ text, w: true, ...r });
      if (phrase) i = phrase.end;
    }
    return out;
  });
  return { passage: { ...passage, tokens }, unknown };
}

/** Alle Lesetexte der Unit aufgelöst; Warnungen mit Fundstelle. */
export function withPassages(
  unit: Unit,
  prepared: PreparedLookup,
): { unit: Unit; warnings: string[] } {
  const warnings: string[] = [];
  const lessons = unit.lessons.map((lesson) => {
    if (!lesson.passage) return lesson;
    const resolver = readingResolver(prepared, unit.id, lesson.passage.glossary);
    const { passage, unknown } = annotatePassage(lesson.passage, resolver);
    for (const w of new Set(unknown)) {
      warnings.push(
        `${lesson.id}: Wort im Lesetext unbekannt (Vokabel, Engine-Form oder glossary): ${w}`,
      );
    }
    return { ...lesson, passage };
  });
  return { unit: { ...unit, lessons }, warnings };
}

/** Glossar-Verweise müssen auf eine Vokabel des Kurses zeigen. */
export function checkGlossary(unit: Unit, vocabIds: ReadonlySet<string>): string[] {
  return unit.lessons.flatMap((l) =>
    (l.passage?.glossary ?? [])
      .filter((g) => g.vocab && !vocabIds.has(g.vocab))
      .map((g) => `${l.id}: glossary ${g.tr} verweist auf unbekannte Vokabel ${g.vocab}`),
  );
}
