import { parse as parseYaml } from 'yaml';
import { Unit, vocabId } from '../src/content/schema';

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
