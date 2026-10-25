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
import {
  checkSuffixTargets,
  checkUnits,
  countUnreviewed,
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

for (const w of report.warnings) console.warn(`⚠ ${w}`);
if (errors.length > 0) {
  for (const e of errors) console.error(`✖ ${e}`);
  console.error(`\nContent ungültig: ${errors.length} Fehler.`);
  process.exit(1);
}

rmSync(OUT_DIR, { recursive: true, force: true });
mkdirSync(join(OUT_DIR, 'units'), { recursive: true });
for (const { unit } of units) {
  writeFileSync(join(OUT_DIR, 'units', `${unit.id}.json`), JSON.stringify(unit));
}
for (const { unit } of units) {
  if (!unit.explainer) continue;
  const target = join(OUT_DIR, unit.explainer);
  mkdirSync(dirname(target), { recursive: true });
  copyFileSync(join(CONTENT_DIR, unit.explainer), target);
}
const manifest = units.map(({ unit }) => ({
  id: unit.id,
  level: unit.level,
  title: unit.title,
  explainer: unit.explainer,
  reviewed: unit.reviewed,
  unreviewed: countUnreviewed(unit),
  lessons: unit.lessons.map((l) => ({ id: l.id, type: l.type, title: l.title })),
}));
writeFileSync(join(OUT_DIR, 'index.json'), JSON.stringify({ units: manifest }, null, 2));
console.log(`✔ ${units.length} Unit(s) validiert und nach ${OUT_DIR} geschrieben.`);
