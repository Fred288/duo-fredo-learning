import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import { clearLookupCache } from '../content/load';
import { useApp } from '../store/app';
import { useProgress } from '../store/progress';
import { DEFAULT_SETTINGS, useSettings } from '../store/settings';
import { PracticeScreen } from './PracticeScreen';

const manifest = {
  units: [
    {
      id: 'a1-u01',
      level: 'A1',
      title: 'Erste Unit',
      unreviewed: 0,
      lessons: [],
      vocab: ['ev'],
      texts: [
        { id: 'a1-u01-t1', title: 'Zu Hause' },
        { id: 'a1-u01-t2', title: 'Im Garten' },
      ],
    },
  ],
};
const lookup = {
  v: 1,
  units: [{ id: 'a1-u01', title: 'Erste Unit' }],
  vocab: [{ id: 'ev', tr: 'ev', de: ['Haus'], pos: 'noun', unit: 'a1-u01' }],
  sections: [],
};
const unit = {
  id: 'a1-u01',
  level: 'A1',
  title: 'Erste Unit',
  lessons: [],
  texts: [
    {
      id: 'a1-u01-t1',
      title: 'Zu Hause',
      sentences: [
        { tr: 'Ev büyük.', de: 'Das Haus ist groß.' },
        { tr: 'Ev güzel.', de: 'Das Haus ist schön.' },
      ],
      tokens: [
        [
          { text: 'Ev', w: true, vocab: 'ev' },
          { text: ' ' },
          { text: 'büyük', w: true },
          { text: '.' },
        ],
        [
          { text: 'Ev', w: true, vocab: 'ev' },
          { text: ' ' },
          { text: 'güzel', w: true },
          { text: '.' },
        ],
      ],
    },
  ],
};
const ref = { unitId: 'a1-u01', id: 'a1-u01-t1', title: 'Zu Hause' };

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
  useSettings.setState({ ...DEFAULT_SETTINGS, loaded: true });
  useProgress.setState({ loaded: true, attempts: [], completions: [], cards: [] });
  useApp.setState({ screen: { name: 'text-practice', unitId: 'a1-u01', text: ref } });
});

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});

const click = (name: string | RegExp) => fireEvent.click(screen.getByRole('button', { name }));

it('Lesen: Text mit Übersetzung, merkt sich den Text, bietet einen anderen an', async () => {
  render(<PracticeScreen unitId="a1-u01" text={ref} />);
  expect(screen.getByRole('heading', { level: 1, name: 'Zu Hause' })).toBeTruthy();
  expect(await screen.findByText('Übungstext · A1')).toBeTruthy();
  expect(screen.getAllByRole('button', { name: 'Ev' })).toHaveLength(2);
  fireEvent.click(screen.getByLabelText('Übersetzung zeigen'));
  expect(screen.getByText('Das Haus ist groß.')).toBeTruthy();
  expect(useSettings.getState().practiceRecent).toEqual(['a1-u01-t1']);

  click('Anderer Text');
  const now = useApp.getState().screen;
  expect(now.name === 'text-practice' && now.text.id).toBe('a1-u01-t2');
});

it('Übersetzen: vergleichen, selbst bewerten, Daneben-Sätze nochmal; nichts wird gewertet', async () => {
  useSettings.setState({ practiceMode: 'translate' });
  render(<PracticeScreen unitId="a1-u01" text={ref} />);
  expect(await screen.findByText('Satz 1 von 2')).toBeTruthy();
  expect(screen.queryByText('Das Haus ist groß.')).toBeNull();

  const field = screen.getByLabelText('Deine Übersetzung (freiwillig)');
  fireEvent.change(field, { target: { value: 'Das Haus ist groß' } });
  fireEvent.keyDown(field, { key: 'Enter' });
  expect(screen.getByText('Das Haus ist groß.')).toBeTruthy();
  expect(document.activeElement).toBe(screen.getByRole('button', { name: 'Passt' }));
  click('Daneben');

  expect(screen.getByText('Satz 2 von 2')).toBeTruthy();
  expect(document.activeElement).toBe(screen.getByText('Satz 2 von 2'));
  click('Vergleichen');
  click('Passt');

  expect(screen.getByRole('heading', { name: 'Text geschafft' })).toBeTruthy();
  expect(screen.getByText('Diese Sätze waren daneben:')).toBeTruthy();
  expect(screen.getByText('Ev büyük.')).toBeTruthy();
  click('Diese nochmal');
  expect(screen.getByText('Satz 1 von 1')).toBeTruthy();
  click('Vergleichen');
  click('Passt');
  expect(screen.getByText('Alle Sätze passten.')).toBeTruthy();

  const { attempts, completions, cards } = useProgress.getState();
  expect([attempts, completions, cards]).toEqual([[], [], []]);
});

it('Umschalten der Art bleibt als Einstellung', async () => {
  render(<PracticeScreen unitId="a1-u01" text={ref} />);
  await screen.findByText('Übungstext · A1');
  fireEvent.click(screen.getByLabelText('Übersetzen'));
  expect(useSettings.getState().practiceMode).toBe('translate');
  expect(screen.getByText('Satz 1 von 2')).toBeTruthy();
});
