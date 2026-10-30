import { describe, expect, it } from 'vitest';
import type { Exercise, Vocab } from '../content/schema';
import { conjugationTiles } from './conjugation-tiles';
import { grade } from './grade';

type Conj = Extract<Exercise, { type: 'conjugation' }>;
const conj = (extra: Partial<Conj>): Conj => ({
  id: 'x-1',
  type: 'conjugation',
  mode: 'verb',
  lemma: 'gelmek',
  person: '1sg',
  target: 'geliyorum',
  ...extra,
});
const opts = { tolerateDiacritics: true };

describe('conjugationTiles', () => {
  it('liefert Engine-Segmente und Harmonie-Ablenker', () => {
    const { tokens } = conjugationTiles(conj({}));
    expect(tokens).toEqual(expect.arrayContaining(['gel', 'iyor', 'um']));
    expect(tokens.length).toBeGreaterThan(3);
  });

  it('bietet bei Verneinung das unverengte -me als Ablenker', () => {
    const { tokens } = conjugationTiles(conj({ negative: true, target: 'gelmiyorum' }));
    expect(tokens).toEqual(expect.arrayContaining(['gel', 'mi', 'yor', 'um', 'me']));
  });

  it('bietet den unveränderten Stamm als Ablenker (bekle statt bekl, git statt gid)', () => {
    expect(conjugationTiles(conj({ lemma: 'beklemek', target: 'bekliyorum' })).tokens).toContain(
      'bekle',
    );
    const vocab: Vocab[] = [{ tr: 'gitmek', de: ['gehen'], pos: 'verb', softens: true }];
    expect(conjugationTiles(conj({ lemma: 'gitmek', target: 'gidiyorum' }), vocab).tokens).toEqual(
      expect.arrayContaining(['gid', 'git']),
    );
  });

  it('führt die Fragepartikel als ganzen Baustein', () => {
    const { tokens } = conjugationTiles(
      conj({ person: '2sg', question: true, target: 'geliyor musun?' }),
    );
    expect(tokens).toEqual(expect.arrayContaining(['gel', 'iyor', 'musun']));
  });
});

describe('grade conjugation', () => {
  it('ignoriert Leerzeichen zwischen Bausteinen und Fragezeichen', () => {
    const ex = conj({ person: '2sg', question: true, target: 'geliyor musun?' });
    expect(grade(ex, 'geliyormusun', opts).verdict).toBe('correct');
    expect(grade(ex, 'geliyormisin', opts).verdict).toBe('wrong');
  });

  it('Kopula mit değil und Eigennamen mit Apostroph', () => {
    const neg = conj({
      mode: 'copula',
      lemma: 'öğretmen',
      negative: true,
      target: 'öğretmen değilim',
    });
    expect(grade(neg, 'öğretmendeğilim', opts).verdict).toBe('correct');
    const name = conj({ mode: 'copula', lemma: 'Ayşe', target: "Ayşe'yim" });
    expect(grade(name, 'Ayşeyim', opts).verdict).toBe('correct');
  });
});

describe('conjugationTiles: Stufe 2', () => {
  it('Präteritum: d/t-Verwechslung und verengte Verneinung als Ablenker', () => {
    const vocab: Vocab[] = [{ tr: 'gitmek', de: ['gehen'], pos: 'verb', softens: true }];
    const { tokens } = conjugationTiles(
      conj({ lemma: 'gitmek', tense: 'past', target: 'gittim' }),
      vocab,
    );
    expect(tokens).toEqual(expect.arrayContaining(['git', 'ti', 'm', 'di']));
    const neg = conjugationTiles(conj({ tense: 'past', negative: true, target: 'gelmedim' }));
    expect(neg.tokens).toEqual(expect.arrayContaining(['gel', 'me', 'di', 'm', 'mi']));
  });

  it('Futur: unerweichtes -ecek als Ablenker', () => {
    const { tokens } = conjugationTiles(conj({ tense: 'future', target: 'geleceğim' }));
    expect(tokens).toEqual(expect.arrayContaining(['gel', 'eceğ', 'im', 'ecek']));
  });

  it('Aorist: andere Vokalklasse und gelmezim als Ablenker', () => {
    expect(conjugationTiles(conj({ tense: 'aorist', target: 'gelirim' })).tokens).toEqual(
      expect.arrayContaining(['gel', 'ir', 'im', 'er']),
    );
    expect(
      conjugationTiles(conj({ tense: 'aorist', negative: true, target: 'gelmem' })).tokens,
    ).toEqual(expect.arrayContaining(['gel', 'me', 'm', 'zim']));
  });

  it('Bewertung über die Engine-Form', () => {
    const ex = conj({ tense: 'past', person: '2sg', question: true, target: 'geldin mi?' });
    expect(grade(ex, 'geldinmi', opts).verdict).toBe('correct');
  });
});

describe('conjugationTiles: Stufe 3', () => {
  it('können: -ebil mit Harmonie-Ablenker', () => {
    const { tokens } = conjugationTiles(
      conj({ tense: 'aorist', ability: true, target: 'gelebilirim' }),
    );
    expect(tokens).toEqual(expect.arrayContaining(['gel', 'ebil', 'ir', 'im', 'abil']));
  });

  it('Kopula-Vergangenheit und Imperativ: Form ohne Puffer-y als Ablenker', () => {
    const past = conjugationTiles(
      conj({ mode: 'copula', lemma: 'öğrenci', tense: 'past', target: 'öğrenciydim' }),
    );
    expect(past.tokens).toEqual(expect.arrayContaining(['öğrenci', 'ydi', 'm', 'di']));
    const imp = conjugationTiles(
      conj({ lemma: 'okumak', person: '2pl', tense: 'imperative', target: 'okuyun' }),
    );
    expect(imp.tokens).toEqual(expect.arrayContaining(['oku', 'yun', 'un']));
  });
});

describe('Nebenformen (alt_targets)', () => {
  it('zählt geliyordular neben geliyorlardı', () => {
    const ex = conj({
      person: '3pl',
      compound: 'past',
      target: 'geliyorlardı',
      alt_targets: ['geliyordular'],
    });
    expect(grade(ex, 'geliyorlardı', opts).matched).toBe('geliyorlardı');
    expect(grade(ex, 'geliyordular', opts)).toMatchObject({
      verdict: 'correct',
      matched: 'geliyordular',
    });
    expect(grade(ex, 'geliyorlardılar', opts).verdict).toBe('wrong');
  });

  it('kein zim-Ablenker bei gelmezdim', () => {
    const ex = conj({ tense: 'aorist', compound: 'past', negative: true, target: 'gelmezdim' });
    expect(conjugationTiles(ex).tokens).not.toContain('zim');
  });
});

describe('B2-Bausteine', () => {
  it('Kausativ: eigener Baustein mit d/t-Verwechslung', () => {
    const ex = conj({ lemma: 'yapmak', causative: true, target: 'yaptırıyorum' });
    const { tokens } = conjugationTiles(ex);
    expect(tokens).toEqual(expect.arrayContaining(['yap', 'tır', 'dır']));
  });

  it('bewertet -mekte und -dir am Verb', () => {
    const ex = conj({ tense: 'evidential', dir: true, person: '3sg', target: 'gelmiştir' });
    expect(conjugationTiles(ex).tokens).toEqual(expect.arrayContaining(['gel', 'miş', 'tir']));
    expect(grade(ex, 'gelmiştir', opts).verdict).toBe('correct');
  });
});

describe('Ablenker beim Kausativ auf Vokal', () => {
  it('keine d/t-Vertauschung, wenn der Baustein nicht mit d/t beginnt', () => {
    const vocab: Vocab[] = [{ tr: 'çıkmak', de: ['x'], pos: 'verb', causative: 'ar' }];
    const ex = conj({ lemma: 'çıkmak', causative: true, target: 'çıkarıyorum' });
    const { tokens } = conjugationTiles(ex, vocab);
    expect(tokens).toContain('ar');
    expect(tokens).not.toContain('tr');
  });
});
