import { describe, expect, it } from 'vitest';
import { grade, wordBankTokens } from './grade';

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
