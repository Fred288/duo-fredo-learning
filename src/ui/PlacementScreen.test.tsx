import 'fake-indexeddb/auto';
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { db } from '../db/db';
import type { Unit } from '../content/schema';
import type { PlacementPlan } from '../placement';
import { useApp } from '../store/app';
import { useProgress } from '../store/progress';
import { DEFAULT_SETTINGS, useSettings } from '../store/settings';
import { PlacementScreen } from './PlacementScreen';

const exercise = (unit: string, n: number) => ({
  id: `${unit}-l2-e${n}`,
  type: 'multiple_choice' as const,
  prompt: `Frage ${unit} ${n}`,
  options: ['richtig', 'falsch'],
  answer: 'richtig',
});

const unit = (id: string): Unit => ({
  id,
  level: 'A1',
  title: `Titel ${id}`,
  reviewed: false,
  source: 'eigene',
  license: 'CC BY-SA 4.0',
  lessons: [
    {
      id: `${id}-l2`,
      type: 'grammar',
      title: 'Thema',
      exercises: [exercise(id, 1), exercise(id, 2)],
    },
  ],
});

const units = ['a1-u01', 'a1-u02', 'a1-u03', 'a1-u04', 'a1-u05'].map(unit);
let plan: PlacementPlan;
const planOf = (count: number): PlacementPlan => ({
  levels: [
    {
      level: 'A1',
      units: units.slice(0, count).map((u) => ({
        unitId: u.id,
        title: u.title,
        items: [1, 2].map((n) => ({
          id: `${u.id}-l2-e${n}`,
          lessonId: `${u.id}-l2`,
          topic: 'Thema',
        })),
      })),
    },
  ],
});

/** `failUnits`: Units liefern 404, bis `failing.on` wieder false ist (Nochmal versuchen). */
const failing = { on: false };
function serve({ count = 2, failUnits = false } = {}) {
  plan = planOf(count);
  failing.on = failUnits;
  vi.stubGlobal(
    'fetch',
    vi.fn(async (url: string) => {
      if (url.endsWith('placement.json')) return new Response(JSON.stringify(plan));
      const found = /units\/(.+)\.json$/.exec(url);
      const body = found && !failing.on ? units.find((u) => u.id === found[1]) : undefined;
      return body ? new Response(JSON.stringify(body)) : new Response('', { status: 404 });
    }),
  );
}

beforeEach(async () => {
  await Promise.all([
    db.settings.clear(),
    db.attempts.clear(),
    db.completions.clear(),
    db.cards.clear(),
    db.placements.clear(),
  ]);
  useSettings.setState({ ...DEFAULT_SETTINGS, loaded: true });
  useProgress.setState({ completions: [], attempts: [], cards: [], placements: [], loaded: true });
  useApp.setState({ screen: { name: 'placement' }, focusUnit: undefined });
});

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});

const click = (target: RegExp | string | HTMLElement) =>
  fireEvent.click(
    typeof target === 'string' || target instanceof RegExp
      ? screen.getByRole('button', { name: target })
      : target,
  );
const answerRight = async () => {
  fireEvent.click(await screen.findByLabelText(/richtig/));
  click('Weiter');
};

describe('PlacementScreen', () => {
  it('zeigt erst die Einführung, Abbrechen verlässt ohne zu speichern', async () => {
    serve();
    render(<PlacementScreen />);
    expect(await screen.findByText(/keine Punkte/)).toBeTruthy();
    click(/Zurück/);
    expect(useApp.getState().screen.name).toBe('home');
    expect(useProgress.getState().placements).toEqual([]);
  });

  it('alles richtig: Empfehlung übernehmen speichert nur die Einstufung', async () => {
    serve();
    render(<PlacementScreen />);
    click(await screen.findByRole('button', { name: 'Test beginnen' }));
    expect(await screen.findByText('A1 · Thema 1 von 2')).toBeTruthy();
    await answerRight();
    expect(await screen.findByText('A1 · Thema 2 von 2')).toBeTruthy();
    // Keine Rückmeldung nach der Aufgabe.
    expect(screen.queryByText('Richtig!')).toBeNull();
    await answerRight();

    expect(await screen.findByText(/Du kannst die geprüften Themen/)).toBeTruthy();
    click('Empfehlung übernehmen');
    const s = useProgress.getState();
    expect(s.placements).toMatchObject([{ startUnit: null, skipped: ['a1-u01', 'a1-u02'] }]);
    expect(useSettings.getState().placementOffered).toBe(true);
    expect(useApp.getState().screen.name).toBe('home');
    expect(s.attempts).toEqual([]);
    expect(s.completions).toEqual([]);
    expect(s.cards).toEqual([]);
    await waitFor(async () => expect(await db.placements.count()).toBe(1));
    expect(await db.attempts.count()).toBe(0);
    expect(await db.completions.count()).toBe(0);
    expect(await db.cards.count()).toBe(0);
  });

  it('„Weiß ich nicht“ stellt eine Bestätigung; zweimal führt zum Start, Ablehnen speichert nichts', async () => {
    serve();
    render(<PlacementScreen />);
    click(await screen.findByRole('button', { name: 'Test beginnen' }));
    await screen.findByText('A1 · Thema 1 von 2');
    await screen.findByLabelText(/richtig/);
    const first = screen.getByText('Frage a1-u01 1');
    click('Weiß ich nicht');
    // Dieselbe Unit, andere Aufgabe.
    expect(await screen.findByText('Frage a1-u01 2')).toBeTruthy();
    expect(first.isConnected).toBe(false);
    expect(screen.getByText('A1 · Thema 1 von 2')).toBeTruthy();
    click('Weiß ich nicht');

    expect(await screen.findByText('Starte bei: Titel a1-u01')).toBeTruthy();
    expect(screen.getByText(/Noch nicht sicher/)).toBeTruthy();
    click('Nicht übernehmen');
    expect(useProgress.getState().placements).toEqual([]);
    expect(useApp.getState().screen.name).toBe('home');
  });

  it('Übernehmen mit Start merkt die Unit zum Scrollen auf der Startseite', async () => {
    serve();
    render(<PlacementScreen />);
    click(await screen.findByRole('button', { name: 'Test beginnen' }));
    await answerRight(); // a1-u01 sicher
    await screen.findByText('A1 · Thema 2 von 2');
    await screen.findByLabelText(/richtig/);
    click('Weiß ich nicht');
    await screen.findByText('Frage a1-u02 2');
    click('Weiß ich nicht');
    click(await screen.findByRole('button', { name: 'Empfehlung übernehmen' }));
    expect(useProgress.getState().placements).toMatchObject([
      { startUnit: 'a1-u02', skipped: ['a1-u01'] },
    ]);
    expect(useApp.getState().focusUnit).toBe('a1-u02');
  });

  it('meldet einen Ladefehler der Unit, statt falsch zu werten', async () => {
    serve({ failUnits: true });
    render(<PlacementScreen />);
    click(await screen.findByRole('button', { name: 'Test beginnen' }));
    expect(await screen.findByText(/konnten nicht geladen werden/)).toBeTruthy();
    expect(useProgress.getState().placements).toEqual([]);
    // Nochmal versuchen: gleiche Aufgabe, nichts ging verloren.
    failing.on = false;
    click('Nochmal versuchen');
    expect(await screen.findByText('A1 · Thema 1 von 2')).toBeTruthy();
    expect(await screen.findByText('Frage a1-u01 1')).toBeTruthy();
  });

  it('Doppeltippen auf „Weiß ich nicht“ wertet nur eine Aufgabe', async () => {
    serve();
    render(<PlacementScreen />);
    click(await screen.findByRole('button', { name: 'Test beginnen' }));
    await screen.findByText('Frage a1-u01 1');
    const unknown = screen.getByRole('button', { name: 'Weiß ich nicht' });
    fireEvent.click(unknown, { detail: 1 });
    fireEvent.click(unknown, { detail: 2 });
    // Die Bestätigung wartet unbeantwortet; ein zweites „unbekannt“ hätte die Unit schon beendet.
    expect(await screen.findByText('Frage a1-u01 2')).toBeTruthy();
    expect(screen.getByText('A1 · Thema 1 von 2')).toBeTruthy();
  });

  it('Enter wertet wie „Weiter“, gehaltene Enter-Taste nur einmal; Fokus wandert zur Fortschrittszeile', async () => {
    serve();
    render(<PlacementScreen />);
    click(await screen.findByRole('button', { name: 'Test beginnen' }));
    fireEvent.click(await screen.findByLabelText(/richtig/));
    fireEvent.keyDown(document.body, { key: 'Enter' });
    expect(await screen.findByText('A1 · Thema 2 von 2')).toBeTruthy();
    expect(document.activeElement?.id).toBe('placement-progress');
    fireEvent.click(await screen.findByLabelText(/richtig/));
    fireEvent.keyDown(document.body, { key: 'Enter', repeat: true });
    // Wiederholte Taste zählt nicht: noch dieselbe Aufgabe.
    expect(screen.getByText('A1 · Thema 2 von 2')).toBeTruthy();
    expect(screen.queryByText('Deine Empfehlung')).toBeNull();
  });

  it('Abbrechen fragt nach der ersten Antwort zurück und speichert nichts', async () => {
    serve();
    render(<PlacementScreen />);
    click(await screen.findByRole('button', { name: 'Test beginnen' }));
    await screen.findByText('Frage a1-u01 1');
    click('Weiß ich nicht');
    await screen.findByText('Frage a1-u01 2');
    click(/Abbrechen/);
    expect(await screen.findByText('Test abbrechen? Es wird nichts gespeichert.')).toBeTruthy();
    click('Weitermachen');
    expect(screen.queryByText('Test abbrechen? Es wird nichts gespeichert.')).toBeNull();
    click(/Abbrechen/);
    click('Ja, abbrechen');
    expect(useApp.getState().screen.name).toBe('home');
    expect(useProgress.getState().placements).toEqual([]);
  });

  it('nur Nachzuholendes ohne Start: nie „alles sicher“, Nachholen steht im Ergebnis', async () => {
    serve({ count: 5 });
    render(<PlacementScreen />);
    click(await screen.findByRole('button', { name: 'Test beginnen' }));
    // Unit 1 unsicher (ein Fehlversuch pro Niveau erlaubt), Units 2 bis 5 sicher.
    await screen.findByText('Frage a1-u01 1');
    click('Weiß ich nicht');
    await screen.findByText('Frage a1-u01 2');
    click('Weiß ich nicht');
    for (let i = 2; i <= 5; i++) {
      await screen.findByText(`A1 · Thema ${i} von 5`);
      await answerRight();
    }
    expect(
      await screen.findByText(/Einige sind noch nicht sicher|einige sind noch nicht sicher/),
    ).toBeTruthy();
    expect(screen.queryByText(/Du kannst die geprüften Themen/)).toBeNull();
    expect(screen.getByText(/Davor noch nicht sicher.*Titel a1-u01/)).toBeTruthy();
    click('Empfehlung übernehmen');
    expect(useProgress.getState().placements).toMatchObject([
      { startUnit: null, skipped: ['a1-u02', 'a1-u03', 'a1-u04', 'a1-u05'] },
    ]);
  });
});
