import { cleanup, render, screen, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import { useProgress } from '../store/progress';
import { useSettings } from '../store/settings';
import { Today } from './Today';

const manifest = {
  units: [
    {
      id: 'a1-u01',
      level: 'A1',
      title: 'Erste Unit',
      unreviewed: 0,
      lessons: [{ id: 'a1-u01-l1', type: 'vocab', title: 'Erste Lektion' }],
      vocab: [],
    },
  ],
};

beforeEach(() => {
  vi.stubGlobal(
    'fetch',
    vi.fn(async () => new Response(JSON.stringify(manifest))),
  );
});

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});

it('Weiterlernen wartet auf den Fortschritt, sonst zeigte die Karte die falsche Stelle', async () => {
  useProgress.setState({ loaded: false });
  useSettings.setState({ loaded: true, placementOffered: true });
  render(<Today />);
  // Das Manifest ist da, sobald der Ladehinweis weicht; die Stores laden noch.
  await waitFor(() => expect(screen.queryByText('Lade Kurs …')).toBeNull());
  expect(screen.queryByRole('button', { name: /Weiterlernen/ })).toBeNull();

  useProgress.setState({ loaded: true });
  expect(await screen.findByRole('button', { name: /Weiterlernen/ })).toBeTruthy();
});
