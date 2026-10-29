import { describe, expect, it } from 'vitest';
import type { Exercise } from '../content/schema';
import { grade, solutionOf } from './grade';
import {
  fixedBoundaries,
  gradeSegment,
  MAX_ROLE_DISTRACTORS,
  parseSegmentAnswer,
  piecesFromCuts,
  segmentAnswer,
  segmentPieces,
  segmentRoleOptions,
  segmentSolution,
  segmentVariants,
} from './segment';

type Segment = Extract<Exercise, { type: 'segment' }>;

const evlerimizden: Segment = {
  id: 'a1-u03-z1-l2-e1',
  type: 'segment',
  word: 'evlerimizden',
  segments: [
    { text: 'ev', tag: 'STEM' },
    { text: 'ler', tag: 'PL' },
    { text: 'imiz', tag: 'POSS_1PL' },
    { text: 'den', tag: 'ABL' },
  ],
  analysis: { kind: 'noun', lemma: 'ev', tags: ['PL', 'POSS_1PL', 'ABL'] },
  from: 'a1-u03-l2-e1',
};

const question: Segment = {
  id: 'a1-u08-z1-l2-e1',
  type: 'segment',
  word: 'geliyor musun',
  segments: [
    { text: 'gel', tag: 'STEM' },
    { text: 'iyor', tag: 'PRES' },
    { text: 'mu', tag: 'Q' },
    { text: 'sun', tag: 'P2SG' },
  ],
  analysis: { kind: 'verb', lemma: 'gelmek', person: '2sg', question: true },
  from: 'a1-u08-l2-e1',
};

const right = segmentAnswer({
  pieces: ['ev', 'ler', 'imiz', 'den'],
  tags: ['STEM', 'PL', 'POSS_1PL', 'ABL'],
});

describe('Antwort-Kodierung', () => {
  it('Stücke und Rollen hin und zurück', () => {
    expect(right).toBe('ev|ler|imiz|den\nSTEM;PL;POSS_1PL;ABL');
    expect(parseSegmentAnswer(right)).toEqual({
      pieces: ['ev', 'ler', 'imiz', 'den'],
      tags: ['STEM', 'PL', 'POSS_1PL', 'ABL'],
    });
    expect(parseSegmentAnswer('')).toEqual({ pieces: [], tags: [''] });
  });

  it('feste Grenzen an Leerzeichen und Apostroph', () => {
    expect(fixedBoundaries('geliyor musun')).toEqual([7]);
    expect(fixedBoundaries("İstanbul'da")).toEqual([8]);
    expect(fixedBoundaries('evde')).toEqual([]);
  });

  it('Stücke aus gesetzten Grenzen, feste Grenzen immer dabei', () => {
    expect(piecesFromCuts('evlerimizden', [2, 5, 9])).toEqual(['ev', 'ler', 'imiz', 'den']);
    expect(piecesFromCuts('geliyor musun', [3])).toEqual(['gel', 'iyor', 'musun']);
    expect(piecesFromCuts('evde', [0, 4, 2, 2])).toEqual(['ev', 'de']);
  });
});

describe('gradeSegment', () => {
  it('richtig nur mit allen Grenzen und Rollen', () => {
    expect(gradeSegment(evlerimizden, right)).toEqual({
      verdict: 'correct',
      matched: 'ev-ler-imiz-den',
      hints: [],
    });
    const wrongRole = right.replace('ABL', 'LOC');
    expect(gradeSegment(evlerimizden, wrongRole).verdict).toBe('wrong');
    const missingCut = 'ev|lerimiz|den\nSTEM;PL;ABL';
    expect(gradeSegment(evlerimizden, missingCut).verdict).toBe('wrong');
    const extraCut = 'ev|ler|i|miz|den\nSTEM;PL;POSS_1PL;POSS_1PL;ABL';
    expect(gradeSegment(evlerimizden, extraCut).verdict).toBe('wrong');
  });

  it('Stück für Stück: Grenze gefunden, Rolle richtig', () => {
    const r = segmentPieces(evlerimizden, 'ev|ler|imizden\nSTEM;POSS_1PL;ABL');
    expect(r.map((p) => [p.text, p.found, p.correct])).toEqual([
      ['ev', true, true],
      ['ler', true, false],
      ['imiz', false, false],
      ['den', false, false],
    ]);
  });

  it('Stamm ohne Rollenwahl; Fragepartikel über die feste Grenze hinweg', () => {
    expect(gradeSegment(question, 'gel|iyor|mu|sun\n;PRES;Q;P2SG').verdict).toBe('correct');
    expect(gradeSegment(question, 'gel|iyor|musun\n;PRES;Q').verdict).toBe('wrong');
  });

  it('Groß/Klein zählt nicht', () => {
    const ex: Segment = {
      ...evlerimizden,
      word: "İstanbul'da",
      segments: [
        { text: 'İstanbul', tag: 'STEM' },
        { text: 'da', tag: 'LOC' },
      ],
      analysis: { kind: 'noun', lemma: 'İstanbul', tags: ['LOC'] },
    };
    expect(gradeSegment(ex, 'istanbul|da\nSTEM;LOC').verdict).toBe('correct');
  });

  it('läuft über grade und solutionOf', () => {
    expect(grade(evlerimizden, right, { tolerateDiacritics: false }).verdict).toBe('correct');
    expect(solutionOf(evlerimizden)).toBe('ev-ler-imiz-den');
  });
});

describe('zwei übliche Zerlegungen (Präsens)', () => {
  const waiting: Segment = {
    id: 'a1-u05-z1-l2-e1',
    type: 'segment',
    word: 'bekliyorum',
    segments: [
      { text: 'bekl', tag: 'STEM' },
      { text: 'iyor', tag: 'PRES' },
      { text: 'um', tag: 'P1SG' },
    ],
    alt_segments: [
      { text: 'bekli', tag: 'STEM' },
      { text: 'yor', tag: 'PRES' },
      { text: 'um', tag: 'P1SG' },
    ],
    analysis: { kind: 'verb', lemma: 'beklemek', person: '1sg' },
    from: 'a1-u05-l2-e1',
  };

  it('beide Grenzen gelten, die gefundene steht in matched', () => {
    expect(gradeSegment(waiting, 'bekl|iyor|um\n;PRES;P1SG')).toEqual({
      verdict: 'correct',
      matched: 'bekl-iyor-um',
      hints: [],
    });
    expect(gradeSegment(waiting, 'bekli|yor|um\n;PRES;P1SG')).toEqual({
      verdict: 'correct',
      matched: 'bekli-yor-um',
      hints: [],
    });
    expect(grade(waiting, 'bekli|yor|um\n;PRES;P1SG', { tolerateDiacritics: false }).verdict).toBe(
      'correct',
    );
  });

  it('andere Grenzen und falsche Rollen bleiben falsch', () => {
    expect(gradeSegment(waiting, 'bek|liyor|um\n;PRES;P1SG').verdict).toBe('wrong');
    expect(gradeSegment(waiting, 'bekli|yor|um\n;PAST;P1SG').verdict).toBe('wrong');
    expect(gradeSegment(waiting, 'bekl|i|yor|um\n;PRES;PRES;P1SG').verdict).toBe('wrong');
  });

  it('Rückmeldung je Stück gegen die näher liegende Zerlegung', () => {
    const alt = segmentPieces(waiting, 'bekli|yor|um\n;PAST;P1SG');
    expect(alt.map((p) => [p.text, p.found, p.correct])).toEqual([
      ['bekli', true, true],
      ['yor', true, false],
      ['um', true, true],
    ]);
    // Gleichstand: die Zerlegung der Engine
    expect(segmentPieces(waiting, 'bekliyorum\n').map((p) => p.text)).toEqual([
      'bekl',
      'iyor',
      'um',
    ]);
  });

  it('ohne alt_segments nur die Zerlegung der Engine', () => {
    expect(segmentVariants(waiting)).toHaveLength(2);
    expect(segmentVariants(question)).toEqual([question.segments]);
    expect(solutionOf(waiting)).toBe('bekl-iyor-um');
  });
});

describe('segmentRoleOptions', () => {
  it('enthält alle richtigen Rollen plus Verwechsler, ohne Stamm', () => {
    const options = segmentRoleOptions(evlerimizden);
    expect(options).toEqual(expect.arrayContaining(['PL', 'POSS_1PL', 'ABL']));
    expect(options).not.toContain('STEM');
    expect(options.length).toBe(3 + MAX_ROLE_DISTRACTORS);
    expect(new Set(options).size).toBe(options.length);
    expect(segmentRoleOptions(evlerimizden)).toEqual(options); // stabil
  });

  it('Verwechsler aus derselben Gruppe: Personalendung ↔ Possessiv', () => {
    const options = segmentRoleOptions(question);
    const others = options.filter((o) => !['PRES', 'Q', 'P2SG'].includes(o));
    const groups = [
      'P',
      'POSS_',
      'NEG',
      'ABIL',
      'PAST',
      'FUT',
      'AOR',
      'EVID',
      'NEC',
      'IMP',
      'PASS',
    ];
    expect(others.every((o) => groups.some((g) => o.startsWith(g)))).toBe(true);
  });
});

describe('segmentSolution', () => {
  it('bildet die Form samt Begründung neu', () => {
    const inf = segmentSolution(evlerimizden, [{ tr: 'ev', de: ['Haus'], pos: 'noun' }]);
    expect(inf.form).toBe('evlerimizden');
    expect(inf.steps.length).toBeGreaterThan(0);
  });
});

describe('Rollen-Ablenker ohne B1-Rollen in finiten Formen', () => {
  it('Präteritum bekommt keine Partizip- oder Verbalnomen-Rollen', () => {
    const ex = {
      id: 'x-s',
      type: 'segment',
      word: 'yaptım',
      segments: [
        { text: 'yap', tag: 'STEM' },
        { text: 'tı', tag: 'PAST' },
        { text: 'm', tag: 'P1SG' },
      ],
      analysis: { kind: 'verb', lemma: 'yapmak', person: '1sg', tense: 'past' },
      from: 'x-1',
    } as Parameters<typeof segmentRoleOptions>[0];
    const options = segmentRoleOptions(ex);
    for (const tag of ['PART_AN', 'PART_DIK', 'PART_ACAK', 'VN_MA', 'VN_MAK', 'VN_IS']) {
      expect(options).not.toContain(tag);
    }
  });
});
