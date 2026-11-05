// Übungstexte über die echten Inhalte in content/ (wie im Build).
import { readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { withTexts } from '../src/content/practice';
import { buildLookup } from '../src/lookup/index-build';
import { prepareLookup } from '../src/lookup/search';
import { isUnitFile, parseUnitFile } from './content-checks';

const units = readdirSync('content', { recursive: true, encoding: 'utf8' })
  .filter(isUnitFile)
  .sort()
  .map((f) => parseUnitFile(f, readFileSync(join('content', f), 'utf8')).unit!);
const prepared = prepareLookup(buildLookup(units, new Map()));

describe('Übungstexte aus content/', () => {
  // IDs sind stabil (das Angebot merkt sich gelesene Texte); neue Texte bewusst mit -u aufnehmen.
  it('nur Bekanntes, IDs und Satzzahl bleiben stabil', () => {
    const all: Record<string, number> = {};
    for (const unit of units) {
      expect(withTexts(unit, prepared).errors).toEqual([]);
      for (const t of unit.texts ?? []) all[t.id] = t.sentences.length;
    }
    expect(all).toMatchSnapshot();
  }, 120_000);
});
