// Karteikarten über die echten Inhalte in content/ (wie im Build).
import { readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { annotateSpeech, courseWords } from '../src/audio/turkish-detect';
import { vocabId } from '../src/content/schema';
import { checkCardFields, lessonVocab, phraseCards } from '../src/flashcards/build';
import { vocabExamples } from '../src/flashcards/examples';
import { formAnswer, formIndex, formRef, patternKey, patternsFor } from '../src/flashcards/forms';
import { allForms } from '../src/lookup/forms';
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

  // Beispielsatz je Wort (Quelle); bewusst erneuern wie oben.
  it('Beispielsätze: Felder example gültig, Auswahl bleibt stabil', () => {
    const { examples, errors } = vocabExamples(units, prepared);
    expect(errors).toEqual([]);
    const all = Object.fromEntries(
      [...examples].map(([unitId, m]) => [unitId, [...m].map(([id, e]) => `${id} ← ${e.from}`)]),
    );
    expect(all).toMatchSnapshot();
  }, 120_000);

  // Formkarten: jede Karte hat eine Engine-Form, die mit derselben Angabe in `allForms` steht
  // (also im Nachschlagen auf das Wort zurückführt) und nicht die Grundform selbst ist.
  it('Formkarten: Rundlauf gegen allForms, Einführung der Muster bleibt stabil', () => {
    const index = buildLookup(units, new Map());
    const forms = formIndex(
      units.flatMap((u) => u.lessons),
      index.vocab,
    );
    expect(forms.intro).toMatchSnapshot();
    const byId = new Map(index.vocab.map((v) => [v.id, v]));
    const norm = (o: object) => JSON.stringify(Object.fromEntries(Object.entries(o).sort()));
    const kinds = [
      ...forms.nouns.map((id) => ({ id, kind: 'noun' as const })),
      ...forms.verbs.map((id) => ({ id, kind: 'verb' as const })),
    ];
    const problems: string[] = [];
    let count = 0;
    for (const { id, kind } of kinds) {
      const entry = byId.get(id)!;
      const all = allForms(entry);
      const word = {
        kind,
        proper: forms.proper?.includes(id) || undefined,
        compound: forms.compound?.includes(id) || undefined,
      };
      for (const p of patternsFor(word)) {
        if (!forms.intro[patternKey(p)]) continue;
        count++;
        const ref = formRef(id, p);
        const answer = formAnswer(entry, ref);
        if (!answer) {
          problems.push(`${ref}: keine Form`);
          continue;
        }
        for (const f of answer.forms) {
          if (f === entry.tr) problems.push(`${ref}: ${f} = Grundform`);
          if (!all.some((x) => x.form === f && norm(x.label) === norm(answer.label)))
            problems.push(`${ref}: ${f} nicht in allForms`);
        }
      }
    }
    expect(problems).toEqual([]);
    expect(count).toBeGreaterThan(7000);
  }, 300_000);

  it('Satzkarten bleiben stabil', () => {
    const all = Object.fromEntries(
      [...phraseCards(units).values()].flatMap((m) => [...m.entries()]),
    );
    expect(all).toMatchSnapshot();
  });
});
