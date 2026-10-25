import { parse as parseYaml } from 'yaml';
import { Unit, vocabId, type Vocab } from '../src/content/schema';
import { trLower } from '../src/lib/turkish';
import { inflect, MorphError } from '../src/morphology';

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

/** Suffix-Builder-Lösungen müssen mit der Morphologie-Engine übereinstimmen. */
export function checkSuffixTargets(units: LoadedUnit[]): string[] {
  const lexicon = new Map<string, Vocab>();
  for (const { unit } of units) for (const v of unit.vocab ?? []) lexicon.set(v.tr, v);

  const errors: string[] = [];
  for (const { file, unit } of units) {
    for (const lesson of unit.lessons) {
      for (const ex of lesson.exercises) {
        if (ex.type !== 'suffix_builder') continue;
        const v = lexicon.get(ex.stem);
        try {
          const { form } = inflect(
            { form: ex.stem, softens: v?.softens, harmonyVowel: v?.harmony_vowel },
            ex.suffixes,
          );
          const target = trLower(ex.target);
          if (form !== target) {
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

/** Anzahl ungeprüfter Übungen und Vokabeln einer Unit (Item-Flag überschreibt Unit-Flag). */
export function countUnreviewed(unit: Unit): number {
  const exercises = unit.lessons.flatMap((l) => l.exercises);
  return [...exercises, ...(unit.vocab ?? [])].filter((i) => !(i.reviewed ?? unit.reviewed)).length;
}
