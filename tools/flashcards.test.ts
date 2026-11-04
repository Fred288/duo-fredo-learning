// Karteikarten über die echten Inhalte in content/ (wie im Build).
import { readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { annotateSpeech, courseWords } from '../src/audio/turkish-detect';
import { vocabId } from '../src/content/schema';
import { checkCardFields, lessonVocab, phraseCards } from '../src/flashcards/build';
import { buildLookup } from '../src/lookup/index-build';
import { prepareLookup } from '../src/lookup/search';
import { isUnitFile, parseUnitFile } from './content-checks';

const units = readdirSync('content', { recursive: true, encoding: 'utf8' })
  .filter(isUnitFile)
  .sort()
  .map((f) => parseUnitFile(f, readFileSync(join('content', f), 'utf8')).unit!);
const prepared = prepareLookup(buildLookup(units, new Map()));
// Wie im Build: Multiple Choice weiß dann, ob die Lösung türkisch ist (`speak_answer`).
const words = courseWords(units);
const annotated = units.map((u) => annotateSpeech(u, words));

describe('Karteikarten aus content/', () => {
  it('Felder lesson/card sind gültig', () => {
    expect(units.flatMap(checkCardFields)).toEqual([]);
  });

  // Ändert sich die Zuordnung (neue Übung, neues Wort), fällt es hier auf: dann bewusst den
  // Snapshot erneuern (`npx vitest -u tools/flashcards.test.ts`).
  it('jedes Wort in genau einer Lektion, Zuordnung bleibt stabil', () => {
    const all: Record<string, string[]> = {};
    for (const u of annotated) {
      const got = lessonVocab(u, prepared);
      expect([...got.values()].flat().sort()).toEqual((u.vocab ?? []).map(vocabId).sort());
      for (const [lessonId, ids] of got) all[lessonId] = ids;
    }
    expect(all).toMatchSnapshot();
  }, 120_000);

  it('Satzkarten bleiben stabil', () => {
    const all = Object.fromEntries(
      [...phraseCards(units).values()].flatMap((m) => [...m.entries()]),
    );
    expect(all).toMatchSnapshot();
  });
});
