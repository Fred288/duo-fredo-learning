import 'fake-indexeddb/auto';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { Lesson } from '../content/schema';
import type { LookupIndex } from '../lookup/types';
import { clearLookupCache } from '../content/load';
import { useProgress } from '../store/progress';
import { LessonRunner } from './LessonRunner';

const index: LookupIndex = {
  v: 1,
  units: [{ id: 'a1-u02', title: 'Vokalharmonie', explainer: 'explainers/a1-vokalharmonie.md' }],
  vocab: [
    { id: 'ev', tr: 'ev', de: ['Haus'], pos: 'noun', unit: 'a1-u02' },
    { id: 'kitap', tr: 'kitap', de: ['Buch'], pos: 'noun', unit: 'a1-u02', softens: true },
  ],
  sections: [
    { unit: 'a1-u02', title: 'Der Lokativ', slug: 'der-lokativ', words: ['der', 'lokativ'] },
  ],
};

const manifest = { units: [{ id: 'a1-u02', explainer: 'explainers/a1-vokalharmonie.md' }] };
const explainer = '# Vokalharmonie\n\n## Der Plural\n\nlar/ler\n\n## Der Lokativ\n\nevde, okulda\n';

const lesson: Lesson = {
  id: 'a1-u02-l1',
  type: 'vocab',
  title: 'Test',
  exercises: [
    {
      id: 'a1-u02-l1-e1',
      type: 'multiple_choice',
      prompt: 'Was heißt „Haus“?',
      options: ['ev', 'kitap'],
      answer: 'ev',
    },
  ],
};

beforeEach(() => {
  clearLookupCache();
  vi.stubGlobal(
    'fetch',
    vi.fn(async (url: string) => {
      if (url.endsWith('lookup.json')) return new Response(JSON.stringify(index));
      if (url.endsWith('index.json')) return new Response(JSON.stringify(manifest));
      return new Response(explainer);
    }),
  );
  useProgress.setState({ cards: [] });
});
afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});

const openSheet = () => fireEvent.click(screen.getByRole('button', { name: 'Nachschlagen' }));
const search = async () => screen.findByRole('searchbox');

describe('Nachschlagen in der Lektion', () => {
  it('öffnet das Sheet, sucht, zeigt den Eintrag und geht mit Esc Ebene für Ebene zurück', async () => {
    render(<LessonRunner lesson={lesson} onExit={() => {}} />);
    openSheet();
    const input = await search();
    expect(document.activeElement).toBe(input);
    fireEvent.change(input, { target: { value: 'Haus' } });
    expect(await screen.findByText('1 Treffer')).toBeTruthy();

    // Enter öffnet den ersten Treffer, prüft aber nicht die Aufgabe.
    fireEvent.keyDown(input, { key: 'Enter' });
    expect(await screen.findByRole('heading', { name: 'ev', level: 2 })).toBeTruthy();
    expect(screen.queryByText('Richtig!')).toBeNull();

    // Esc: Eintrag → Treffer (Suche bleibt) → Suche leeren → schließen.
    fireEvent.keyDown(document.activeElement!, { key: 'Escape' });
    expect(((await search()) as HTMLInputElement).value).toBe('Haus');
    fireEvent.keyDown(await search(), { key: 'Escape' });
    expect(((await search()) as HTMLInputElement).value).toBe('');
    fireEvent.keyDown(await search(), { key: 'Escape' });
    expect(screen.queryByRole('dialog')).toBeNull();
    expect(document.activeElement).toBe(screen.getByRole('button', { name: 'Nachschlagen' }));

    // Die Aufgabe steht unverändert da, die Suche bleibt für das nächste Öffnen.
    expect(screen.getByText('Was heißt „Haus“?')).toBeTruthy();
  });

  it('Ziffern im Suchfeld wählen keine Option der Aufgabe', async () => {
    render(<LessonRunner lesson={lesson} onExit={() => {}} />);
    openSheet();
    fireEvent.keyDown(await search(), { key: '1' });
    fireEvent.click(screen.getByRole('button', { name: 'Schließen' }));
    expect(screen.getByRole('button', { name: 'Prüfen' })).toHaveProperty('disabled', true);
  });

  it('zeigt einen Grammatik-Abschnitt im Sheet, ohne die Lektion zu verlassen', async () => {
    render(<LessonRunner lesson={lesson} onExit={() => {}} />);
    openSheet();
    fireEvent.change(await search(), { target: { value: 'lokativ' } });
    fireEvent.click(await screen.findByRole('button', { name: /Der Lokativ/ }));
    expect(await screen.findByRole('heading', { name: 'Der Lokativ', level: 2 })).toBeTruthy();
    expect(screen.getByText('evde, okulda')).toBeTruthy();
    expect(screen.queryByText('lar/ler')).toBeNull();
    fireEvent.click(screen.getByRole('button', { name: /Treffer/ }));
    expect(((await search()) as HTMLInputElement).value).toBe('lokativ');
  });

  it('Taste „/“ öffnet das Sheet, solange kein Feld den Fokus hat', async () => {
    render(<LessonRunner lesson={lesson} onExit={() => {}} />);
    fireEvent.keyDown(document.body, { key: '/' });
    expect(await search()).toBeTruthy();
  });

  it('lässt sich abschalten', () => {
    render(<LessonRunner lesson={lesson} onExit={() => {}} lookup={false} />);
    expect(screen.queryByRole('button', { name: 'Nachschlagen' })).toBeNull();
  });
});
