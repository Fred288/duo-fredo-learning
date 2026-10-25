import 'fake-indexeddb/auto';
import { beforeEach, describe, expect, it } from 'vitest';
import { db } from '../db/db';
import { useProgress } from './progress';
import { DEFAULT_SETTINGS, useSettings } from './settings';

const flush = () => new Promise((r) => setTimeout(r, 20));

beforeEach(async () => {
  await Promise.all([db.settings.clear(), db.attempts.clear(), db.completions.clear()]);
  useSettings.setState({ ...DEFAULT_SETTINGS, loaded: false });
  useProgress.setState({ completions: [], loaded: false });
  document.documentElement.classList.remove('dark');
});

describe('Settings-Store', () => {
  it('speichert Änderungen und lädt sie wieder', async () => {
    useSettings.getState().set('dailyGoal', 4);
    useSettings.getState().set('showStreak', false);
    await flush();

    useSettings.setState({ ...DEFAULT_SETTINGS });
    await useSettings.getState().load();
    expect(useSettings.getState().dailyGoal).toBe(4);
    expect(useSettings.getState().showStreak).toBe(false);
    expect(useSettings.getState().loaded).toBe(true);
  });

  it('ignoriert ungültige gespeicherte Werte', async () => {
    await db.settings.bulkPut([
      { key: 'dailyGoal', value: 99 },
      { key: 'theme', value: 'neon' },
      { key: 'tolerateDiacritics', value: 'ja' },
    ]);
    await useSettings.getState().load();
    expect(useSettings.getState()).toMatchObject(DEFAULT_SETTINGS);
  });

  it('setzt die Dunkelmodus-Klasse auf <html>', () => {
    useSettings.getState().set('theme', 'dark');
    expect(document.documentElement.classList.contains('dark')).toBe(true);
    useSettings.getState().set('theme', 'light');
    expect(document.documentElement.classList.contains('dark')).toBe(false);
  });
});

describe('Progress-Store', () => {
  it('speichert Abschlüsse und Versuche dauerhaft', async () => {
    useProgress.getState().recordAttempt('a1-u01-l1-e1', 'a1-u01-l1', 'wrong');
    useProgress.getState().recordCompletion('a1-u01', 'a1-u01-l1', 2, 3);
    expect(useProgress.getState().completions).toHaveLength(1);
    await flush();

    useProgress.setState({ completions: [] });
    await useProgress.getState().load();
    expect(useProgress.getState().completions).toMatchObject([
      { lessonId: 'a1-u01-l1', unitId: 'a1-u01', correct: 2, total: 3 },
    ]);
    expect(await db.attempts.count()).toBe(1);
  });
});
