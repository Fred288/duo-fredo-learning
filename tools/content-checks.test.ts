import { describe, expect, it } from 'vitest';
import { checkSuffixTargets, checkUnits, parseUnitFile, type LoadedUnit } from './content-checks';

const yamlUnit = (id: string, extra = '') => `
id: ${id}
level: A1
title: Test
source: eigene Formulierung
license: CC BY-SA 4.0
${extra}
lessons:
  - id: ${id}-l1
    type: vocab
    title: Wörter
    exercises:
      - id: ${id}-l1-e1
        type: free_text
        direction: de_tr
        prompt: Haus
        answers: [ev]
vocab:
  - { tr: ev, de: [Haus], pos: noun }
`;

const load = (file: string, text: string): LoadedUnit => {
  const { unit, errors } = parseUnitFile(file, text);
  expect(errors).toEqual([]);
  return { file, unit: unit! };
};

describe('parseUnitFile', () => {
  it('meldet YAML-Syntaxfehler mit Dateiname', () => {
    const { errors } = parseUnitFile('x.yaml', 'id: [unclosed');
    expect(errors[0]).toMatch(/^x\.yaml: YAML-Fehler/);
  });

  it('meldet Schemafehler mit Pfad', () => {
    const { errors } = parseUnitFile('x.yaml', yamlUnit('a1-u01').replace('direction: de_tr', ''));
    expect(errors).toContainEqual(expect.stringContaining('x.yaml: lessons.0.exercises.0'));
  });
});

describe('checkUnits', () => {
  it('findet doppelte IDs über Dateien hinweg', () => {
    const units = [load('a.yaml', yamlUnit('a1-u01')), load('b.yaml', yamlUnit('a1-u01'))];
    const { errors } = checkUnits(units, () => true);
    expect(errors).toContainEqual(expect.stringContaining('doppelte Unit-ID "a1-u01"'));
    expect(errors).toContainEqual(expect.stringContaining('doppelte Vokabel-ID "ev"'));
  });

  it('meldet fehlenden Explainer als Fehler', () => {
    const units = [load('a.yaml', yamlUnit('a1-u01', 'explainer: explainers/fehlt.md'))];
    expect(checkUnits(units, () => false).errors).toContainEqual(
      expect.stringContaining('Explainer "explainers/fehlt.md" nicht gefunden'),
    );
  });

  it('warnt vor ungeprüften Inhalten', () => {
    const units = [load('a.yaml', yamlUnit('a1-u01'))];
    const { errors, warnings } = checkUnits(units, () => true);
    expect(errors).toEqual([]);
    expect(warnings).toContainEqual(expect.stringContaining('2 Einträge'));
  });
});

describe('checkSuffixTargets', () => {
  const unitWith = (target: string, vocab = '') => `
id: a1-u02
level: A1
title: Test
source: eigene Formulierung
license: CC BY-SA 4.0
lessons:
  - id: a1-u02-l1
    type: grammar
    title: Suffixe
    exercises:
      - id: a1-u02-l1-e1
        type: suffix_builder
        stem: kitap
        suffixes: [ACC]
        target: ${target}
${vocab}
`;

  it('akzeptiert Ziel, das die Engine mit Vokabel-Flags erzeugt', () => {
    const u = load(
      'a.yaml',
      unitWith('kitabı', 'vocab:\n  - { tr: kitap, de: [Buch], pos: noun, softens: true }'),
    );
    expect(checkSuffixTargets([u])).toEqual([]);
  });

  it('meldet Abweichung mit Erwartungswert', () => {
    const u = load('a.yaml', unitWith('kitabı'));
    expect(checkSuffixTargets([u])).toEqual([
      'a.yaml: a1-u02-l1-e1: target "kitabı", Engine erwartet "kitapı"',
    ]);
  });
});

describe('checkSuffixTargets: Konjugation', () => {
  const unit = (target: string, extra = '') => `
id: a1-u08
level: A1
title: Test
source: eigene Formulierung
license: CC BY-SA 4.0
lessons:
  - id: a1-u08-l1
    type: grammar
    title: Präsens
    exercises:
      - { id: a1-u08-l1-e1, type: conjugation, mode: verb, lemma: gitmek, person: 1sg, target: ${target} }
      - { id: a1-u08-l1-e2, type: conjugation, mode: copula, lemma: öğrenci, person: 2sg, question: true, target: öğrenci misin? }
vocab:
  - { tr: gitmek, de: [gehen], pos: verb, softens: true }
${extra}
`;

  it('akzeptiert Formen, die die Engine bildet (inkl. Erweichung und Frage)', () => {
    expect(checkSuffixTargets([load('a.yaml', unit('gidiyorum'))])).toEqual([]);
  });

  it('meldet falsche Formen mit Erwartungswert', () => {
    expect(checkSuffixTargets([load('a.yaml', unit('gitiyorum'))])).toEqual([
      'a.yaml: a1-u08-l1-e1: target "gitiyorum", Engine erwartet "gidiyorum"',
    ]);
  });
});
