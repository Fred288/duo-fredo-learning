import { describe, expect, it } from 'vitest';
import type { Exercise } from '../content/schema';
import { grade, paradigmCells, solutionOf, wordBankTokens } from './grade';

const opts = { tolerateDiacritics: false };

describe('grade', () => {
  it('Multiple Choice vergleicht die gewählte Option', () => {
    const ex = {
      id: 'x',
      type: 'multiple_choice' as const,
      prompt: 'Hallo',
      options: ['Merhaba', 'Hayır'],
      answer: 'Merhaba',
    };
    expect(grade(ex, 'Merhaba', opts).verdict).toBe('correct');
    expect(grade(ex, 'Hayır', opts).verdict).toBe('wrong');
  });

  it('Wortbank toleriert Satzzeichen, aber keine Tippfehler', () => {
    const ex = {
      id: 'x',
      type: 'word_bank' as const,
      prompt: 'Ich trinke Tee.',
      answers: ['Ben çay içiyorum.', 'Çay içiyorum.'],
    };
    expect(grade(ex, 'Ben çay içiyorum', opts).verdict).toBe('correct');
    expect(grade(ex, 'Çay içiyorum', opts).verdict).toBe('correct');
    expect(grade(ex, 'çay ben içiyorum', opts).verdict).toBe('wrong');
  });

  it('Freitext beachtet die Sonderzeichen-Einstellung', () => {
    const ex = {
      id: 'x',
      type: 'free_text' as const,
      direction: 'de_tr' as const,
      prompt: 'Danke',
      answers: ['Teşekkürler'],
    };
    expect(grade(ex, 'tesekkurler', opts).verdict).toBe('almost');
    expect(grade(ex, 'tesekkurler', { tolerateDiacritics: true }).verdict).toBe('correct');
  });
});

describe('wordBankTokens', () => {
  const ex = {
    id: 'a1-u01-l1-e2',
    type: 'word_bank' as const,
    prompt: 'Guten Morgen!',
    answers: ['Ben çay içiyorum.'],
    distractors: ['su'],
  };

  it('enthält Lösungswörter ohne Satzzeichen und Ablenker', () => {
    expect([...wordBankTokens(ex)].sort()).toEqual(['Ben', 'su', 'çay', 'içiyorum'].sort());
  });

  it('mischt deterministisch je Übungs-ID', () => {
    expect(wordBankTokens(ex)).toEqual(wordBankTokens(ex));
  });
});

describe('grade paradigm', () => {
  type Par = Extract<Exercise, { type: 'paradigm' }>;
  const ex: Par = {
    id: 'x-p',
    type: 'paradigm',
    kind: 'noun',
    lemma: 'ev',
    rows: [['LOC'], ['DAT'], ['ABL']],
    targets: ['evde', 'eve', 'evden'],
  };

  it('ist nur richtig, wenn jede Zelle stimmt', () => {
    expect(grade(ex, 'evde\neve\nevden', { tolerateDiacritics: true }).verdict).toBe('correct');
    expect(grade(ex, 'evde\neva\nevden', { tolerateDiacritics: true }).verdict).toBe('wrong');
    expect(paradigmCells(ex, 'evde\neva\nevden')).toEqual([true, false, true]);
  });

  it('ignoriert Leerzeichen, Apostroph und Groß/Klein (I gilt als İ)', () => {
    const cop: Par = {
      ...ex,
      kind: 'copula',
      lemma: 'Alman',
      rows: undefined,
      persons: ['1sg', '2sg'],
      question: true,
      targets: ['Alman mıyım?', 'Alman mısın?'],
    };
    expect(paradigmCells(cop, 'Almanmıyım\nalman misin')).toEqual([true, false]);
    const city: Par = {
      ...ex,
      lemma: 'İstanbul',
      targets: ["İstanbul'da", "İstanbul'a", "İstanbul'dan"],
    };
    // Groß/Klein egal, deutsches I gilt als İ; falsche Harmonie bleibt falsch.
    expect(paradigmCells(city, "Istanbul'da\nistanbula\nİstanbul'den")).toEqual([
      true,
      true,
      false,
    ]);
    expect(solutionOf(ex)).toBe('evde, eve, evden');
  });
});
