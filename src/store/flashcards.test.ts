import 'fake-indexeddb/auto';
import { beforeEach, describe, expect, it } from 'vitest';
import { db } from '../db/db';
import type { DeckCard } from '../flashcards/types';
import { useFlashcards } from './flashcards';

const card: DeckCard = {
  kind: 'phrase',
  ref: 'a1-u01-l3-e2',
  dir: 'de_tr',
  unitId: 'a1-u01',
  lessonId: 'a1-u01-l3',
};

describe('useFlashcards', () => {
  beforeEach(async () => {
    await Promise.all([db.flashes.clear(), db.flashMarks.clear()]);
    useFlashcards.setState({ flashes: [], marks: [], loaded: false });
  });

  it('speichert Antworten und Markierungen und lädt sie wieder', async () => {
    await useFlashcards.getState().load();
    useFlashcards.getState().recordFlash(card, false, 'type');
    useFlashcards.getState().setMarked(card, true);
    useFlashcards.getState().setMarked(card, false);
    await new Promise((r) => setTimeout(r, 20));
    expect(await db.flashes.count()).toBe(1);
    expect(await db.flashMarks.toArray()).toMatchObject([
      { key: 'phrase:a1-u01-l3-e2', marked: false },
    ]);

    await useFlashcards.getState().reload();
    const s = useFlashcards.getState();
    expect(s.flashes).toMatchObject([
      { kind: 'phrase', ref: card.ref, dir: 'de_tr', correct: false, mode: 'type' },
    ]);
    expect(s.flashes[0]).not.toHaveProperty('id');
    expect(s.marks).toHaveLength(1);
  });

  it('Antworten während des Ladens gehen nicht doppelt in den Speicher', async () => {
    const loading = useFlashcards.getState().load();
    useFlashcards.getState().recordFlash(card, true, 'flip');
    await loading;
    await new Promise((r) => setTimeout(r, 20));
    expect(useFlashcards.getState().flashes).toHaveLength(1);
    expect(await db.flashes.count()).toBe(1);
  });
});
