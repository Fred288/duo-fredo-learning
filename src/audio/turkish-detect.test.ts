import { describe, expect, it } from 'vitest';
import type { Exercise, Unit } from '../content/schema';
import {
  annotateSpeech,
  answerIsTurkish,
  courseWords,
  isTurkish,
  turkishInPrompt,
  wordsOf,
} from './turkish-detect';

type MC = Extract<Exercise, { type: 'multiple_choice' }>;

const unit: Unit = {
  id: 'a1-u01',
  level: 'A1',
  title: 'T',
  reviewed: false,
  source: 's',
  license: 'l',
  vocab: [
    { tr: 'hala', de: ['Tante (Schwester des Vaters)'], pos: 'noun' },
    { tr: 'o', de: ['er', 'sie', 'es'], pos: 'pron' },
    { tr: 'merhaba', de: ['Hallo'], pos: 'interj' },
    { tr: 'sekiz', de: ['acht'], pos: 'num' },
  ],
  lessons: [
    {
      id: 'a1-u01-l1',
      type: 'vocab',
      title: 'L',
      exercises: [
        {
          id: 'a1-u01-l1-e1',
          type: 'word_bank',
          prompt: 'Ich bin müde.',
          answers: ['Ben yorgunum.'],
        },
      ],
    },
  ],
};
const words = courseWords([unit]);

const mc = (prompt: string, options: string[], answer = options[0]!): MC => ({
  id: 'a1-u01-l1-e9',
  type: 'multiple_choice',
  prompt,
  options,
  answer,
});

describe('Türkisch erkennen', () => {
  it('Wörter klein mit trLower, Apostroph im Wort bleibt', () => {
    expect(wordsOf("İstanbul'da, „Ben“!")).toEqual(["istanbul'da", 'ben']);
  });

  it('bekannte türkische Wörter oder türkische Buchstaben', () => {
    expect(isTurkish('hala', words)).toBe(true);
    expect(isTurkish('o', words)).toBe(true);
    expect(isTurkish('Bulmuş mu?', words)).toBe(true);
    expect(isTurkish('Ben yorgunum.', words)).toBe(true);
  });

  it('deutsche Wörter und Buchstaben sind nicht türkisch', () => {
    expect(isTurkish('Hallo', words)).toBe(false);
    expect(isTurkish('Ich bin müde', words)).toBe(false);
    expect(isTurkish('Mädchen', words)).toBe(false);
    // Ein großes deutsches I wird mit trLower zu ı; zählt trotzdem nicht als türkischer Buchstabe.
    expect(isTurkish('Ich', words)).toBe(false);
    expect(isTurkish('unbekannt', words)).toBe(false);
  });

  it('nimmt türkische „…“-Teile aus dem Prompt', () => {
    expect(turkishInPrompt('Wer ist „hala“?', words)).toBe('hala');
    expect(turkishInPrompt('Was heißt „Hallo“?', words)).toBeUndefined();
    expect(turkishInPrompt('Warum „sekiz“, aber „Bulmuş“?', words)).toBe('sekiz, Bulmuş');
    expect(turkishInPrompt('Ben yorgunum.', words)).toBe('Ben yorgunum.');
    expect(turkishInPrompt('Welche Form ist richtig?', words)).toBeUndefined();
  });

  it('Antwort vorlesen nur, wenn sie türkisch ist und keine Option deutsch', () => {
    expect(answerIsTurkish(mc('Was heißt „Hallo“?', ['merhaba', 'sekiz']), words)).toBe(true);
    // falsche Formen kennt der Kurs nicht, sie sind trotzdem keine deutschen Optionen
    expect(answerIsTurkish(mc('Wer?', ['hala', 'hela']), words)).toBe(true);
    expect(answerIsTurkish(mc('Wer ist „hala“?', ['Tante', 'Onkel']), words)).toBe(false);
    expect(answerIsTurkish(mc('?', ['sekiz', 'acht']), words)).toBe(false);
  });

  it('annotateSpeech ergänzt nur fehlende Felder', () => {
    const withMc = (ex: MC): Unit => ({
      ...unit,
      lessons: [{ ...unit.lessons[0]!, exercises: [ex] }],
    });
    const first = (u: Unit) => u.lessons[0]!.exercises[0] as MC;

    const auto = first(annotateSpeech(withMc(mc('Wer ist „hala“?', ['Tante', 'Onkel'])), words));
    expect([auto.speak_prompt, auto.speak_answer]).toEqual(['hala', undefined]);

    const kept = first(
      annotateSpeech(
        withMc({
          ...mc('Wer ist „hala“?', ['merhaba', 'sekiz']),
          speak_prompt: '',
          speak_answer: false,
        }),
        words,
      ),
    );
    expect([kept.speak_prompt, kept.speak_answer]).toEqual(['', false]);
  });
});
