import { describe, expect, it } from 'vitest';
import type { Exercise } from '../content/schema';
import { speakables } from './speakables';

const base = { id: 'a1-u01-l1-e1' };

describe('speakables', () => {
  it('Multiple Choice laut speak_prompt/speak_answer', () => {
    const ex: Exercise = {
      ...base,
      type: 'multiple_choice',
      prompt: 'Wer ist „hala“?',
      options: ['Tante', 'Onkel'],
      answer: 'Tante',
      speak_prompt: 'hala',
    };
    expect(speakables(ex)).toEqual({ prompt: 'hala', solution: undefined });
    expect(speakables({ ...ex, speak_prompt: '' }).prompt).toBeUndefined();
    expect(speakables({ ...ex, speak_answer: true }).solution).toBe('Tante');
  });

  it('Wortbank und Freitext de→tr: Lösung, bevorzugt die getroffene Variante', () => {
    const wb: Exercise = {
      ...base,
      type: 'word_bank',
      prompt: 'Einen Tee, bitte.',
      answers: ['Bir çay lütfen.', 'Bir çay.'],
    };
    expect(speakables(wb)).toEqual({ solution: 'Bir çay lütfen.' });
    expect(speakables(wb, 'Bir çay.')).toEqual({ solution: 'Bir çay.' });
    const ft: Exercise = {
      ...base,
      type: 'free_text',
      direction: 'de_tr',
      prompt: 'zehn',
      answers: ['on'],
    };
    expect(speakables(ft)).toEqual({ solution: 'on' });
  });

  it('Freitext tr→de: Prompt', () => {
    const ft: Exercise = {
      ...base,
      type: 'free_text',
      direction: 'tr_de',
      prompt: 'Erken yatmalısın.',
      answers: ['Du musst früh ins Bett gehen.'],
    };
    expect(speakables(ft)).toEqual({ prompt: 'Erken yatmalısın.' });
  });

  it('Grammatik: target, Tabelle nichts, Hören: Text', () => {
    expect(
      speakables({
        ...base,
        type: 'suffix_builder',
        stem: 'ev',
        suffixes: ['LOC'],
        target: 'evde',
      }),
    ).toEqual({ solution: 'evde' });
    expect(
      speakables({
        ...base,
        type: 'paradigm',
        kind: 'noun',
        lemma: 'ev',
        rows: [['PL'], ['LOC']],
        targets: ['evler', 'evde'],
      }),
    ).toEqual({});
    expect(speakables({ ...base, type: 'listen', mode: 'dictation', text: 'Günaydın!' })).toEqual({
      prompt: 'Günaydın!',
      solution: 'Günaydın!',
    });
  });
});
