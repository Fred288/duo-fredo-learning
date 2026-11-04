import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import { clearLookupCache } from '../content/load';
import type { Selection } from '../flashcards/deck';
import { useFlashcards } from '../store/flashcards';
import { useProgress } from '../store/progress';
import { FlashcardsRunScreen } from './FlashcardsRunScreen';

const manifest = {
  units: [
    {
      id: 'a1-u01',
      level: 'A1',
      title: 'Erste Unit',
      unreviewed: 0,
      lessons: [
        {
          id: 'a1-u01-l1',
          type: 'vocab',
          title: 'Erste Lektion',
          vocab: ['ev', 'kitap'],
          phrases: ['a1-u01-l1-e2'],
        },
      ],
      vocab: ['ev', 'kitap'],
    },
  ],
};
const lookup = {
  v: 1,
  units: [{ id: 'a1-u01', title: 'Erste Unit' }],
  vocab: [
    { id: 'ev', tr: 'ev', de: ['Haus'], pos: 'noun', unit: 'a1-u01' },
    { id: 'kitap', tr: 'kitap', de: ['Buch'], pos: 'noun', unit: 'a1-u01', softens: true },
  ],
  sections: [],
};
const unit = {
  id: 'a1-u01',
  level: 'A1',
  title: 'Erste Unit',
  lessons: [
    {
      id: 'a1-u01-l1',
      type: 'vocab',
      title: 'Erste Lektion',
      exercises: [
        {
          id: 'a1-u01-l1-e2',
          type: 'word_bank',
          prompt: 'Wie geht es dir?',
          answers: ['Nasılsın?'],
          hint: 'Unter Freunden',
        },
      ],
    },
  ],
};

const selection = (content: Selection['content']): Selection => ({
  scope: { scope: 'unit', unitId: 'a1-u01' },
  content,
  dir: 'tr_de',
  order: 'course',
});

beforeEach(() => {
  clearLookupCache();
  vi.stubGlobal(
    'fetch',
    vi.fn(async (url: string) => {
      const body = url.endsWith('index.json')
        ? manifest
        : url.endsWith('lookup.json')
          ? lookup
          : unit;
      return new Response(JSON.stringify(body));
    }),
  );
  useProgress.setState({ loaded: true, completions: [] });
  useFlashcards.setState({ loaded: true, flashes: [], marks: [] });
});

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});

const click = (name: string | RegExp) => fireEvent.click(screen.getByRole('button', { name }));

it('Aufdecken: nicht gewusst kommt wieder, nur die erste Antwort wird gespeichert', async () => {
  render(<FlashcardsRunScreen selection={selection('vocab')} mode="flip" />);
  expect(await screen.findByRole('heading', { name: 'ev' })).toBeTruthy();
  expect(screen.getByText('Karte 1 von 2')).toBeTruthy();

  click('Umdrehen');
  expect(screen.getByText('Haus')).toBeTruthy();
  click('Nicht gewusst');

  expect(screen.getByRole('heading', { name: 'kitap' })).toBeTruthy();
  expect(screen.getByText(/1 noch einmal/)).toBeTruthy();
  // Leertaste deckt auf; der Formhinweis kommt aus dem Engine-Flag.
  fireEvent.keyDown(window, { key: ' ' });
  expect(screen.getByText('kitabı')).toBeTruthy();
  fireEvent.keyDown(window, { key: 'ArrowRight' });

  expect(screen.getByRole('heading', { name: 'ev' })).toBeTruthy();
  expect(screen.getByText(/Noch einmal/)).toBeTruthy();
  click('Umdrehen');
  click('Gewusst');

  expect(screen.getByText('1 sofort gewusst, 1 nach Wiederholung')).toBeTruthy();
  expect(useFlashcards.getState().flashes.map((f) => [f.ref, f.correct, f.mode])).toEqual([
    ['ev', false, 'flip'],
    ['kitap', true, 'flip'],
  ]);

  // Nur die falschen nochmal: eine neue Runde mit ev.
  click('Nur die falschen nochmal (1)');
  expect(screen.getByRole('heading', { name: 'ev' })).toBeTruthy();
  expect(screen.getByText('Karte 1 von 1')).toBeTruthy();
});

it('Eintippen: Tippfehler zählt als gewusst, Satzkarten zeigen ihren Hinweis', async () => {
  render(<FlashcardsRunScreen selection={selection('both')} mode="type" />);
  await screen.findByRole('heading', { name: 'ev' });

  const answer = () => screen.getByRole('textbox', { name: 'Deine Antwort' });
  fireEvent.change(answer(), { target: { value: 'Hause' } });
  click('Prüfen');
  expect(screen.getByText('Nicht richtig')).toBeTruthy();
  click('Weiter');

  fireEvent.change(answer(), { target: { value: 'Buch' } });
  click('Prüfen');
  expect(screen.getByText('Richtig')).toBeTruthy();
  click('Weiter');

  expect(screen.getByRole('heading', { name: 'Nasılsın?' })).toBeTruthy();
  fireEvent.change(answer(), { target: { value: 'Wie geht es dir' } });
  click('Prüfen');
  expect(screen.getByText(/Richtig|Fast richtig/)).toBeTruthy();
  expect(screen.getByText('Unter Freunden')).toBeTruthy();

  // Markieren gilt für das Wort/den Satz.
  click(/Markieren/);
  expect(screen.getByRole('button', { name: /Markieren/ }).getAttribute('aria-pressed')).toBe(
    'true',
  );
  click('Weiter');

  expect(useFlashcards.getState().flashes.map((f) => [f.kind, f.correct])).toEqual([
    ['vocab', false],
    ['vocab', true],
    ['phrase', true],
  ]);
});
