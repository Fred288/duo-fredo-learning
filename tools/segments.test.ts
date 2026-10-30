// Stabile IDs der erzeugten Zerlegeübungen: SRS-Karten hängen daran. Neue Formen in `allForms`
// können bestehende Übungen als mehrdeutig streichen; das soll hier auffallen, nicht erst beim
// Lernenden. Neue Units bewusst mit `npx vitest -u tools/segments.test.ts` aufnehmen.
import { readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { expect, it } from 'vitest';
import { withSegments } from '../src/content/segmenting';
import { isUnitFile, parseUnitFile } from './content-checks';

const units = readdirSync('content', { recursive: true, encoding: 'utf8' })
  .filter(isUnitFile)
  .sort()
  .map((f) => parseUnitFile(f, readFileSync(join('content', f), 'utf8')).unit!);
const vocab = units.flatMap((u) => u.vocab ?? []);

it('Zerlegeübungen behalten ihre IDs', () => {
  const ids = units.flatMap((u) =>
    withSegments(u, 'x', vocab)
      .lessons.filter((l) => l.type === 'segmenting')
      .flatMap((l) => l.exercises.map((e) => e.id)),
  );
  expect(ids).toMatchSnapshot();
}, 120_000);
