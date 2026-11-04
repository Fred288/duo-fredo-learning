import { describe, expect, it } from 'vitest';
import type { VocabEntry } from '../lookup/types';
import { facesOf, flagHints, type CardData, type PhraseExercise } from './faces';
import type { DeckCard } from './types';

const entry = (over: Partial<VocabEntry>): VocabEntry => ({
  id: 'ev',
  tr: 'ev',
  de: ['Haus'],
  pos: 'noun',
  unit: 'a1-u02',
  ...over,
});
const phrase: PhraseExercise = {
  id: 'a1-u01-l3-e2',
  type: 'word_bank',
  prompt: 'Wie geht es dir?',
  answers: ['Nasılsın?', 'Nasılsın'],
};
const data: CardData = {
  vocab: new Map([['ev', entry({ de: ['Haus', 'Wohnung'] })]]),
  phrases: new Map([[phrase.id, phrase]]),
};
const card = (kind: DeckCard['kind'], ref: string, dir: DeckCard['dir']): DeckCard => ({
  kind,
  ref,
  dir,
  unitId: 'a1-u01',
  lessonId: 'a1-u01-l1',
});

describe('facesOf', () => {
  it('Wortkarten in beiden Richtungen', () => {
    expect(facesOf(card('vocab', 'ev', 'tr_de'), data)).toMatchObject({
      front: 'ev',
      back: 'Haus, Wohnung',
      frontLang: 'tr',
      answers: ['Haus', 'Wohnung'],
      turkish: 'ev',
    });
    expect(facesOf(card('vocab', 'ev', 'de_tr'), data)).toMatchObject({
      front: 'Haus, Wohnung',
      back: 'ev',
      frontLang: 'de',
      answers: ['ev'],
    });
  });

  it('Satzkarten: Türkisch = erste Antwort, alle Antworten gelten', () => {
    expect(facesOf(card('phrase', phrase.id, 'de_tr'), data)).toMatchObject({
      front: 'Wie geht es dir?',
      back: 'Nasılsın?',
      answers: ['Nasılsın?', 'Nasılsın'],
      turkish: 'Nasılsın?',
    });
    expect(facesOf(card('phrase', phrase.id, 'tr_de'), data)).toMatchObject({
      front: 'Nasılsın?',
      answers: ['Wie geht es dir?'],
    });
  });

  it('fehlender Inhalt = keine Karte', () => {
    expect(facesOf(card('vocab', 'yok', 'tr_de'), data)).toBeUndefined();
    expect(facesOf(card('phrase', 'a9-u01-l1-e1', 'tr_de'), data)).toBeUndefined();
  });
});

describe('flagHints', () => {
  const forms = (e: VocabEntry) => flagHints(e).map((f) => f.form);
  it('Nomen mit Flag zeigen den Akkusativ', () => {
    expect(forms(entry({ tr: 'kitap', softens: true }))).toEqual(['kitabı']);
    expect(forms(entry({ tr: 'şehir', drops_vowel: true }))).toEqual(['şehri']);
    expect(forms(entry({ tr: 'cami', poss_no_s: true }))).toEqual(['camiyi', 'camii']);
  });

  it('Verben mit Erweichung bzw. Aorist-Ausnahme', () => {
    expect(forms(entry({ tr: 'gitmek', pos: 'verb', softens: true }))).toEqual(['gidiyorum']);
    expect(forms(entry({ tr: 'almak', pos: 'verb', aorist: 'ir' }))).toEqual(['alır']);
  });

  it('ohne Flag nichts', () => {
    expect(flagHints(entry({}))).toEqual([]);
    expect(flagHints(entry({ tr: 'gelmek', pos: 'verb' }))).toEqual([]);
  });
});
