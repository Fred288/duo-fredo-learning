import 'fake-indexeddb/auto';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { LookupIndex } from '../lookup/types';
import { cardId, type Card } from '../srs';
import { useApp } from '../store/app';
import { useProgress } from '../store/progress';
import { dayKey } from '../progress/day';
import { clearLookupCache } from '../content/load';
import { LookupScreen } from './LookupScreen';

const index: LookupIndex = {
  v: 1,
  units: [{ id: 'a1-u02', title: 'Vokalharmonie', explainer: 'explainers/a1-vokalharmonie.md' }],
  vocab: [
    { id: 'ev', tr: 'ev', de: ['Haus'], pos: 'noun', unit: 'a1-u02' },
    { id: 'kitap', tr: 'kitap', de: ['Buch'], pos: 'noun', unit: 'a1-u02', softens: true },
    { id: 'yemek', tr: 'yemek', de: ['essen'], pos: 'verb', unit: 'a1-u02' },
  ],
  sections: [
    { unit: 'a1-u02', title: 'Der Lokativ', slug: 'der-lokativ', words: ['der', 'lokativ'] },
  ],
};

const reviewCard: Card = {
  id: cardId({ kind: 'vocab', vocabId: 'ev', dir: 'tr_de' }),
  ref: { kind: 'vocab', vocabId: 'ev', dir: 'tr_de' },
  unitId: 'a1-u02',
  box: 2,
  due: '2000-01-01',
  introduced: '2000-01-01',
  lastAt: 0,
  lapses: 0,
};

beforeEach(() => {
  vi.stubGlobal(
    'fetch',
    vi.fn(async () => new Response(JSON.stringify(index), { status: 200 })),
  );
  useApp.setState({ screen: { name: 'lookup' }, lookupQuery: '', lookupEntry: undefined });
  useProgress.setState({ cards: [reviewCard] });
});
afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});

const type = async (text: string) => {
  fireEvent.change(await screen.findByRole('searchbox'), { target: { value: text } });
};

describe('LookupScreen', () => {
  it('zeigt ohne Suchtext das Register der Grammatik-Abschnitte', async () => {
    render(<LookupScreen />);
    expect(await screen.findByText('Grammatik nach Unit')).toBeTruthy();
    expect(screen.getByText('Vokalharmonie')).toBeTruthy();
  });

  it('findet türkisch ohne Sonderzeichen und deutsch', async () => {
    render(<LookupScreen />);
    await type('KITAP');
    expect(await screen.findByText('Buch · Nomen')).toBeTruthy();
    await type('haus');
    expect(await screen.findByText('Haus · Nomen')).toBeTruthy();
  });

  it('zeigt bei gebeugter Eingabe die Herkunft der Form', async () => {
    render(<LookupScreen />);
    await type('evlerde');
    expect(await screen.findByText('evlerde = Plural + Lokativ')).toBeTruthy();
    expect(screen.getByRole('status').textContent).toBe('1 Treffer');
  });

  it('meldet, wenn nichts gefunden wird', async () => {
    render(<LookupScreen />);
    await type('xyzzy');
    expect(await screen.findByText('Nichts gefunden.')).toBeTruthy();
  });

  it('Enter öffnet den ersten Treffer mit Formtabelle und Wiederholen-Stand', async () => {
    render(<LookupScreen />);
    await type('ev');
    fireEvent.keyDown(screen.getByRole('searchbox'), { key: 'Enter' });
    expect(await screen.findByRole('heading', { name: 'ev' })).toBeTruthy();
    expect(screen.getByText(/Türkisch → Deutsch: Box 2 von 5, fällig/)).toBeTruthy();
    expect(screen.getByText(/Unit: Vokalharmonie/)).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Erklärkarte der Unit' })).toBeTruthy();
    expect(useApp.getState().lookupEntry).toBe('ev');
    fireEvent.click(screen.getByText('Formen'));
    expect(screen.getByText('evlerde')).toBeTruthy();
    // Zurück führt zur Liste mit erhaltener Suche.
    fireEvent.click(screen.getByRole('button', { name: /Zurück/ }));
    expect((screen.getByRole('searchbox') as HTMLInputElement).value).toBe('ev');
  });

  it('fokussiert beim Öffnen die Überschrift, Escape kehrt zur Liste zurück', async () => {
    render(<LookupScreen />);
    await type('ev');
    fireEvent.keyDown(screen.getByRole('searchbox'), { key: 'Enter' });
    const heading = await screen.findByRole('heading', { name: 'ev' });
    expect(document.activeElement).toBe(heading);
    fireEvent.keyDown(window, { key: 'Escape' });
    expect((await screen.findByRole('searchbox')) as HTMLInputElement).toBeTruthy();
    expect(useApp.getState().lookupEntry).toBeUndefined();
    expect(useApp.getState().lookupQuery).toBe('ev');
  });

  it('Enter öffnet immer den Treffer des aktuellen Suchtexts', async () => {
    render(<LookupScreen />);
    await type('kit');
    await type('ev');
    fireEvent.keyDown(screen.getByRole('searchbox'), { key: 'Enter' });
    expect(useApp.getState().lookupEntry).toBe('ev');
  });

  it('Live-Region ist von Anfang an im DOM', async () => {
    render(<LookupScreen />);
    expect((await screen.findByRole('status')).textContent).toBe('');
    await type('ev');
    expect(screen.getByRole('status').textContent).toMatch(/Treffer/);
  });

  it('Eintrag ohne Karte: „noch nicht im Wiederholen“', async () => {
    useProgress.setState({ cards: [] });
    useApp.setState({ lookupEntry: 'kitap' });
    render(<LookupScreen />);
    expect(await screen.findByText('Noch nicht im Wiederholen.')).toBeTruthy();
    expect(dayKey()).toMatch(/^\d{4}-\d{2}-\d{2}$/);
  });

  it('Abschnitt öffnet die Erklärkarte am Anker und merkt sich den Rückweg', async () => {
    render(<LookupScreen />);
    await type('lokativ');
    fireEvent.click(await screen.findByRole('button', { name: /Der Lokativ/ }));
    expect(useApp.getState().screen).toEqual({
      name: 'explainer',
      unitId: 'a1-u02',
      section: 'der-lokativ',
      from: 'lookup',
    });
    expect(useApp.getState().lookupQuery).toBe('lokativ');
  });

  it('Hinweis bei „Nichts gefunden“ nennt die Grenzen der Rückführung', async () => {
    render(<LookupScreen />);
    await type('xyzzy');
    expect(await screen.findByText(/Kopula-Formen/)).toBeTruthy();
  });

  it('Ladefehler: Meldung und erneutes Laden', async () => {
    const fetchMock = vi
      .fn()
      .mockRejectedValueOnce(new Error('offline'))
      .mockImplementation(async () => new Response(JSON.stringify(index), { status: 200 }));
    vi.stubGlobal('fetch', fetchMock);
    clearLookupCache();
    render(<LookupScreen />);
    expect(await screen.findByText('Nachschlagewerk konnte nicht geladen werden.')).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: 'Erneut laden' }));
    expect(await screen.findByRole('searchbox')).toBeTruthy();
  });

  it('Sonderzeichen-Leiste fügt an der Cursorposition ein', async () => {
    render(<LookupScreen />);
    await type('sker');
    const box = screen.getByRole('searchbox') as HTMLInputElement;
    box.setSelectionRange(1, 1);
    fireEvent.click(screen.getByRole('button', { name: /ö/ }));
    expect(useApp.getState().lookupQuery).toBe('söker');
  });

  it('Sonderzeichen-Leiste fügt ins Suchfeld ein', async () => {
    render(<LookupScreen />);
    await type('ş');
    fireEvent.click(screen.getByRole('button', { name: /ç/ }));
    expect(useApp.getState().lookupQuery).toBe('şç');
  });
});
