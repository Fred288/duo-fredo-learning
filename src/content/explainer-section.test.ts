import { describe, expect, it } from 'vitest';
import { explainerSections, sectionFor } from './explainer-section';
import type { Exercise } from './schema';

const md = `# Wo genau?

Einleitung ohne Abschnitt.

## Ortsnomina: auf, unter

- Kitap masa**nın** üst**ü**n**de**.
- Kedi yatağın altında.

## mit: ile / -le, -la

- otobüs**le**, araba**yla**, annesi**yle**

## für und wie: için, gibi

| Nomen      | Pronomen   |
| ---------- | ---------- |
| annem için | benim için |
`;

describe('explainerSections', () => {
  it('teilt an ##-Überschriften, ohne Titel und Einleitung', () => {
    const s = explainerSections(md);
    expect(s.map((x) => x.title)).toEqual([
      'Ortsnomina: auf, unter',
      'mit: ile / -le, -la',
      'für und wie: için, gibi',
    ]);
    expect(s[1]!.body).toBe('- otobüs**le**, araba**yla**, annesi**yle**');
  });
});

describe('sectionFor', () => {
  const sb = (stem: string, target: string): Exercise => ({
    id: 'x',
    type: 'suffix_builder',
    stem,
    suffixes: ['INS'],
    target,
  });

  it('findet den Abschnitt über Wörter der Lösung, auch mit Fett und Apostroph', () => {
    const wb: Exercise = {
      id: 'x',
      type: 'word_bank',
      prompt: 'Das Buch liegt auf dem Tisch.',
      answers: ['Kitap masanın üstünde.'],
    };
    expect(sectionFor(md, wb)?.title).toBe('Ortsnomina: auf, unter');
    expect(sectionFor(md, sb('araba', 'arabayla'))?.title).toBe('mit: ile / -le, -la');
  });

  it('erkennt gebeugte Formen am längsten Wortanfang (annesiyle → annesi)', () => {
    expect(sectionFor(md, sb('anne', 'annesiyle'))?.title).toBe('mit: ile / -le, -la');
  });

  it('der Lektionstitel entscheidet, wenn er zur Überschrift passt', () => {
    // annemle steht nirgends, annem nur bei için; der Titel „mit (ile, -le)“ gibt den Ausschlag.
    expect(sectionFor(md, sb('anne', 'annemle'))?.title).toBe('für und wie: için, gibi');
    expect(sectionFor(md, sb('anne', 'annemle'), 'mit (ile, -le)')?.title).toBe(
      'mit: ile / -le, -la',
    );
    // Füllwörter im Titel zählen nicht.
    expect(sectionFor(md, sb('ev', 'evle'), 'Haus und Garten')).toBeUndefined();
  });

  it('ohne passenden Abschnitt nichts', () => {
    const mc: Exercise = {
      id: 'x',
      type: 'multiple_choice',
      prompt: 'Was heißt „merhaba“?',
      options: ['Hallo', 'Tschüs'],
      answer: 'Hallo',
    };
    expect(sectionFor(md, mc)).toBeUndefined();
    expect(sectionFor('', mc)).toBeUndefined();
  });
});
