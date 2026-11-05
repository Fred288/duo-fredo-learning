import { describe, expect, it } from 'vitest';
import type { Exercise, Lesson } from '../content/schema';
import type { VocabEntry } from '../lookup/types';
import {
  FORM_PATTERNS,
  formAnswer,
  formIndex,
  formIntro,
  formRef,
  parseFormRef,
  patternKey,
  patternsFor,
  personFor,
} from './forms';

const lesson = (id: string, exercises: object[]): Lesson =>
  ({ id, type: 'grammar', title: id, exercises: exercises as Exercise[] }) as Lesson;
const entry = (over: Partial<VocabEntry>): VocabEntry => ({
  id: over.tr ?? 'ev',
  tr: 'ev',
  de: ['Haus'],
  pos: 'noun',
  unit: 'a1-u01',
  ...over,
});
const pattern = (key: string) => FORM_PATTERNS.find((p) => patternKey(p) === key)!;

describe('formIntro', () => {
  it('späteste erste Lektion der Bausteine; ungeübte Muster fehlen', () => {
    const intro = formIntro([
      lesson('a1-u01-l1', [{ id: 'x', type: 'suffix_builder', stem: 'ev', suffixes: ['PL'] }]),
      lesson('a1-u01-l2', [
        { id: 'y', type: 'paradigm', kind: 'noun', lemma: 'ev', rows: [['LOC'], ['DAT']] },
      ]),
      lesson('a1-u02-l1', [
        { id: 'z', type: 'conjugation', mode: 'verb', lemma: 'gelmek', person: '1sg' },
        { id: 'w', type: 'conjugation', mode: 'copula', lemma: 'öğrenci', tense: 'past' },
      ]),
      lesson('a1-u02-l2', [
        {
          id: 'v',
          type: 'conjugation',
          mode: 'verb',
          lemma: 'gelmek',
          person: '1sg',
          tense: 'past',
          negative: true,
        },
      ]),
    ]);
    expect(intro).toEqual({
      'noun:PL': 'a1-u01-l1',
      'noun:DAT': 'a1-u01-l2',
      'noun:LOC': 'a1-u01-l2',
      'noun:PL+LOC': 'a1-u01-l2',
      'verb:present': 'a1-u02-l1',
      // Kopula-Übungen zählen nicht; Präteritum kommt mit der Verneinung.
      'verb:past': 'a1-u02-l2',
      'verb:past-neg': 'a1-u02-l2',
    });
  });

  it('Index: Nomen, Verben, Eigennamen und Komposita getrennt; Adjektive und Wendungen nicht', () => {
    const index = formIndex(
      [],
      [
        { id: 'ev', tr: 'ev', pos: 'noun' },
        { id: 'İstanbul', tr: 'İstanbul', pos: 'noun', proper: true },
        { id: 'atasözü', tr: 'atasözü', pos: 'noun', compound_stem: 'atasöz' },
        { id: 'hafta sonu', tr: 'hafta sonu', pos: 'noun' },
        { id: 'büyük', tr: 'büyük', pos: 'adj' },
        { id: 'gelmek', tr: 'gelmek', pos: 'verb' },
      ],
    );
    expect(index).toEqual({
      intro: {},
      nouns: ['ev', 'İstanbul', 'atasözü'],
      verbs: ['gelmek'],
      proper: ['İstanbul'],
      compound: ['atasözü'],
    });
  });
});

describe('Muster und Karten', () => {
  it('Eigennamen nur Kasus, Komposita ohne sein/ihr', () => {
    const keys = (w: Parameters<typeof patternsFor>[0]) => patternsFor(w).map((p) => p.key);
    expect(keys({ kind: 'noun', proper: true })).toEqual(['ACC', 'DAT', 'LOC', 'ABL', 'GEN']);
    expect(keys({ kind: 'noun', compound: true })).not.toContain('POSS_3SG');
    expect(keys({ kind: 'verb' })).toContain('past-neg');
  });

  it('Karten-ID hin und zurück, auch mit Leerzeichen im Wort', () => {
    const p = pattern('verb:present-abil');
    expect(formRef('yardım etmek', p)).toBe('yardım etmek|verb:present-abil');
    expect(parseFormRef('yardım etmek|verb:present-abil')).toEqual({
      vocabId: 'yardım etmek',
      pattern: p,
    });
    expect(parseFormRef('ev|noun:XYZ')).toBeUndefined();
  });

  it('Formen über die Engine, mit Nebenformen; Person stabil je Wort und Muster', () => {
    expect(formAnswer(entry({ tr: 'kitap', softens: true }), 'kitap|noun:ACC')?.forms).toEqual([
      'kitabı',
    ]);
    expect(formAnswer(entry({ tr: 'cami', poss_no_s: true }), 'cami|noun:POSS_3SG')?.forms).toEqual(
      ['camii', 'camisi'],
    );
    const gitmek = entry({ tr: 'gitmek', pos: 'verb', softens: true });
    const person = personFor('gitmek', 'verb:present');
    expect(person).toBe(personFor('gitmek', 'verb:present'));
    const answer = formAnswer(gitmek, 'gitmek|verb:present')!;
    expect(answer.label).toEqual({ kind: 'verb', tense: 'present', person });
    expect(answer.forms[0]).toMatch(/^gidiyor/);
    // Falsches Wort zur ID: keine Karte.
    expect(formAnswer(gitmek, 'gelmek|verb:present')).toBeUndefined();
  });
});
