import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import type { Lesson } from '../content/schema';
import { LessonRunner } from './LessonRunner';

afterEach(cleanup);

const lesson: Lesson = {
  id: 'a1-u01-l1',
  type: 'vocab',
  title: 'Test',
  exercises: [
    {
      id: 'a1-u01-l1-e1',
      type: 'multiple_choice',
      prompt: 'Was heißt „Hallo“?',
      options: ['Merhaba', 'Hayır'],
      answer: 'Merhaba',
    },
    {
      id: 'a1-u01-l1-e2',
      type: 'free_text',
      direction: 'de_tr',
      prompt: 'Danke',
      answers: ['Teşekkürler'],
      hint: '„Sağ ol“ ist informell.',
    },
    // Noch nicht unterstützt (M5) → wird übersprungen
    { id: 'a1-u01-l1-e3', type: 'suffix_builder', stem: 'ev', suffixes: ['LOC'], target: 'evde' },
  ],
};

const click = (name: string | RegExp) => fireEvent.click(screen.getByRole('button', { name }));

describe('LessonRunner', () => {
  it('führt durch die Lektion, wiederholt Fehler und zeigt das Ergebnis', () => {
    const onExit = vi.fn();
    render(<LessonRunner lesson={lesson} onExit={onExit} />);

    // MC falsch → Feedback mit Lösung, Wiederholung angekündigt
    fireEvent.click(screen.getByLabelText(/Hayır/));
    click('Prüfen');
    expect(screen.getByRole('status').textContent).toContain('Leider falsch.');
    expect(screen.getByRole('status').textContent).toContain('Lösung: Merhaba');
    expect(screen.getByRole('status').textContent).toContain('noch einmal');
    click('Weiter');

    // Freitext mit Sonderzeichen-Leiste
    const input = screen.getByLabelText('Deine Antwort');
    fireEvent.change(input, { target: { value: 'Te' } });
    click('ş einfügen');
    fireEvent.change(input, { target: { value: 'Teşekkürler' } });
    click('Prüfen');
    expect(screen.getByRole('status').textContent).toContain('Richtig!');
    click('Weiter');

    // Wiederholung der MC-Aufgabe
    fireEvent.click(screen.getByLabelText(/Merhaba/));
    click('Prüfen');
    click('Weiter');

    expect(screen.getByRole('heading', { name: 'Lektion geschafft' })).toBeTruthy();
    expect(screen.getByText('1 von 2 beim ersten Versuch richtig')).toBeTruthy();
    click('Zur Übersicht');
    expect(onExit).toHaveBeenCalled();
  });

  it('erlaubt Prüfen erst mit Antwort', () => {
    render(<LessonRunner lesson={lesson} onExit={() => {}} />);
    expect(screen.getByRole('button', { name: 'Prüfen' }).hasAttribute('disabled')).toBe(true);
  });

  it('prüft mit Enter, auch wenn der angetippte Baustein den Fokus hält', () => {
    const wb: Lesson = {
      ...lesson,
      exercises: [
        {
          id: 'a1-u01-l1-e9',
          type: 'word_bank',
          prompt: 'Guten Morgen!',
          answers: ['Günaydın!'],
          distractors: ['İyi'],
        },
      ],
    };
    render(<LessonRunner lesson={wb} onExit={() => {}} />);
    const tile = screen.getByRole('button', { name: 'Günaydın' });
    fireEvent.click(tile);
    expect(tile.hasAttribute('disabled')).toBe(true);
    fireEvent.keyDown(tile, { key: 'Enter' });
    expect(screen.getByRole('status').textContent).toContain('Richtig!');
  });

  it('wählt MC-Optionen per Zifferntaste und prüft mit Enter', () => {
    render(<LessonRunner lesson={lesson} onExit={() => {}} />);
    fireEvent.keyDown(window, { key: '1' });
    fireEvent.keyDown(window, { key: 'Enter' });
    expect(screen.getByRole('status').textContent).toContain('Richtig!');
  });
});
