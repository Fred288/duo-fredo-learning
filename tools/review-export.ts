/**
 * Review-Liste für Muttersprachler: schreibt alle ungeprüften Inhalte (`reviewed: false`, wie
 * `countUnreviewed`) plus die Erklärkarten als JSON. Die Review-Seite (Artifact) liest die Datei;
 * Rückmeldungen liegen dort und werden von Hand bzw. von Claude in die YAML übernommen.
 *
 *   npx tsx tools/review-export.ts <ausgabe.json>
 *
 * Schlüssel je Eintrag sind stabil: Übungs-ID, `vocab:<id>`, `passage:<lektion>`, Text-ID,
 * `explainer`. Erzeugte Übungen (Hören, Zerlegen, Satzbau mit `from`) fehlen: Sie bestehen aus
 * Material, das schon in der Liste steht.
 */
import { readdirSync, readFileSync, writeFileSync } from 'node:fs';
import { join, relative } from 'node:path';
import { vocabId, type Exercise, type Passage, type Unit } from '../src/content/schema';
import { isUnitFile, parseUnitFile } from './content-checks';

/** Zweifelsfälle aus den Gegenprüfungen, die ausdrücklich ein Mensch entscheiden soll. */
const FLAGS: { match: string; note: string }[] = [
  {
    match: 'doktorda randevum',
    note: '„doktorda randevum var“ oder eher „doktordan randevum var“ / „doktor randevum var“?',
  },
  {
    match: 'hasta değilmiş',
    note: 'Nach einem Sturz: passt „hasta değilmiş“ (krank) oder eher „ağır yaralı değilmiş“?',
  },
  {
    match: 'Yarın doktora gitmeliyim',
    note: 'Bei Zahnschmerzen: „doktora“ oder natürlicher „dişçiye“?',
  },
  {
    match: 'tarihinin geçtiğini',
    note: '„belgenin tarihinin geçtiğini“ für „abgelaufen“ idiomatisch, oder „süresinin dolduğunu“?',
  },
  {
    match: 'Saçım uzun olunca',
    note: 'Zeitbezug „-ınca“ mit Zukunft im Hauptsatz natürlich?',
  },
];

export interface ReviewItem {
  /** Stabiler Schlüssel (siehe oben). */
  k: string;
  /** Art: vocab, mc, word_bank, free_text, form, table, passage, text, explainer, other. */
  t: string;
  /** Lektionstitel bzw. Texttitel. */
  l?: string;
  /** Prompt oder Grundform. */
  q?: string;
  /** Richtung bei free_text. */
  d?: 'de_tr' | 'tr_de';
  /** Lösungen (erste = Hauptlösung). */
  a?: string[];
  /** Optionen (Multiple Choice) bzw. Ablenker (Wortbank). */
  o?: string[];
  /** Hinweis/Erklärung (deutsch, oft mit türkischen Beispielen). */
  x?: string;
  /** Sätze tr/de. */
  s?: [string, string][];
  /** Glossar tr/de. */
  g?: [string, string][];
  /** Markdown (Erklärkarte). */
  m?: string;
  /** Von der Engine nachgerechnet (Form stimmt mechanisch, Wortwahl nicht geprüft). */
  e?: true;
  /** Zweifelsfall mit Frage an den Prüfer. */
  f?: string;
}

export interface ReviewUnit {
  id: string;
  level: string;
  title: string;
  file: string;
  items: ReviewItem[];
}

const PERSON: Record<string, string> = {
  '1sg': 'ich',
  '2sg': 'du',
  '3sg': 'er/sie/es',
  '1pl': 'wir',
  '2pl': 'ihr/Sie',
  '3pl': 'sie',
};

function extra(ex: Exercise): string | undefined {
  const parts = [ex.gloss_de && `Bedeutung: ${ex.gloss_de}`, ex.hint, ex.explanation].filter(
    Boolean,
  );
  return parts.length ? parts.join('\n') : undefined;
}

function exerciseItem(ex: Exercise, lesson: string): ReviewItem | undefined {
  const base = { k: ex.id, l: lesson, x: extra(ex) };
  switch (ex.type) {
    case 'multiple_choice':
      return { ...base, t: 'mc', q: ex.prompt, a: [ex.answer], o: ex.options };
    case 'word_bank':
      return { ...base, t: 'word_bank', q: ex.prompt, a: ex.answers, o: ex.distractors };
    case 'free_text':
      return { ...base, t: 'free_text', q: ex.prompt, d: ex.direction, a: ex.answers };
    case 'suffix_builder': {
      const how = [
        ex.verbal,
        ex.negative && 'NEG',
        ex.ability && 'ABIL',
        ex.passive && 'PASS',
        ex.causative && 'CAUS',
        ex.reciprocal && 'RECIP',
        ...ex.suffixes,
      ].filter(Boolean);
      return {
        ...base,
        t: 'form',
        q: `${ex.stem} + ${how.join(' + ')}`,
        a: [ex.target, ...(ex.alt_targets ?? [])],
        e: true,
      };
    }
    case 'conjugation': {
      const how = [
        PERSON[ex.person] ?? ex.person,
        ex.tense,
        ex.compound && `+ ${ex.compound}`,
        ex.negative && 'verneint',
        ex.question && 'Frage',
        ex.ability && 'können',
        ex.passive && 'Passiv',
        ex.causative && 'Kausativ',
        ex.reciprocal && 'Reziprok',
        ex.polite && 'höflich',
        ex.dir && '-dir',
      ].filter(Boolean);
      return {
        ...base,
        t: 'form',
        q: `${ex.lemma} (${how.join(', ')})`,
        a: [ex.target, ...(ex.alt_targets ?? [])],
        e: true,
      };
    }
    case 'paradigm':
      return { ...base, t: 'table', q: `${ex.lemma} (${ex.kind}${ex.tense ? `, ${ex.tense}` : ''})`, e: true };
    case 'listen':
      if (ex.from) return undefined;
      return { ...base, t: 'other', q: ex.text, a: ex.answer ? [ex.answer] : undefined, o: ex.options };
    case 'segment':
      if (ex.from) return undefined;
      return { ...base, t: 'other', q: ex.word, e: true };
    case 'sov_puzzle':
      if (ex.from) return undefined;
      return { ...base, t: 'other', q: ex.prompt, a: [ex.text] };
  }
}

const sentences = (p: Passage) => p.sentences.map((s) => [s.tr, s.de] as [string, string]);
const glossary = (p: Passage) =>
  p.glossary?.length ? p.glossary.map((g) => [g.tr, g.de] as [string, string]) : undefined;

export function reviewUnit(unit: Unit, file: string, explainer?: string): ReviewUnit {
  const open = (r?: boolean) => !(r ?? unit.reviewed);
  const items: ReviewItem[] = [];
  for (const v of unit.vocab ?? []) {
    if (!open(v.reviewed)) continue;
    items.push({ k: `vocab:${vocabId(v)}`, t: 'vocab', q: v.tr, a: v.de, x: v.pos });
  }
  for (const lesson of unit.lessons) {
    if (lesson.passage && open(lesson.passage.reviewed)) {
      items.push({
        k: `passage:${lesson.id}`,
        t: 'passage',
        l: lesson.passage.title_tr ? `${lesson.title} · ${lesson.passage.title_tr}` : lesson.title,
        s: sentences(lesson.passage),
        g: glossary(lesson.passage),
      });
    }
    for (const ex of lesson.exercises) {
      if (!open(ex.reviewed)) continue;
      const item = exerciseItem(ex, lesson.title);
      if (item) items.push(item);
    }
  }
  for (const text of unit.texts ?? []) {
    if (!open(text.reviewed)) continue;
    items.push({ k: text.id, t: 'text', l: text.title, s: sentences(text), g: glossary(text) });
  }
  if (explainer && !unit.reviewed) items.push({ k: 'explainer', t: 'explainer', m: explainer });

  for (const item of items) {
    const hay = JSON.stringify(item);
    const flag = FLAGS.find((f) => hay.includes(f.match));
    if (flag) item.f = flag.note;
  }
  return { id: unit.id, level: unit.level, title: unit.title, file, items };
}

// Nur beim direkten Aufruf (nicht in Tests).
if (process.argv[1]?.replaceAll('\\', '/').endsWith('tools/review-export.ts')) {
  const out = process.argv[2];
  if (!out) throw new Error('Aufruf: npx tsx tools/review-export.ts <ausgabe.json>');
  const files = readdirSync('content', { recursive: true, encoding: 'utf8' })
    .filter(isUnitFile)
    .map((f) => join('content', f))
    .sort();
  const units: ReviewUnit[] = [];
  for (const file of files) {
    const rel = relative('.', file).replaceAll('\\', '/');
    const { unit, errors } = parseUnitFile(rel, readFileSync(file, 'utf8'));
    if (!unit) throw new Error(errors.join('\n'));
    const md = unit.explainer
      ? readFileSync(join('content', unit.explainer), 'utf8').replaceAll('\r\n', '\n')
      : undefined;
    units.push(reviewUnit(unit, rel, md));
  }
  writeFileSync(out, JSON.stringify({ generated: new Date().toISOString(), units }));
  const count = units.reduce((n, u) => n + u.items.length, 0);
  const flagged = units.flatMap((u) => u.items.filter((i) => i.f).map((i) => `${u.id} ${i.k}`));
  console.log(`${units.length} Units, ${count} Einträge, Zweifelsfälle: ${flagged.join(', ')}`);
}
