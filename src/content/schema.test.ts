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

  it('verlangt source und license', () => {
    const u: Record<string, unknown> = validUnit();
    delete u.source;
    expect(issues(u)).toContainEqual(expect.stringContaining('source'));
  });
});
