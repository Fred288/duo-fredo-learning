// Strukturtests des Nachschlage-Index über die echten Inhalte in content/.
import { readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { vocabId } from '../src/content/schema';
import { buildLookup, duplicateSlugs, LOOKUP_WARN_BYTES } from '../src/lookup/index-build';
import { parseUnitFile } from './content-checks';

const units = readdirSync('content', { recursive: true, encoding: 'utf8' })
  .filter((f) => /\.ya?ml$/.test(f))
  .sort()
  .map((f) => parseUnitFile(f, readFileSync(join('content', f), 'utf8')).unit!);
const explainers = new Map(
  units.flatMap((u) =>
    u.explainer ? [[u.explainer, readFileSync(join('content', u.explainer), 'utf8')] as const] : [],
  ),
);
const index = buildLookup(units, explainers);

describe('lookup.json aus content/', () => {
  it('enthält jede Vokabel genau einmal unter ihrer vocabId', () => {
    const ids = index.vocab.map((v) => v.id);
    expect(new Set(ids).size).toBe(ids.length);
    expect(ids.sort()).toEqual(units.flatMap((u) => (u.vocab ?? []).map(vocabId)).sort());
  });

  it('jede Vokabel und jeder Abschnitt gehört zu einer bekannten Unit', () => {
    const known = new Set(index.units.map((u) => u.id));
    expect(index.vocab.every((v) => known.has(v.unit))).toBe(true);
    expect(index.sections.every((s) => known.has(s.unit))).toBe(true);
  });

  it('Anker sind je Erklärkarte eindeutig und nicht leer', () => {
    for (const md of explainers.values()) expect(duplicateSlugs(md)).toEqual([]);
    expect(index.sections.every((s) => s.slug.length > 0)).toBe(true);
  });

  it('bleibt unter der Warngrenze für den Precache', () => {
    expect(JSON.stringify(index).length).toBeLessThan(LOOKUP_WARN_BYTES);
  });
});
