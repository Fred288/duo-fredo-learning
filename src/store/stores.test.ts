import 'fake-indexeddb/auto';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { db } from '../db/db';
import { cardId } from '../srs/card';
import { useProgress } from './progress';
import { DEFAULT_SETTINGS, useSettings } from './settings';

const flush = () => new Promise((r) => setTimeout(r, 20));

beforeEach(async () => {
  await Promise.all([
    db.settings.clear(),
    db.attempts.clear(),
    db.completions.clear(),
    db.cards.clear(),
  ]);
  useSettings.setState({ ...DEFAULT_SETTINGS, loaded: false });
  useProgress.setState({ completions: [], attempts: [], cards: [], loaded: false });
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

  it('speichert neue Wörter pro Tag und verwirft Werte außerhalb des Bereichs', async () => {
    expect(useSettings.getState().newWordsPerDay).toBe(10);
    useSettings.getState().set('newWordsPerDay', 0);
    await flush();
    useSettings.setState({ ...DEFAULT_SETTINGS });
    await useSettings.getState().load();
    expect(useSettings.getState().newWordsPerDay).toBe(0);

    await db.settings.put({ key: 'newWordsPerDay', value: 31 });
    await useSettings.getState().load();
    expect(useSettings.getState().newWordsPerDay).toBe(10);
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

describe('Notizen', () => {
  it('speichert Notizen dauerhaft und formatiert sie als Korrekturliste', async () => {
    const { useNotes, notesAsText } = await import('./notes');
    await db.notes.clear();
    useNotes.setState({ notes: [] });
    await useNotes.getState().add('a1-u01-l1-e1', 'a1-u01', '  Glosse\nunnatürlich ');
    await useNotes.getState().add('a1-u01-l1-e2', 'a1-u01', '   '); // leer: ignoriert
    expect(useNotes.getState().notes).toHaveLength(1);

    useNotes.setState({ notes: [] });
    await useNotes.getState().load();
    const { notes } = useNotes.getState();
    expect(notesAsText(notes)).toBe('a1-u01-l1-e1: Glosse unnatürlich');

    await useNotes.getState().remove(notes[0]!.id!);
    expect(await db.notes.count()).toBe(0);
  });
});

describe('SRS-Karten im Progress-Store', () => {
  afterEach(() => vi.useRealTimers());
  const day = (d: string) => vi.setSystemTime(new Date(`${d}T12:00:00`));
  const { getState } = useProgress;

  it('legt Karten für Grammatik und Fehler an, nicht für richtige Standardübungen', () => {
    vi.useFakeTimers();
    day('2026-05-01');
    getState().recordAttempt('a1-u01-l1-e1', 'a1-u01-l1', 'correct', 'multiple_choice');
    expect(getState().cards).toEqual([]);
    getState().recordAttempt('a1-u01-l1-e2', 'a1-u01-l1', 'wrong', 'word_bank');
    getState().recordAttempt('a1-u02-l2-e1', 'a1-u02-l2', 'correct', 'suffix_builder');
    expect(getState().cards.map((c) => [c.id, c.box, c.due])).toEqual([
      ['ex:a1-u01-l1-e2', 1, '2026-05-02'],
      ['ex:a1-u02-l2-e1', 2, '2026-05-04'],
    ]);
    expect(getState().attempts).toHaveLength(3);
  });

  it('führt vorhandene Karten fort, auch ohne Typ, und rückt nur fällige vor', () => {
    vi.useFakeTimers();
    day('2026-05-01');
    getState().recordAttempt('a1-u01-l1-e2', 'a1-u01-l1', 'wrong', 'word_bank');
    getState().recordAttempt('a1-u01-l1-e2', 'a1-u01-l1', 'correct', 'word_bank'); // nicht fällig
    expect(getState().cards[0]).toMatchObject({ box: 1, due: '2026-05-02' });
    day('2026-05-02');
    getState().recordAttempt('a1-u01-l1-e2', 'a1-u01-l1', 'correct');
    expect(getState().cards[0]).toMatchObject({ box: 2, due: '2026-05-05' });
  });

  it('bewertet Vokabelkarten, speichert dauerhaft und entfernt gelöschte Karten', async () => {
    vi.useFakeTimers({ toFake: ['Date'] });
    day('2026-05-01');
    const ref = { kind: 'vocab', vocabId: 'ev', dir: 'tr_de' } as const;
    getState().recordVocab(ref, 'a1-u02', 'correct');
    getState().recordVocab({ ...ref, vocabId: 'göz' }, 'a1-u02', 'wrong');
    await flush();
    expect(await db.cards.count()).toBe(2);

    useProgress.setState({ cards: [] });
    await getState().load();
    expect(getState().cards.map((c) => [c.id, c.box])).toEqual([
      ['vo:tr_de:ev', 2],
      ['vo:tr_de:göz', 1],
    ]);

    getState().removeCards(['vo:tr_de:göz']);
    await flush();
    expect(getState().cards).toHaveLength(1);
    expect(await db.cards.count()).toBe(1);
  });

  it('wartet mit Bewertungen, bis die gespeicherten Karten geladen sind', async () => {
    vi.useFakeTimers({ toFake: ['Date'] });
    day('2026-05-01');
    const ref = { kind: 'vocab', vocabId: 'ev', dir: 'tr_de' } as const;
    const stored = {
      id: cardId(ref),
      ref,
      unitId: 'a1-u02',
      box: 4,
      due: '2026-05-01',
      introduced: '2026-04-01',
      lastAt: 0,
      lapses: 0,
    };
    await db.cards.put(stored);

    const loading = getState().load();
    getState().recordVocab(ref, 'a1-u02', 'correct'); // vor dem Ende von load()
    getState().recordCompletion('a1-u02', 'a1-u02-l1', 1, 1);
    expect(getState().completions).toEqual([]); // noch zurückgestellt
    await loading;
    await flush();

    expect(getState().cards).toMatchObject([{ box: 5, due: '2026-05-31' }]);
    expect(await db.cards.get(stored.id)).toMatchObject({ box: 5, introduced: '2026-04-01' });
    expect(getState().completions).toHaveLength(1);
    expect(await db.completions.count()).toBe(1);
  });

  it('lädt idempotent: ein zweites load() verdoppelt nichts', async () => {
    getState().recordCompletion('a1-u01', 'a1-u01-l1', 1, 1);
    getState().recordAttempt('a1-u01-l1-e1', 'a1-u01-l1', 'wrong');
    await flush();
    useProgress.setState({ completions: [], attempts: [], cards: [] });
    const first = getState().load();
    const second = getState().load(); // läuft noch: dasselbe Promise
    expect(second).toBe(first);
    await first;
    await getState().load(); // schon geladen: nichts zu tun
    expect(getState().completions).toHaveLength(1);
    expect(getState().attempts).toHaveLength(1);
    expect(getState().cards).toHaveLength(1);
  });

  it('behält vor dem Laden erfasste Karten', async () => {
    getState().recordAttempt('a1-u01-l1-e2', 'a1-u01-l1', 'wrong');
    await flush();
    await getState().load();
    expect(getState().cards).toHaveLength(1);
  });
});
