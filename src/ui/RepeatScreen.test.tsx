import 'fake-indexeddb/auto';
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { db } from '../db/db';
import type { Unit } from '../content/schema';
import { cardId, type Card, type CardRef } from '../srs';
import { useApp } from '../store/app';
import { useProgress } from '../store/progress';
import { DEFAULT_SETTINGS, useSettings } from '../store/settings';
import { RepeatScreen } from './RepeatScreen';

const unit = (id: string, extra: Partial<Unit> = {}): Unit => ({
  id,
  level: 'A1',
  title: id,
  reviewed: false,
  source: 'eigene',
  license: 'CC BY-SA 4.0',
  lessons: [
    {
      id: `${id}-l1`,
      type: 'vocab',
      title: 'Test',
      exercises: [
        {
          id: `${id}-l1-e1`,
          type: 'multiple_choice',
          prompt: `Frage ${id}`,
          options: ['richtig', 'falsch'],
          answer: 'richtig',
        },
      ],
    },
  ],
  ...extra,
});

const manifestOf = (units: Unit[]) => ({
  units: units.map((u) => ({
    id: u.id,
    level: u.level,
    title: u.title,
    unreviewed: 0,
    lessons: u.lessons.map((l) => ({ id: l.id, type: l.type, title: l.title })),
    vocab: (u.vocab ?? []).map((v) => v.tr),
  })),
});

/** Antwortet auf `content/index.json` und `content/units/<id>.json`; fehlende Units liefern 404. */
function serve(units: Unit[], manifestUnits = units) {
  vi.stubGlobal(
    'fetch',
    vi.fn(async (url: string) => {
      const found = /units\/(.+)\.json$/.exec(url);
      const body = found ? units.find((u) => u.id === found[1]) : manifestOf(manifestUnits);
      return body
        ? new Response(JSON.stringify(body), { status: 200 })
        : new Response('', { status: 404 });
    }),
  );
}

const card = (ref: CardRef, unitId: string, over: Partial<Card> = {}): Card => ({
  id: cardId(ref),
  ref,
  unitId,
  box: 1,
  due: '2000-01-01',
  introduced: '2000-01-01',
  lastAt: 0,
  lapses: 0,
  ...over,
});
const exCard = (unitId: string) =>
  card({ kind: 'exercise', exerciseId: `${unitId}-l1-e1` }, unitId);

beforeEach(async () => {
  await Promise.all([db.cards.clear(), db.attempts.clear(), db.completions.clear()]);
  useSettings.setState({ ...DEFAULT_SETTINGS, loaded: true });
  useProgress.setState({ completions: [], attempts: [], cards: [], loaded: true });
  useApp.setState({ screen: { name: 'repeat' } });
});
afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});

const answerCorrectly = () => {
  fireEvent.click(screen.getByLabelText(/richtig/));
  fireEvent.click(screen.getByRole('button', { name: 'Prüfen' }));
  fireEvent.click(screen.getByRole('button', { name: 'Weiter' }));
};

describe('RepeatScreen', () => {
  it('räumt Karten entfernter Units ab und zeigt dann „nichts zu wiederholen“', async () => {
    serve([unit('a1-u01')]);
    useProgress.setState({ cards: [exCard('a1-u09')] });
    render(<RepeatScreen />);
    expect(await screen.findByText('Heute ist nichts zu wiederholen.')).toBeTruthy();
    expect(useProgress.getState().cards).toEqual([]);
  });

  it('übersteht eine nicht ladbare Unit und fragt die übrigen Karten ab', async () => {
    const u1 = unit('a1-u01');
    serve([u1], [u1, unit('a1-u02')]); // u02 steht im Manifest, die Datei fehlt
    useProgress.setState({ cards: [exCard('a1-u01'), exCard('a1-u02')] });
    render(<RepeatScreen />);
    expect(await screen.findByText('Frage a1-u01')).toBeTruthy();
    expect(screen.queryByText('Kurs konnte nicht geladen werden.')).toBeNull();
    // Die Karte der fehlenden Unit bleibt erhalten (vorübergehender Fehler, kein Löschen).
    expect(useProgress.getState().cards.map((c) => c.id)).toContain('ex:a1-u02-l1-e1');
  });

  it('behält Stand und Box einer in eine andere Unit verschobenen Vokabel', async () => {
    const u3 = unit('a1-u03', { vocab: [{ tr: 'ev', de: ['Haus'], pos: 'noun' }] });
    serve([u3]);
    const moved = card({ kind: 'vocab', vocabId: 'ev', dir: 'tr_de' }, 'a1-u01', { box: 4 });
    useProgress.setState({ cards: [moved] });
    render(<RepeatScreen />);
    expect(await screen.findByText('ev')).toBeTruthy();
    await waitFor(() =>
      expect(useProgress.getState().cards).toEqual([{ ...moved, unitId: 'a1-u03' }]),
    );
  });

  it('zählt den Durchgang auch bei „Nochmal“ nur einmal fürs Tagesziel', async () => {
    serve([unit('a1-u01')]);
    useProgress.setState({ cards: [exCard('a1-u01')] });
    render(<RepeatScreen />);
    await screen.findByText('Frage a1-u01');
    answerCorrectly();
    expect(screen.getByRole('heading', { name: 'Wiederholung geschafft' })).toBeTruthy();
    expect(useProgress.getState().completions.filter((c) => c.lessonId === 'srs')).toHaveLength(1);

    fireEvent.click(screen.getByRole('button', { name: 'Nochmal' }));
    answerCorrectly();
    expect(screen.getByRole('heading', { name: 'Wiederholung geschafft' })).toBeTruthy();
    expect(useProgress.getState().completions.filter((c) => c.lessonId === 'srs')).toHaveLength(1);
  });
});
