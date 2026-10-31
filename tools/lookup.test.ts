// Strukturtests des Nachschlage-Index über die echten Inhalte in content/.
import { readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { vocabId } from '../src/content/schema';
import { allForms, formTable } from '../src/lookup/forms';
import { searchKey } from '../src/lookup/key';
import { buildLookup, duplicateSlugs, LOOKUP_WARN_BYTES } from '../src/lookup/index-build';
import { lemmatize, prepareLookup, search } from '../src/lookup/search';
import { isUnitFile, parseUnitFile } from './content-checks';

const units = readdirSync('content', { recursive: true, encoding: 'utf8' })
  .filter(isUnitFile)
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

describe('Suche über die echten Inhalte', () => {
  const prepared = prepareLookup(index);
  const top = (q: string, n = 3) =>
    search(prepared, q)
      .vocab.slice(0, n)
      .map((h) => h.entry.id);

  it.each([
    ['kitabi', 'kitap'],
    ['evlerde', 'ev'],
    ['Tisch', 'masa'],
    ['oglum', 'oğul'],
    ["istanbul'da", 'İstanbul'],
    ['gidiyorum', 'gitmek'],
    ['gelmedim', 'gelmek'],
  ])('%s findet %s weit oben', (q, id) => {
    expect(top(q)).toContain(id);
  });

  it('Komposita mit Possessivendung', () => {
    expect(top('atasözleri', 1)).toEqual(['atasözü']);
    expect(top('atasözünde', 1)).toEqual(['atasözü']);
    expect(top('trafik ışığında', 1)).toEqual(['trafik ışığı']);
    expect(top('iş görüşmeleri', 1)).toEqual(['iş görüşmesi']);
    expect(top('cep telefonumu', 1)).toEqual(['cep telefonu']);
    expect(top('buzdolabında', 1)).toEqual(['buzdolabı']);
    expect(top('birbirine', 1)).toEqual(['birbiri']);
    const atasozu = index.vocab.find((v) => v.tr === 'atasözü')!;
    const table = formTable(atasozu);
    expect(table?.kind === 'noun' && table.rows[0]).toMatchObject({
      sg: 'atasözü',
      pl: 'atasözleri',
    });
    expect(allForms(atasozu).map((f) => f.form)).not.toContain('atasözüler');
  });

  it('yemek findet Verb und Nomen', () => {
    expect(top('yemek', 2).sort()).toEqual(['yemek', 'yemek-essen']);
  });

  it('Grammatikbegriffe finden Abschnitte', () => {
    expect(search(prepared, 'Vokalharmonie').sections.length).toBeGreaterThan(0);
    expect(search(prepared, 'değil').sections[0]!.section.title).toMatch(/değil/);
  });

  it('Rundlauf: jede Engine-Form führt auf ihre Vokabel zurück', () => {
    // Formen, die auch Grundform eines anderen Eintrags sind, sind vom Treffer-Test ausgenommen.
    const bare = new Set(index.vocab.map((v) => searchKey(v.tr)));
    const failures: string[] = [];
    for (const entry of index.vocab) {
      for (const f of allForms(entry)) {
        const q = searchKey(f.form);
        if (q.length < 3 || bare.has(q)) continue;
        const found = lemmatize(prepared, f.form).some((h) => h.entry.id === entry.id);
        if (!found) failures.push(`${entry.id}: ${f.form}`);
      }
    }
    expect(failures.slice(0, 20)).toEqual([]);
    // Läuft über alle Formen des Kurses: im parallelen Gesamtlauf langsamer als der Standard.
  }, 30_000);

  it('kurze Stämme: die gebeugte Form steht vor Präfix- und Teilwort-Rauschen', () => {
    expect(top('evi', 1)).toEqual(['ev']);
    expect(top('ona', 1)).toEqual(['o']);
    expect(top('ister', 1)).toEqual(['istemek']);
    expect(top('üçü', 1)).toEqual(['üç']);
    expect(top('eve', 1)).toEqual(['ev']);
  });

  it('Präsens von Verben auf -a/-e', () => {
    for (const [q, id] of [
      ['anlıyorum', 'anlamak'],
      ['bekliyorum', 'beklemek'],
      ['istiyorum', 'istemek'],
      ['söylüyorum', 'söylemek'],
      ['yaşıyorum', 'yaşamak'],
    ] as const)
      expect(top(q)).toContain(id);
  });

  it('Aorist von kaybetmek und hissetmek', () => {
    expect(top('kaybederim')).toContain('kaybetmek');
    expect(top('hissederim')).toContain('hissetmek');
    expect(top('hissedirim')).not.toContain('hissetmek');
  });

  it('jede Formtabelle lässt sich bilden (keine Engine-Ausnahme)', () => {
    for (const v of index.vocab) expect(() => formTable(v)).not.toThrow();
  });

  // Grobe Obergrenze (gemessen ~80 ms): fängt Ausreißer, ohne auf langsamen oder ausgelasteten Rechnern zu kippen.
  it('100 Anfragen in unter 2 s', () => {
    const queries = ['ev', 'evlerde', 'kitabı', 'gidiyorum', 'Tisch', 'sch', 'a', 'lokativ', 'ge'];
    search(prepared, 'warm');
    const t = performance.now();
    for (let i = 0; i < 100; i++) search(prepared, queries[i % queries.length]!);
    expect(performance.now() - t).toBeLessThan(2000);
  });
});
