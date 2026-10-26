import { parse as parseYaml } from 'yaml';
import { Unit, vocabId, type Vocab } from '../src/content/schema';
import { sameForm, solveExercise, solveParadigm } from '../src/content/lexicon';
import { MorphError, type Step } from '../src/morphology';
import { explainSteps } from '../src/i18n/explain';

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

/** Anzahl ungeprüfter Übungen und Vokabeln einer Unit (Item-Flag überschreibt Unit-Flag). */
export function countUnreviewed(unit: Unit): number {
  const exercises = unit.lessons.flatMap((l) => l.exercises);
  return [...exercises, ...(unit.vocab ?? [])].filter((i) => !(i.reviewed ?? unit.reviewed)).length;
}
