// Validiert content/**/*.yaml und schreibt lazy ladbare JSON-Bundles nach public/content/.
// Ungültige Inhalte beenden den Prozess mit Exit-Code 1 und brechen damit dev/build.
import {
  copyFileSync,
  existsSync,
  mkdirSync,
  readdirSync,
  readFileSync,
  rmSync,
  writeFileSync,
} from 'node:fs';
import { dirname, join, relative } from 'node:path';
import { buildLookup, duplicateSlugs, LOOKUP_WARN_BYTES } from '../src/lookup/index-build';
import {
  checkSuffixTargets,
  checkUnits,
  foreignLexicon,
  manifestEntry,
  parseUnitFile,
  type LoadedUnit,
} from './content-checks';

const CONTENT_DIR = 'content';
const OUT_DIR = join('public', 'content');

const files = readdirSync(CONTENT_DIR, { recursive: true, encoding: 'utf8' })
  .filter((f) => /\.ya?ml$/.test(f))
  .map((f) => join(CONTENT_DIR, f))
  .sort();

const units: LoadedUnit[] = [];
const errors: string[] = [];
for (const file of files) {
  const rel = relative('.', file).replaceAll('\\', '/');
  const result = parseUnitFile(rel, readFileSync(file, 'utf8'));
  errors.push(...result.errors);
  if (result.unit) units.push({ file: rel, unit: result.unit });
}

const report = checkUnits(units, (p) => existsSync(join(CONTENT_DIR, p)));
errors.push(...report.errors, ...checkSuffixTargets(units));

const explainers = new Map<string, string>();
for (const { file, unit } of units) {
  if (!unit.explainer || !existsSync(join(CONTENT_DIR, unit.explainer))) continue;
  const md = readFileSync(join(CONTENT_DIR, unit.explainer), 'utf8');
  explainers.set(unit.explainer, md);
  for (const slug of duplicateSlugs(md)) {
    errors.push(`${file}: ${unit.explainer}: Überschrift doppelt (Anker "${slug}")`);
  }
}

for (const w of report.warnings) console.warn(`⚠ ${w}`);
if (errors.length > 0) {
  for (const e of errors) console.error(`✖ ${e}`);
  console.error(`\nContent ungültig: ${errors.length} Fehler.`);
  process.exit(1);
}

rmSync(OUT_DIR, { recursive: true, force: true });
mkdirSync(join(OUT_DIR, 'units'), { recursive: true });
for (const { unit } of units) {
  const lexicon = foreignLexicon(unit, units);
  const out = lexicon.length > 0 ? { ...unit, lexicon } : unit;
  writeFileSync(join(OUT_DIR, 'units', `${unit.id}.json`), JSON.stringify(out));
}
for (const { unit } of units) {
  if (!unit.explainer) continue;
  const target = join(OUT_DIR, unit.explainer);
  mkdirSync(dirname(target), { recursive: true });
  copyFileSync(join(CONTENT_DIR, unit.explainer), target);
}
const manifest = units.map(({ unit }) => manifestEntry(unit));
writeFileSync(join(OUT_DIR, 'index.json'), JSON.stringify({ units: manifest }, null, 2));
const lookup = JSON.stringify(
  buildLookup(
    units.map(({ unit }) => unit),
    explainers,
  ),
);
writeFileSync(join(OUT_DIR, 'lookup.json'), lookup);
if (lookup.length > LOOKUP_WARN_BYTES) {
  console.warn(`⚠ lookup.json ist ${Math.round(lookup.length / 1000)} KB groß (Precache)`);
}
console.log(`✔ ${units.length} Unit(s) validiert und nach ${OUT_DIR} geschrieben.`);
