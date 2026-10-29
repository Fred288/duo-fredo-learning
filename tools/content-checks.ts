import { parse as parseYaml } from 'yaml';
import { Unit, vocabId, type Vocab } from '../src/content/schema';
import { sameForm, solveExercise, solveForm, solveParadigm } from '../src/content/lexicon';
import { isAmbiguous, pieces, presentAlternative } from '../src/content/segmenting';
import { segmentLetters } from '../src/session/segment';
import { MorphError, type Step } from '../src/morphology';
import { explainSteps } from '../src/i18n/explain';
import { speechText } from '../src/audio/speech-text';
import { trLower } from '../src/lib/turkish';

export interface LoadedUnit {
  file: string;
  unit: Unit;
}

export interface Report {
  errors: string[];
  warnings: string[];
}

/** YAML + Schema für eine Datei. Fehler enthalten Datei und Pfad im Objekt. */
export function parseUnitFile(file: string, text: string): { unit?: Unit; errors: string[] } {
  let data: unknown;
  try {
    data = parseYaml(text);
  } catch (e) {
    return { errors: [`${file}: YAML-Fehler: ${(e as Error).message}`] };
  }
  const result = Unit.safeParse(data);
  if (!result.success) {
    return {
      errors: result.error.issues.map(
        (i) => `${file}: ${i.path.length ? i.path.join('.') : '(root)'}: ${i.message}`,
      ),
    };
  }
  return { unit: result.data, errors: [] };
}

/** Prüfungen über alle Units hinweg (doppelte IDs, Dateiverweise, Review-Stand). */
export function checkUnits(units: LoadedUnit[], fileExists: (path: string) => boolean): Report {
  const errors: string[] = [];
  const warnings: string[] = [];
  const seen = new Map<string, string>();

  const claim = (kind: string, id: string, file: string) => {
    const key = `${kind}:${id}`;
    const prev = seen.get(key);
    if (prev) errors.push(`${file}: doppelte ${kind}-ID "${id}" (bereits in ${prev})`);
    else seen.set(key, file);
  };

  let unreviewed = 0;
  for (const { file, unit } of units) {
    claim('Unit', unit.id, file);
    if (unit.explainer && !fileExists(unit.explainer)) {
      errors.push(`${file}: Explainer "${unit.explainer}" nicht gefunden`);
    }
    for (const lesson of unit.lessons) {
      claim('Lektion', lesson.id, file);
      for (const ex of lesson.exercises) {
        claim('Übung', ex.id, file);
        if (!(ex.reviewed ?? unit.reviewed)) unreviewed++;
      }
    }
    for (const v of unit.vocab ?? []) {
      claim('Vokabel', vocabId(v), file);
      if (!(v.reviewed ?? unit.reviewed)) unreviewed++;
      if (v.audio && !fileExists(`audio/${v.audio}`)) {
        warnings.push(`${file}: Audio "${v.audio}" fehlt`);
      }
    }
  }
  if (unreviewed > 0)
    warnings.push(`${unreviewed} Einträge sind noch nicht geprüft (reviewed: false)`);
  return { errors, warnings };
}

/** Jeder Engine-Schritt braucht einen Begründungstext, sonst bricht das Feedback ab. */
function unexplained(steps: Step[]): boolean {
  try {
    explainSteps(steps);
    return false;
  } catch {
    return true;
  }
}

/** Grammatik-Lösungen (Suffix-Builder, Konjugation) müssen mit der Morphologie-Engine übereinstimmen. */
export function checkSuffixTargets(units: LoadedUnit[]): string[] {
  const lexicon = units.flatMap(({ unit }) => unit.vocab ?? []);
  const errors: string[] = [];
  const noReason = (file: string, id: string) =>
    errors.push(`${file}: ${id}: Engine-Schritt ohne Begründungstext (i18n)`);
  for (const { file, unit } of units) {
    for (const lesson of unit.lessons) {
      for (const ex of lesson.exercises) {
        if (ex.type === 'paradigm') {
          try {
            const rows = solveParadigm(ex, lexicon);
            if (unexplained(rows.flatMap((r) => r.steps))) noReason(file, ex.id);
            rows.forEach(({ form }, i) => {
              if (!sameForm(form, ex.targets[i]!)) {
                errors.push(
                  `${file}: ${ex.id}: Zeile ${i + 1}: target "${ex.targets[i]}", Engine erwartet "${form}"`,
                );
              }
            });
          } catch (e) {
            if (!(e instanceof MorphError)) throw e;
            errors.push(`${file}: ${ex.id}: ${e.message}`);
          }
          continue;
        }
        if (ex.type !== 'suffix_builder' && ex.type !== 'conjugation') continue;
        try {
          const { form, steps } = solveExercise(ex, lexicon);
          if (unexplained(steps)) noReason(file, ex.id);
          if (!sameForm(form, ex.target)) {
            errors.push(`${file}: ${ex.id}: target "${ex.target}", Engine erwartet "${form}"`);
          }
        } catch (e) {
          if (!(e instanceof MorphError)) throw e;
          errors.push(`${file}: ${ex.id}: ${e.message}`);
        }
      }
    }
  }
  return errors;
}

const SEGMENT_SOURCES = new Set(['suffix_builder', 'conjugation', 'paradigm']);

/**
 * Zerlege-Übungen (erzeugt oder handgeschrieben): Quelle vorhanden, Engine bildet dieselbe Form
 * mit denselben Stücken und Rollen, `alt_segments` genau bei den Präsensformen mit zweiter
 * üblicher Zerlegung, die Form ist nicht mehrdeutig, jeder Schritt begründbar.
 */
export function checkSegments(units: LoadedUnit[]): string[] {
  const lexicon = units.flatMap(({ unit }) => unit.vocab ?? []);
  const errors: string[] = [];
  for (const { file, unit } of units) {
    const exercises = unit.lessons.flatMap((l) => l.exercises);
    const ids = new Set(exercises.filter((e) => SEGMENT_SOURCES.has(e.type)).map((e) => e.id));
    for (const ex of exercises) {
      if (ex.type !== 'segment') continue;
      const fail = (msg: string) => errors.push(`${file}: ${ex.id}: ${msg}`);
      if (!ids.has(ex.from)) fail(`Quelle "${ex.from}" ist keine Grammatikübung dieser Unit`);
      try {
        const inf = solveForm(ex.analysis, lexicon);
        const expected = pieces(inf, 'person' in ex.analysis ? ex.analysis.person : undefined);
        const got = ex.segments;
        if (!sameForm(inf.form, ex.word)) fail(`word "${ex.word}", Engine erwartet "${inf.form}"`);
        if (got.map((p) => p.text).join('') !== segmentLetters(ex.word)) {
          fail(`Stücke ergeben nicht "${ex.word}" (ohne Leerzeichen und Apostroph)`);
        }
        const show = (s: typeof got) => s.map((p) => `${p.text}:${p.tag}`).join(' ');
        if (show(expected) !== show(got)) {
          fail(`Stücke "${show(got)}", Engine erwartet "${show(expected)}"`);
        }
        // Zweite Zerlegung genau dort, wo das Präsens sie zulässt (bekli-yor neben bekl-iyor).
        const alt = presentAlternative(expected, ex.analysis);
        if ((alt ? show(alt) : '') !== (ex.alt_segments ? show(ex.alt_segments) : '')) {
          fail(
            alt
              ? `alt_segments "${ex.alt_segments ? show(ex.alt_segments) : ''}", erwartet "${show(alt)}"`
              : `alt_segments "${show(ex.alt_segments!)}", für diese Form gibt es keine zweite Zerlegung`,
          );
        }
        if (isAmbiguous(ex.analysis, inf, lexicon, { glossed: !!ex.gloss_de }))
          fail(`"${ex.word}" ist mehrdeutig`);
        if (unexplained(inf.steps)) fail('Engine-Schritt ohne Begründungstext (i18n)');
      } catch (e) {
        if (!(e instanceof MorphError)) throw e;
        fail(e.message);
      }
    }
  }
  return errors;
}

type Chunk = { text: string; role: string };
type ChunkOrder = { order: number[]; note?: string };

/** Fehler einer Satzglied-Folge samt Varianten (Wortbank-Annotation und Satzbau-Übung). */
function chunkErrors(chunks: Chunk[], orders: ChunkOrder[] = []): string[] {
  const errors: string[] = [];
  const predicates = chunks.filter((c) => c.role === 'predicate').length;
  if (predicates !== 1) errors.push(`${predicates} Prädikate, erwartet genau eins`);
  else if (chunks.at(-1)!.role !== 'predicate') errors.push('Prädikat steht nicht am Ende');
  const keys = chunks.map((c) => trLower(c.text));
  if (new Set(keys).size !== keys.length) errors.push('Satzglieder doppelt');
  const seen = new Set([chunks.map((_, i) => i).join(',')]);
  for (const { order } of orders) {
    const key = order.join(',');
    const perm = [...order].sort((a, b) => a - b).join(',');
    if (perm !== chunks.map((_, i) => i).join(',')) {
      errors.push(`orders [${key}] ist keine Umstellung von ${chunks.length} Satzgliedern`);
    } else if (seen.has(key)) {
      errors.push(`orders [${key}] doppelt oder gleich der Grundreihenfolge`);
    }
    seen.add(key);
  }
  return errors;
}

const words = (s: string) =>
  s
    .replace(/[.!?…,]+$/, '')
    .split(/\s+/)
    .filter(Boolean);

/**
 * Satzbau: Satzglieder ergeben genau den ersten Wortbank-Satz, ein Prädikat am Ende der
 * Grundreihenfolge, Varianten sind echte Umstellungen. Jede weitere Wortbank-Lösung, die nur
 * die Satzglieder umstellt, muss als Variante hinterlegt sein (sonst widersprechen sich
 * Wortbank und Satzbau). Erzeugte Übungen: Satzglieder ergeben `text`.
 */
export function checkWordOrder(units: LoadedUnit[]): string[] {
  const errors: string[] = [];
  for (const { file, unit } of units) {
    for (const ex of unit.lessons.flatMap((l) => l.exercises)) {
      const fail = (msg: string) => errors.push(`${file}: ${ex.id}: ${msg}`);
      if (ex.type === 'sov_puzzle') {
        chunkErrors(ex.chunks, ex.orders).forEach(fail);
        const joined = ex.chunks.map((c) => c.text).join(' ');
        if (trLower(joined) !== trLower(words(ex.text).join(' '))) {
          fail(`Satzglieder ergeben "${joined}", nicht "${ex.text}"`);
        }
        continue;
      }
      if (ex.type !== 'word_bank' || !ex.chunks) continue;
      chunkErrors(ex.chunks, ex.orders).forEach(fail);
      const joined = ex.chunks.map((c) => c.text).join(' ');
      const sentence = words(ex.answers[0]!).join(' ');
      if (joined.normalize('NFC') !== sentence.normalize('NFC')) {
        fail(`Satzglieder ergeben "${joined}", erste Antwort ist "${sentence}"`);
        continue;
      }
      const listed = new Set([
        ex.chunks.map((c) => trLower(c.text)).join(' '),
        ...(ex.orders ?? []).map((o) =>
          o.order.map((i) => trLower(ex.chunks![i]?.text ?? '')).join(' '),
        ),
      ]);
      const sorted = (s: string) => [...words(trLower(s))].sort().join(' ');
      const chunkWords = sorted(sentence);
      for (const answer of ex.answers.slice(1)) {
        const text = trLower(words(answer).join(' '));
        if (sorted(answer) === chunkWords && !listed.has(text)) {
          fail(`Antwort "${answer}" stellt nur Satzglieder um und fehlt in orders`);
        }
      }
    }
  }
  return errors;
}

/**
 * Vokabeln aus anderen Units, deren Flags (softens, proper …) die Grammatikübungen dieser Unit
 * brauchen. Zur Laufzeit wird nur eine Unit geladen, daher schreibt der Build sie mit aus.
 */
export function foreignLexicon(unit: Unit, units: LoadedUnit[]): Vocab[] {
  const own = new Set((unit.vocab ?? []).map((v) => v.tr));
  const all = units.flatMap(({ unit: u }) => (u.id === unit.id ? [] : (u.vocab ?? [])));
  const needed = new Set(
    unit.lessons
      .flatMap((l) => l.exercises)
      .flatMap((ex) =>
        ex.type === 'suffix_builder'
          ? [ex.stem]
          : ex.type === 'conjugation' || ex.type === 'paradigm'
            ? [ex.lemma]
            : ex.type === 'segment'
              ? [ex.analysis.lemma]
              : [],
      )
      .filter((form) => !own.has(form)),
  );
  return all.filter((v) => needed.has(v.tr));
}

/** Eintrag der Unit in public/content/index.json (Typ `Manifest` in src/content/load.ts). */
export function manifestEntry(unit: Unit) {
  return {
    id: unit.id,
    level: unit.level,
    title: unit.title,
    explainer: unit.explainer,
    reviewed: unit.reviewed,
    unreviewed: countUnreviewed(unit),
    lessons: unit.lessons.map((l) => ({ id: l.id, type: l.type, title: l.title })),
    // Vokabel-IDs für neue SRS-Karten, ohne die Unit laden zu müssen.
    vocab: (unit.vocab ?? []).map(vocabId),
  };
}

/**
 * Hörübungen nach dem Erzeugen: Text sprechbar, IDs über alle Units eindeutig (auch gegenüber
 * handgeschriebenen Übungen).
 */
export function checkListen(units: LoadedUnit[]): string[] {
  const errors: string[] = [];
  const seen = new Map<string, string>();
  for (const { file, unit } of units) {
    for (const ex of unit.lessons.flatMap((l) => l.exercises)) {
      const prev = seen.get(ex.id);
      if (prev && ex.type === 'listen')
        errors.push(`${file}: Hörübung "${ex.id}" doppelt (${prev})`);
      seen.set(ex.id, file);
      if (ex.type === 'listen' && !speechText(ex.text)) {
        errors.push(`${file}: ${ex.id}: Text "${ex.text}" ist nicht sprechbar`);
      }
    }
  }
  return errors;
}

/**
 * Anzahl ungeprüfter Übungen, Vokabeln und Lesetexte einer Unit (Item-Flag überschreibt Unit-Flag).
 * Erzeugte Übungen (Hören, Zerlegen, Satzbau; mit `from`) zählen nicht extra: ihr Stand folgt der Quelle.
 */
export function countUnreviewed(unit: Unit): number {
  const exercises = unit.lessons
    .flatMap((l) => l.exercises)
    .filter(
      (e) => !((e.type === 'listen' || e.type === 'segment' || e.type === 'sov_puzzle') && e.from),
    );
  const passages = unit.lessons.flatMap((l) => (l.passage ? [l.passage] : []));
  return [...exercises, ...(unit.vocab ?? []), ...passages].filter(
    (i) => !(i.reviewed ?? unit.reviewed),
  ).length;
}
