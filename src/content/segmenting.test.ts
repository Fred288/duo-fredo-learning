import { describe, expect, it } from 'vitest';
import { solveForm } from './lexicon';
import { Unit, type Exercise, type Vocab } from './schema';
import {
  isAmbiguous,
  pieces,
  presentAlternative,
  SEGMENT_WORDS,
  segmentCandidates,
  segmentLesson,
  withSegments,
} from './segmenting';

type Segment = Extract<Exercise, { type: 'segment' }>;

const vocab: Vocab[] = [
  { tr: 'ev', de: ['Haus'], pos: 'noun' },
  { tr: 'kitap', de: ['Buch'], pos: 'noun', softens: true },
  { tr: 'oğul', de: ['Sohn'], pos: 'noun', drops_vowel: true },
  { tr: 'İstanbul', de: ['Istanbul'], pos: 'noun', proper: true },
  { tr: 'gelmek', de: ['kommen'], pos: 'verb' },
  { tr: 'yemek', de: ['essen'], pos: 'verb' },
  { tr: 'beklemek', de: ['warten'], pos: 'verb' },
  { tr: 'aramak', de: ['suchen'], pos: 'verb' },
  { tr: 'söylemek', de: ['sagen'], pos: 'verb' },
  { tr: 'okumak', de: ['lesen'], pos: 'verb' },
];

const builder = (n: number, stem: string, suffixes: string[], target: string): Exercise =>
  ({
    id: `a1-u03-l2-e${n}`,
    type: 'suffix_builder',
    stem,
    suffixes,
    target,
    gloss_de: `Form ${n}`,
  }) as Exercise;

function makeUnit(exercises: Exercise[], more: Exercise[] = []): Unit {
  return Unit.parse({
    id: 'a1-u03',
    level: 'A1',
    title: 'Orte',
    source: 's',
    license: 'l',
    vocab,
    lessons: [
      { id: 'a1-u03-l2', type: 'grammar', title: 'G', exercises },
      ...(more.length ? [{ id: 'a1-u03-l3', type: 'grammar', title: 'T', exercises: more }] : []),
      {
        id: 'a1-u03-l4',
        type: 'review',
        title: 'W',
        exercises: [
          {
            id: 'a1-u03-l4-e1',
            type: 'free_text',
            direction: 'de_tr',
            prompt: 'x',
            answers: ['ev'],
          },
        ],
      },
    ],
  });
}

const segs = (e: Segment) => e.segments.map((s) => `${s.text}:${s.tag}`).join(' ');

describe('pieces', () => {
  it('zerlegt nominale Formen samt Lautwandel am Stamm', () => {
    const show = (tags: Parameters<typeof solveForm>[0]) =>
      pieces(solveForm(tags, vocab))
        .map((p) => `${p.text}:${p.tag}`)
        .join(' ');
    expect(show({ kind: 'noun', lemma: 'ev', tags: ['PL', 'POSS_1PL', 'ABL'] })).toBe(
      'ev:STEM ler:PL imiz:POSS_1PL den:ABL',
    );
    expect(show({ kind: 'noun', lemma: 'kitap', tags: ['ACC'] })).toBe('kitab:STEM ı:ACC');
    expect(show({ kind: 'noun', lemma: 'oğul', tags: ['POSS_1SG'] })).toBe('oğl:STEM um:POSS_1SG');
    expect(show({ kind: 'noun', lemma: 'İstanbul', tags: ['LOC'] })).toBe('İstanbul:STEM da:LOC');
  });

  it('trennt die Personalendung von der Fragepartikel, leere Endungen fallen weg', () => {
    const inf = solveForm({ kind: 'verb', lemma: 'gelmek', person: '2sg', question: true }, vocab);
    expect(inf.form).toBe('geliyor musun');
    expect(pieces(inf, '2sg')).toEqual([
      { text: 'gel', tag: 'STEM' },
      { text: 'iyor', tag: 'PRES' },
      { text: 'mu', tag: 'Q' },
      { text: 'sun', tag: 'P2SG' },
    ]);
    const third = solveForm({ kind: 'verb', lemma: 'gelmek', person: '3sg' }, vocab);
    expect(pieces(third, '3sg').map((p) => p.tag)).toEqual(['STEM', 'PRES']);
  });
});

describe('presentAlternative', () => {
  const alt = (spec: Parameters<typeof solveForm>[0]) => {
    const person = 'person' in spec ? spec.person : undefined;
    const a = presentAlternative(pieces(solveForm(spec, vocab), person), spec);
    return a?.map((p) => `${p.text}:${p.tag}`).join(' ');
  };
  const verb = (lemma: string, more: object = {}) =>
    ({ kind: 'verb', lemma, person: '1sg', ...more }) as const;

  it('Stammauslaut a/e vor -Iyor: auch mit verengtem Vokal am Stamm (bekli-yor)', () => {
    expect(alt(verb('beklemek'))).toBe('bekli:STEM yor:PRES um:P1SG');
    expect(alt(verb('aramak'))).toBe('arı:STEM yor:PRES um:P1SG');
    expect(alt(verb('söylemek'))).toBe('söylü:STEM yor:PRES um:P1SG');
    expect(alt(verb('beklemek', { person: '2sg', question: true }))).toBe(
      'bekli:STEM yor:PRES mu:Q sun:P2SG',
    );
  });

  it('auch mit Kopula (bekli-yor-du-m)', () => {
    expect(alt(verb('beklemek', { compound: 'past' }))).toBe('bekli:STEM yor:PRES du:PAST m:P1SG');
    expect(alt(verb('beklemek', { compound: 'past', question: true }))).toBe(
      'bekli:STEM yor:PRES mu:Q ydu:PAST m:P1SG',
    );
  });

  it('Verneinung vor -yor: auch gel-m-iyor', () => {
    expect(alt(verb('gelmek', { negative: true }))).toBe('gel:STEM m:NEG iyor:PRES um:P1SG');
    expect(alt(verb('beklemek', { negative: true }))).toBe('bekle:STEM m:NEG iyor:PRES um:P1SG');
  });

  it('keine zweite Zerlegung bei Konsonantstamm, engem Auslaut, anderen Zeiten und Nomen', () => {
    expect(alt(verb('gelmek'))).toBeUndefined();
    expect(alt(verb('okumak'))).toBeUndefined();
    expect(alt(verb('beklemek', { tense: 'future' }))).toBeUndefined();
    expect(alt(verb('beklemek', { passive: true }))).toBeUndefined();
    expect(alt({ kind: 'noun', lemma: 'ev', tags: ['LOC'] })).toBeUndefined();
  });

  it('segmentCandidates trägt sie als alt_segments ein', () => {
    const unit = makeUnit([
      {
        id: 'a1-u03-l2-e1',
        type: 'conjugation',
        mode: 'verb',
        lemma: 'beklemek',
        person: '1sg',
        target: 'bekliyorum',
      },
      {
        id: 'a1-u03-l2-e2',
        type: 'conjugation',
        mode: 'verb',
        lemma: 'gelmek',
        person: '1sg',
        target: 'geliyorum',
      },
    ]);
    const [wait, come] = segmentCandidates(unit, vocab);
    expect(segs(wait!)).toBe('bekl:STEM iyor:PRES um:P1SG');
    expect(wait!.alt_segments?.map((p) => p.text)).toEqual(['bekli', 'yor', 'um']);
    expect(come).not.toHaveProperty('alt_segments');
  });
});

describe('isAmbiguous', () => {
  const check = (lemma: string, tags: ('PL' | 'ACC' | 'POSS_1PL' | 'ABL' | 'POSS_3SG')[]) => {
    const spec = { kind: 'noun' as const, lemma, tags };
    return isAmbiguous(spec, solveForm(spec, vocab), vocab);
  };

  it('erkennt Formen mit mehreren Lesarten', () => {
    expect(check('ev', ['PL', 'ACC'])).toBe(true); // evleri: auch PL+POSS_3SG, POSS_3PL
    expect(check('ev', ['ACC'])).toBe(true); // evi: auch POSS_3SG
  });

  it('lässt eindeutige Formen durch', () => {
    expect(check('ev', ['PL', 'POSS_1PL', 'ABL'])).toBe(false);
    expect(check('kitap', ['PL'])).toBe(false);
  });

  it('vergleicht Kopula mit den Nomenformen (evim: mein Haus / ich bin ein Haus)', () => {
    const spec = { kind: 'copula' as const, lemma: 'ev', person: '1sg' as const };
    expect(isAmbiguous(spec, solveForm(spec, vocab), vocab)).toBe(true);
  });

  it('vergleicht Nomen ohne Bedeutung mit der Kopula (kitabım), mit Bedeutung nicht', () => {
    const spec = { kind: 'noun' as const, lemma: 'kitap', tags: ['POSS_1SG' as const] };
    const inf = solveForm(spec, vocab);
    expect(isAmbiguous(spec, inf, vocab)).toBe(true);
    expect(isAmbiguous(spec, inf, vocab, { glossed: true })).toBe(false);
    // kitaplar: Kopula 3. Person Plural zählt nicht (wie in den Kopula-Tabellen)
    expect(check('kitap', ['PL'])).toBe(false);
  });

  it('nimmt abgeleitete Stämme heraus (evli = ev-li)', () => {
    const withEvli: Vocab[] = [...vocab, { tr: 'evli', de: ['verheiratet'], pos: 'adj' }];
    const spec = { kind: 'copula' as const, lemma: 'evli', person: '2sg' as const, question: true };
    expect(isAmbiguous(spec, solveForm(spec, withEvli), withEvli)).toBe(true);
    const plain = { kind: 'copula' as const, lemma: 'ev', person: '2sg' as const, question: true };
    expect(isAmbiguous(plain, solveForm(plain, withEvli), withEvli)).toBe(false);
  });
});

describe('segmentCandidates', () => {
  it('erzeugt Übungen mit stabiler ID, Quelle und Formangabe', () => {
    const unit = makeUnit([builder(1, 'ev', ['PL', 'POSS_1PL', 'ABL'], 'evlerimizden')]);
    const [ex] = segmentCandidates(unit, vocab);
    expect(ex).toMatchObject({
      id: 'a1-u03-z1-l2-e1',
      type: 'segment',
      word: 'evlerimizden',
      from: 'a1-u03-l2-e1',
      analysis: { kind: 'noun', lemma: 'ev', tags: ['PL', 'POSS_1PL', 'ABL'] },
      gloss_de: 'Form 1',
    });
    expect(segs(ex!)).toBe('ev:STEM ler:PL imiz:POSS_1PL den:ABL');
  });

  it('lässt mehrdeutige, doppelte und vokallose Formen aus', () => {
    const unit = makeUnit([
      builder(1, 'ev', ['PL', 'ACC'], 'evleri'),
      builder(2, 'ev', ['LOC'], 'evde'),
      builder(3, 'ev', ['LOC'], 'evde'),
      {
        id: 'a1-u03-l2-e4',
        type: 'conjugation',
        mode: 'verb',
        lemma: 'yemek',
        person: '1sg',
        target: 'yiyorum',
      },
    ]);
    expect(segmentCandidates(unit, vocab).map((e) => e.word)).toEqual(['evde']);
  });

  it('lässt Verben mit Mehrwort-Stamm aus (seyahat ed-eceğ-iz)', () => {
    const unit = makeUnit([
      {
        id: 'a1-u03-l2-e1',
        type: 'conjugation',
        mode: 'verb',
        lemma: 'seyahat etmek',
        person: '1pl',
        tense: 'future',
        target: 'seyahat edeceğiz',
      },
    ]);
    const travel = [
      ...vocab,
      { tr: 'seyahat etmek', de: ['reisen'], pos: 'verb' as const, softens: true },
    ];
    expect(segmentCandidates(unit, travel)).toEqual([]);
  });

  it('nimmt Tabellenzeilen mit Zeilennummer in der ID, ohne Bedeutung', () => {
    const unit = makeUnit([
      {
        id: 'a1-u03-l2-e1',
        type: 'paradigm',
        kind: 'verb',
        lemma: 'gelmek',
        persons: ['1sg', '2sg'],
        targets: ['geliyorum', 'geliyorsun'],
        gloss_de: 'kommen',
      },
    ]);
    const out = segmentCandidates(unit, vocab);
    expect(out.map((e) => e.id)).toEqual(['a1-u03-z1-l2-e1-r1', 'a1-u03-z1-l2-e1-r2']);
    expect(out[1]!.analysis).toEqual({ kind: 'verb', lemma: 'gelmek', person: '2sg' });
    expect(out[1]!.gloss_de).toBeUndefined();
  });

  it('erbt Prüfstand und Herkunft der Quelle', () => {
    const src = { ...builder(1, 'ev', ['LOC'], 'evde'), reviewed: true, source: 'Q' } as Exercise;
    expect(segmentCandidates(makeUnit([src]), vocab)[0]).toMatchObject({
      reviewed: true,
      source: 'Q',
    });
  });
});

describe('segmentLesson', () => {
  const STEMS = ['ev', 'kitap', 'oğul'] as const;
  const many = (n: number) =>
    Array.from({ length: n }, (_, i) => {
      const tags = [['PL', 'LOC'], ['PL', 'ABL'], ['PL', 'DAT'], ['LOC']][i % 4]!;
      const stem = STEMS[Math.floor(i / 4) % STEMS.length]!;
      return builder(
        i + 1,
        stem,
        tags,
        solveForm({ kind: 'noun', lemma: stem, tags: tags as never }, vocab).form,
      );
    });

  it('wählt höchstens SEGMENT_WORDS Formen, bevorzugt mehrere Endungen', () => {
    const lesson = segmentLesson(makeUnit(many(12)), 'Zerlegen', vocab)!;
    expect(lesson).toMatchObject({ id: 'a1-u03-z1', type: 'segmenting', title: 'Zerlegen' });
    expect(lesson.exercises).toHaveLength(SEGMENT_WORDS);
    const rich = lesson.exercises.filter((e) => e.type === 'segment' && e.segments.length >= 3);
    expect(rich).toHaveLength(SEGMENT_WORDS); // 9 Formen mit zwei Endungen reichen
  });

  it('bleibt stabil, wenn Übungen angehängt werden', () => {
    const base = segmentLesson(makeUnit(many(12)), 'Z', vocab)!.exercises.map((e) => e.id);
    const more = segmentLesson(
      makeUnit(
        many(12),
        [builder(50, 'ev', ['PL', 'POSS_1PL', 'ABL'], 'evlerimizden')].map((e) => ({
          ...e,
          id: 'a1-u03-l3-e1',
        })),
      ),
      'Z',
      vocab,
    )!.exercises.map((e) => e.id);
    // höchstens ein Eintrag wird verdrängt
    expect(base.filter((id) => !more.includes(id)).length).toBeLessThanOrEqual(1);
  });

  it('fügt die Lektion vor der Wiederholung ein; ohne Grammatik keine Lektion', () => {
    const unit = withSegments(makeUnit(many(3)), 'Z', vocab);
    expect(unit.lessons.map((l) => l.id)).toEqual(['a1-u03-l2', 'a1-u03-z1', 'a1-u03-l4']);
    const plain = makeUnit([
      { id: 'a1-u03-l2-e1', type: 'free_text', direction: 'de_tr', prompt: 'x', answers: ['ev'] },
    ]);
    expect(withSegments(plain, 'Z', vocab)).toBe(plain);
  });
});

describe('infinite Formen beim Zerlegen', () => {
  const verbal = (form: string, tags: string[] = [], more: object = {}) =>
    ({ kind: 'verbal', lemma: 'gelmek', form, tags, ...more }) as Parameters<typeof solveForm>[0];
  const ambiguous = (spec: Parameters<typeof solveForm>[0]) =>
    isAmbiguous(spec, solveForm(spec, vocab), vocab);

  it('erkennt Formen, die auch Zeitformen sind', () => {
    expect(ambiguous(verbal('PART_ACAK'))).toBe(true); // gelecek: Futur 3sg
    expect(ambiguous(verbal('VN_MA', ['POSS_1SG']))).toBe(true); // gelmem: Aorist verneint 1sg
    expect(ambiguous(verbal('VN_MA'))).toBe(true); // gelme: Imperativ verneint
    expect(ambiguous({ kind: 'verb', lemma: 'gelmek', person: '3sg', tense: 'future' })).toBe(true);
  });

  it('lässt eindeutige Formen durch', () => {
    expect(ambiguous(verbal('PART_DIK', ['POSS_1SG', 'ACC']))).toBe(false); // geldiğimi
    expect(ambiguous(verbal('CV_INCA'))).toBe(false); // gelince
    expect(ambiguous(verbal('PART_AN', ['PL', 'DAT']))).toBe(false); // gelenlere
  });

  it('segmentCandidates nimmt verbale Suffix-Builder auf', () => {
    const unit = makeUnit([
      {
        id: 'a1-u03-l2-e1',
        type: 'suffix_builder',
        stem: 'okumak',
        verbal: 'PART_DIK',
        suffixes: ['POSS_1SG', 'ACC'],
        target: 'okuduğumu',
      } as Exercise,
    ]);
    const [ex] = segmentCandidates(unit, vocab);
    expect(segs(ex!)).toBe('oku:STEM duğ:PART_DIK um:POSS_1SG u:ACC');
    expect(ex!.analysis).toEqual({
      kind: 'verbal',
      lemma: 'okumak',
      form: 'PART_DIK',
      tags: ['POSS_1SG', 'ACC'],
    });
  });
});
