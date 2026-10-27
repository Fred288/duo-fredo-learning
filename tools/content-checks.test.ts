import { describe, expect, it } from 'vitest';
import {
  checkSegments,
  checkSuffixTargets,
  countUnreviewed,
  checkUnits,
  foreignLexicon,
  manifestEntry,
  parseUnitFile,
  type LoadedUnit,
} from './content-checks';

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

describe('foreignLexicon', () => {
  const withSuffix = (id: string, stem: string, vocab: string) => `
id: ${id}
level: A1
title: Test
source: eigene Formulierung
license: CC BY-SA 4.0
lessons:
  - id: ${id}-l1
    type: grammar
    title: Suffixe
    exercises:
      - { id: ${id}-l1-e1, type: suffix_builder, stem: ${stem}, suffixes: [DAT], target: x }
vocab:
${vocab}
`;

  it('liefert Einträge anderer Units, die eine Grammatikübung braucht', () => {
    const a = load(
      'a.yaml',
      withSuffix(
        'a1-u02',
        'ev',
        [
          '  - { tr: kitap, de: [Buch], pos: noun, softens: true }',
          '  - { tr: ev, de: [Haus], pos: noun }',
        ].join('\n'),
      ),
    );
    const b = load(
      'b.yaml',
      withSuffix('a1-u03', 'kitap', '  - { tr: park, de: [Park], pos: noun }'),
    );
    expect(foreignLexicon(b.unit, [a, b])).toEqual([
      { tr: 'kitap', de: ['Buch'], pos: 'noun', softens: true },
    ]);
    expect(foreignLexicon(a.unit, [a, b])).toEqual([]);
  });
});

describe('checkSuffixTargets: Tabelle', () => {
  const unit = (targets: string) => `
id: a1-u03
level: A1
title: Test
source: eigene Formulierung
license: CC BY-SA 4.0
lessons:
  - id: a1-u03-l1
    type: grammar
    title: Tabelle
    exercises:
      - { id: a1-u03-l1-e1, type: paradigm, kind: noun, lemma: şehir, rows: [[LOC], [DAT]], targets: ${targets} }
vocab:
  - { tr: şehir, de: [Stadt], pos: noun, drops_vowel: true }
`;

  it('prüft jede Zelle gegen die Engine', () => {
    expect(checkSuffixTargets([load('a.yaml', unit('[şehirde, şehre]'))])).toEqual([]);
    expect(checkSuffixTargets([load('a.yaml', unit('[şehirde, şehire]'))])).toEqual([
      'a.yaml: a1-u03-l1-e1: Zeile 2: target "şehire", Engine erwartet "şehre"',
    ]);
  });

  it('verlangt so viele targets wie Zeilen', () => {
    expect(parseUnitFile('a.yaml', unit('[şehirde, şehre, şehirden]')).errors[0]).toContain(
      '3 targets für 2 Zeilen',
    );
  });
});

describe('manifestEntry', () => {
  it('listet Lektionen und Vokabel-IDs der Unit', () => {
    const text = yamlUnit('a1-u01', 'explainer: explainers/x.md').concat(
      '  - { id: yüz-sayı, tr: yüz, de: [hundert], pos: num }\n',
    );
    const { unit } = load('a.yaml', text);
    expect(manifestEntry(unit)).toEqual({
      id: 'a1-u01',
      level: 'A1',
      title: 'Test',
      explainer: 'explainers/x.md',
      reviewed: false,
      unreviewed: 3,
      lessons: [{ id: 'a1-u01-l1', type: 'vocab', title: 'Wörter' }],
      vocab: ['ev', 'yüz-sayı'],
    });
  });
});

describe('checkSegments', () => {
  const unit = (segment: string) => `
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
      - { id: a1-u02-l1-e1, type: suffix_builder, stem: kitap, suffixes: [PL, LOC], target: kitaplarda }
  - id: a1-u02-z1
    type: segmenting
    title: Zerlegen
    exercises:
      - id: a1-u02-z1-l1-e1
        type: segment
${segment}
vocab:
  - { tr: kitap, de: [Buch], pos: noun, softens: true }
  - { tr: ev, de: [Haus], pos: noun }
`;
  const ok = `        word: kitaplarda
        segments: [{ text: kitap, tag: STEM }, { text: lar, tag: PL }, { text: da, tag: LOC }]
        analysis: { kind: noun, lemma: kitap, tags: [PL, LOC] }
        from: a1-u02-l1-e1`;

  it('akzeptiert eine Zerlegung, die die Engine bestätigt', () => {
    expect(checkSegments([load('a.yaml', unit(ok))])).toEqual([]);
  });

  it('meldet falsche Rollen, fremde Quelle und mehrdeutige Formen', () => {
    const wrongTag = ok.replace('tag: LOC', 'tag: DAT');
    expect(checkSegments([load('a.yaml', unit(wrongTag))])).toEqual([
      'a.yaml: a1-u02-z1-l1-e1: Stücke "kitap:STEM lar:PL da:DAT", Engine erwartet "kitap:STEM lar:PL da:LOC"',
    ]);
    const foreign = ok.replace('from: a1-u02-l1-e1', 'from: a1-u02-l9-e9');
    expect(checkSegments([load('a.yaml', unit(foreign))])).toEqual([
      'a.yaml: a1-u02-z1-l1-e1: Quelle "a1-u02-l9-e9" ist keine Grammatikübung dieser Unit',
    ]);
    const evi = `        word: evi
        segments: [{ text: ev, tag: STEM }, { text: i, tag: ACC }]
        analysis: { kind: noun, lemma: ev, tags: [ACC] }
        from: a1-u02-l1-e1`;
    expect(checkSegments([load('a.yaml', unit(evi))])).toEqual([
      'a.yaml: a1-u02-z1-l1-e1: "evi" ist mehrdeutig',
    ]);
  });

  it('Schema: Stücke müssen das Wort ergeben', () => {
    const broken = ok.replace('text: da', 'text: de');
    expect(parseUnitFile('a.yaml', unit(broken)).errors[0]).toContain('ergeben nicht');
  });
});

describe('countUnreviewed', () => {
  it('zählt erzeugte Zerlege-Übungen nicht', () => {
    const { unit } = load(
      'a.yaml',
      yamlUnit('a1-u01').replace(
        'vocab:\n',
        `  - id: a1-u01-z1
    type: segmenting
    title: Z
    exercises:
      - id: a1-u01-z1-l1-e1
        type: segment
        word: evde
        segments: [{ text: ev, tag: STEM }, { text: de, tag: LOC }]
        analysis: { kind: noun, lemma: ev, tags: [LOC] }
        from: a1-u01-l1-e1
vocab:
`,
      ),
    );
    expect(countUnreviewed(unit)).toBe(2);
  });
});
