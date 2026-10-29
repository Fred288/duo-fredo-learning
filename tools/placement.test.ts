// Einstufungsaufgaben über die echten Inhalte in content/ (wie im Build).
import { readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { selectPlacement } from '../src/placement/select';
import { isUnitFile, parsePlacementFile, parseUnitFile, PLACEMENT_FILE } from './content-checks';

const units = readdirSync('content', { recursive: true, encoding: 'utf8' })
  .filter(isUnitFile)
  .sort()
  .map((f) => parseUnitFile(f, readFileSync(join('content', f), 'utf8')).unit!);
const file = parsePlacementFile(readFileSync(join('content', PLACEMENT_FILE), 'utf8'));
const { plan, errors } = selectPlacement(units, file);

describe('placement.json aus content/', () => {
  it('jede Unit hat zwei verschiedene Aufgaben, Overrides sind gültig', () => {
    expect(file.errors).toEqual([]);
    expect(errors).toEqual([]);
    const all = plan.levels.flatMap((l) => l.units);
    expect(all.map((u) => u.unitId)).toEqual(units.map((u) => u.id));
    for (const u of all) expect(new Set(u.items.map((i) => i.id)).size).toBe(2);
  });

  // Ändert sich die Auswahl (neue Übung mit kleinerem Hash, neue Typregel), fällt es hier auf:
  // dann bewusst den Snapshot erneuern (`npx vitest -u tools/placement.test.ts`).
  it('Auswahl bleibt stabil', () => {
    const ids = Object.fromEntries(
      plan.levels.flatMap((l) => l.units.map((u) => [u.unitId, u.items.map((i) => i.id)])),
    );
    expect(ids).toMatchSnapshot();
  });
});

describe('parsePlacementFile', () => {
  it('meldet YAML- und Schemafehler, statt abzubrechen', () => {
    expect(parsePlacementFile('overrides: [').errors[0]).toMatch(/^placement\.yaml: YAML-Fehler/);
    expect(parsePlacementFile('overrides:\n  a1-u01: [nur-eins]\n').errors).toHaveLength(1);
    expect(parsePlacementFile('fremd: 1\n').errors[0]).toMatch(/fremd/);
    expect(parsePlacementFile('')).toEqual({ overrides: {}, errors: [] });
  });
});
