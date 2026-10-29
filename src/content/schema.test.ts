import { describe, expect, it } from 'vitest';
import { Unit } from './schema';

const validUnit = () => ({
  id: 'a1-u03',
  level: 'A1',
  title: 'Orte und Richtungen',
  source: 'eigene Formulierung',
  license: 'CC BY-SA 4.0',
  lessons: [
    {
      id: 'a1-u03-l1',
      type: 'grammar',
      title: 'Lokativ',
      exercises: [
        {
          id: 'a1-u03-l1-e1',
          type: 'suffix_builder',
          stem: 'ev',
          suffixes: ['LOC'],
          target: 'evde',
          gloss_de: 'im Haus',
        },
        {
          id: 'a1-u03-l1-e2',
          type: 'multiple_choice',
          prompt: 'im Haus',
          options: ['evde', 'evda'],
          answer: 'evde',
        },
      ],
    },
  ],
  vocab: [{ tr: 'kitap', de: ['Buch'], pos: 'noun', softens: true }],
});

const issues = (data: unknown) => {
  const r = Unit.safeParse(data);
  return r.success ? [] : r.error.issues.map((i) => `${i.path.join('.')}: ${i.message}`);
};

describe('Unit-Schema', () => {
  it('akzeptiert eine gültige Unit und setzt reviewed=false', () => {
    const r = Unit.parse(validUnit());
    expect(r.reviewed).toBe(false);
  });

  it('lehnt MC-Antwort ab, die nicht in den Optionen steht', () => {
    const u = validUnit();
    Object.assign(u.lessons[0]!.exercises[1]!, { answer: 'evte' });
    expect(issues(u)).toContainEqual(expect.stringContaining('lessons.0.exercises.1.answer'));
  });

  it('lehnt falsches Übungs-ID-Präfix ab', () => {
    const u = validUnit();
    u.lessons[0]!.exercises[0]!.id = 'a1-u04-l1-e1';
    expect(issues(u)).toContainEqual(expect.stringContaining('lessons.0.exercises.0.id'));
  });

  it('lehnt Level ab, das nicht zur ID passt', () => {
    expect(issues({ ...validUnit(), level: 'A2' })).toContainEqual(
      expect.stringContaining('level'),
    );
  });

  it('lehnt unbekannten Übungstyp ab', () => {
    const u = validUnit();
    Object.assign(u.lessons[0]!.exercises[0]!, { type: 'karaoke' });
    expect(issues(u).length).toBeGreaterThan(0);
  });

  it('lehnt unbekannten Morphem-Tag ab', () => {
    const u = validUnit();
    Object.assign(u.lessons[0]!.exercises[0]!, { suffixes: ['LOKATIV'] });
    expect(issues(u).length).toBeGreaterThan(0);
  });

  it('compound, Optativ und ise nur in erlaubten Kombinationen', () => {
    const conj = (extra: object) => {
      const u = validUnit();
      u.lessons[0]!.exercises[0] = {
        id: 'a1-u03-l1-e1',
        type: 'conjugation',
        mode: 'verb',
        lemma: 'gelmek',
        person: '1sg',
        target: 'x',
        ...extra,
      } as never;
      return issues(u);
    };
    expect(conj({ tense: 'present', compound: 'past' })).toEqual([]);
    expect(conj({ compound: 'past' })).toEqual([]);
    expect(conj({ tense: 'past', compound: 'past' })).toContainEqual(
      expect.stringContaining('compound'),
    );
    expect(conj({ tense: 'aorist', compound: 'conditional', question: true })).toContainEqual(
      expect.stringContaining('question'),
    );
    expect(conj({ tense: 'optative', person: '3sg' })).toContainEqual(
      expect.stringContaining('Optativ'),
    );
    expect(conj({ mode: 'copula', lemma: 'öğrenci', compound: 'past' })).toContainEqual(
      expect.stringContaining('compound'),
    );
    expect(conj({ mode: 'copula', lemma: 'öğrenci', tense: 'conditional' })).toEqual([]);
    expect(
      conj({ mode: 'copula', lemma: 'öğrenci', tense: 'conditional', question: true }),
    ).toContainEqual(expect.stringContaining('question'));
    expect(conj({ tense: 'imperative', person: '2sg', compound: 'past' })).toContainEqual(
      expect.stringContaining('compound'),
    );
    expect(conj({ mode: 'copula', lemma: 'öğrenci', tense: 'past', dir: true })).toContainEqual(
      expect.stringContaining('dir'),
    );
    expect(conj({ mode: 'copula', lemma: 'öğrenci', person: '3sg', dir: true })).toEqual([]);
  });

  it('suffix_builder mit verbal: Endungen optional, Verneinung nur dort', () => {
    const sb = (extra: object) => {
      const u = validUnit();
      u.lessons[0]!.exercises[0] = {
        id: 'a1-u03-l1-e1',
        type: 'suffix_builder',
        stem: 'gelmek',
        target: 'x',
        ...extra,
      } as never;
      return issues(u);
    };
    expect(sb({ verbal: 'CV_INCA' })).toEqual([]);
    expect(sb({ verbal: 'PART_DIK', suffixes: ['POSS_1SG'], negative: true })).toEqual([]);
    expect(sb({})).toContainEqual(expect.stringContaining('suffixes'));
    expect(sb({ suffixes: ['PL'], negative: true })).toContainEqual(
      expect.stringContaining('verbal'),
    );
  });

  it('Tabelle verbal braucht verbal und rows, keine Zeit', () => {
    const par = (extra: object) => {
      const u = validUnit();
      u.lessons[0]!.exercises[0] = {
        id: 'a1-u03-l1-e1',
        type: 'paradigm',
        kind: 'verbal',
        lemma: 'okumak',
        targets: ['okuduğum', 'okuduğun'],
        ...extra,
      } as never;
      return issues(u);
    };
    expect(par({ verbal: 'PART_DIK', rows: [['POSS_1SG'], ['POSS_2SG']] })).toEqual([]);
    expect(par({ rows: [['POSS_1SG'], ['POSS_2SG']] })).toContainEqual(
      expect.stringContaining('verbal'),
    );
    expect(par({ verbal: 'PART_DIK' })).toContainEqual(expect.stringContaining('rows'));
    expect(
      par({ verbal: 'PART_DIK', rows: [['POSS_1SG'], ['POSS_2SG']], tense: 'past' }),
    ).toContainEqual(expect.stringContaining('kind'));
  });

  it('Optativ-Tabelle braucht persons', () => {
    const u = validUnit();
    u.lessons[0]!.exercises[0] = {
      id: 'a1-u03-l1-e1',
      type: 'paradigm',
      kind: 'verb',
      lemma: 'gelmek',
      tense: 'optative',
      targets: ['geleyim', 'gelelim'],
    } as never;
    expect(issues(u)).toContainEqual(expect.stringContaining('persons'));
  });

  it('verlangt source und license', () => {
    const u: Record<string, unknown> = validUnit();
    delete u.source;
    expect(issues(u)).toContainEqual(expect.stringContaining('source'));
  });
});
