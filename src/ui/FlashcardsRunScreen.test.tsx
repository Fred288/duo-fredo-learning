import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import { FakeSpeaker } from '../audio/fake';
import { clearLookupCache } from '../content/load';
import type { Selection } from '../flashcards/deck';
import type { Card } from '../srs/card';
import { setSpeaker } from '../store/audio';
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
  forms: { intro: { 'noun:ACC': 'a1-u01-l1' }, nouns: ['kitap'], verbs: [] },
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
  flash: {
    examples: {
      ev: {
        tr: 'Evim büyük.',
        de: 'Mein Haus ist groß.',
        from: 'a1-u01-l1-e5',
        tokens: [
          { text: 'Evim', w: true, vocab: 'ev' },
          { text: ' ' },
          { text: 'büyük', w: true },
          { text: '.' },
        ],
      },
    },
    phrases: {
      'a1-u01-l1-e2': [{ text: 'Nasılsın', w: true, gloss: 'wie geht es dir' }, { text: '?' }],
    },
  },
};

const selection = (content: Selection['content'], over: Partial<Selection> = {}): Selection => ({
  scope: { scope: 'unit', unitId: 'a1-u01' },
  content,
  dir: 'tr_de',
  order: 'course',
  ...over,
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
  setSpeaker(new FakeSpeaker('unsupported'));
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

it('Hörkarte: vorn nur der Ton, die Lösung erscheint erst nach dem Aufdecken', async () => {
  const speaker = new FakeSpeaker('ready');
  setSpeaker(speaker);
  render(<FlashcardsRunScreen selection={selection('vocab', { dir: 'listen' })} mode="flip" />);

  expect(await screen.findByRole('heading', { name: 'Was bedeutet das?' })).toBeTruthy();
  expect(screen.queryByText('ev')).toBeNull();
  expect(screen.getByRole('button', { name: /Anhören|Vorlesen/ })).toBeTruthy();

  click('Umdrehen');
  expect(screen.getByText('ev')).toBeTruthy();
  expect(screen.getByText('Haus')).toBeTruthy();
});

it('Hörkarte ohne Stimme fällt auf Türkisch → Deutsch zurück', async () => {
  render(<FlashcardsRunScreen selection={selection('vocab', { dir: 'listen' })} mode="flip" />);
  expect(await screen.findByRole('heading', { name: 'ev' })).toBeTruthy();
});

it('Schwer-Stapel: nur Wörter mit Fehlern im SRS', async () => {
  const hard: Card = {
    id: 'vo:tr_de:kitap',
    ref: { kind: 'vocab', vocabId: 'kitap', dir: 'tr_de' },
    unitId: 'a1-u01',
    box: 1,
    due: '2026-11-04',
    introduced: '2026-11-01',
    lastAt: 0,
    lapses: 2,
  };
  useProgress.setState({ cards: [hard] });
  render(
    <FlashcardsRunScreen selection={selection('both', { scope: { scope: 'hard' } })} mode="flip" />,
  );
  expect(await screen.findByRole('heading', { name: 'kitap' })).toBeTruthy();
  expect(screen.getByText('Karte 1 von 1')).toBeTruthy();
});

it('Rückseite: Beispielsatz und Satzwörter antippbar, Tasten im Sheet bewerten nicht', async () => {
  render(<FlashcardsRunScreen selection={selection('both')} mode="flip" />);
  await screen.findByRole('heading', { name: 'ev' });
  click('Umdrehen');

  // Beispielsatz: aufgelöstes Wort ist ein Knopf, unaufgelöstes nur Text.
  expect(screen.getByText('Beispiel')).toBeTruthy();
  expect(screen.getByText('Mein Haus ist groß.')).toBeTruthy();
  expect(screen.queryByRole('button', { name: 'büyük' })).toBeNull();
  click('Evim');
  const sheet = await screen.findByRole('dialog');
  fireEvent.keyDown(sheet, { key: 'ArrowRight' });
  expect(document.querySelector('[data-card]')?.getAttribute('data-card')).toBe('vocab:ev:tr_de');
  expect(useFlashcards.getState().flashes).toEqual([]);
  fireEvent.keyDown(window, { key: 'Escape' });
  expect(screen.queryByRole('dialog')).toBeNull();

  click('Gewusst');
  click('Umdrehen');
  click('Gewusst');
  // Satzkarte (tr→de): nach dem Aufdecken sind die Wörter vorn antippbar.
  expect(screen.queryByRole('button', { name: 'Nasılsın' })).toBeNull();
  click('Umdrehen');
  click('Nasılsın');
  expect((await screen.findByRole('dialog')).textContent).toContain('wie geht es dir');
});

it('Formkarte: Grundform und Angabe vorn, Form ohne Tippfehler-Toleranz', async () => {
  render(<FlashcardsRunScreen selection={selection('form')} mode="type" />);
  expect(await screen.findByRole('heading', { name: 'kitap Akkusativ' })).toBeTruthy();
  expect(screen.getByText('Formen')).toBeTruthy();

  // kitapı statt kitabı: in Grammatik kein Tippfehler, sondern falsch.
  fireEvent.change(screen.getByRole('textbox', { name: 'Deine Antwort' }), {
    target: { value: 'kitapı' },
  });
  click('Prüfen');
  expect(screen.getByText('Nicht richtig')).toBeTruthy();
  expect(screen.getByText('kitabı')).toBeTruthy();
  expect(screen.getByText('kitap = Buch')).toBeTruthy();
  click('Weiter');
  expect(useFlashcards.getState().flashes.map((f) => [f.kind, f.ref, f.dir, f.correct])).toEqual([
    ['form', 'kitap|noun:ACC', 'de_tr', false],
  ]);
});
