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
import { annotateSpeech, courseWords } from '../src/audio/turkish-detect';
import { withAlternatives } from '../src/content/lexicon';
import { withListening } from '../src/content/listening';
import { checkGlossary, withPassages } from '../src/content/reading';
import { vocabId } from '../src/content/schema';
import { withSegments } from '../src/content/segmenting';
import { caseHints, withWordOrder } from '../src/content/word-order';
import { t } from '../src/i18n';
import { buildLookup, duplicateSlugs, LOOKUP_WARN_BYTES } from '../src/lookup/index-build';
import { prepareLookup } from '../src/lookup/search';
import { selectPlacement } from '../src/placement/select';
import {
  checkListen,
  checkSegments,
  checkWordOrder,
  checkSuffixTargets,
  checkUnits,
  foreignLexicon,
  isUnitFile,
  manifestEntry,
  parsePlacementFile,
  parseUnitFile,
  PLACEMENT_FILE,
  type LoadedUnit,
} from './content-checks';

const CONTENT_DIR = 'content';
const OUT_DIR = join('public', 'content');

const files = readdirSync(CONTENT_DIR, { recursive: true, encoding: 'utf8' })
  .filter(isUnitFile)
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

// Erzeugte Lektionen aus vorhandenen Inhalten, je vor der Wiederholung: Wörter zerlegen
// (src/content/segmenting.ts), Satzbau aus annotierten Wortbank-Sätzen (word-order.ts), Hören (src/content/listening.ts; die App blendet es ohne
// türkische Stimme aus).
const SEGMENT_LESSONS = true;
const ORDER_LESSONS = true;
const LISTENING_LESSONS = true;
// Lesetexte mit `passage` (Lektion <unit>-r1): geprüft und aufgelöst werden sie immer; aus
// geschaltet fehlen sie in der App (z. B. falls die Lese-Ansicht einmal nicht verfügbar ist).
const READING_LESSONS = true;
const words = courseWords(units.map(({ unit }) => unit));
const allVocab = units.flatMap(({ unit }) => unit.vocab ?? []);
const cases = caseHints(units.map(({ unit }) => unit));
// Lesetexte: jedes Wort über Vokabeln, Engine-Formen oder das Glossar des Textes auflösen.
const reading = prepareLookup(
  buildLookup(
    units.map(({ unit }) => unit),
    new Map(),
  ),
);
const vocabIds = new Set(allVocab.map(vocabId));
const readingWarnings: string[] = [];
const built: LoadedUnit[] = units.map(({ file, unit }) => {
  errors.push(...checkGlossary(unit, vocabIds).map((e) => `${file}: ${e}`));
  const annotated = withPassages(unit, reading);
  readingWarnings.push(...annotated.warnings.map((w) => `${file}: ${w}`));
  let out = READING_LESSONS
    ? annotated.unit
    : { ...annotated.unit, lessons: annotated.unit.lessons.filter((l) => !l.passage) };
  if (SEGMENT_LESSONS) out = withSegments(out, t('segment.lessonTitle'), allVocab);
  if (ORDER_LESSONS) out = withWordOrder(out, t('word_order.lessonTitle'), cases);
  if (LISTENING_LESSONS) out = withListening(out, t('listen.lessonTitle'));
  out = withAlternatives(out, allVocab);
  return { file, unit: annotateSpeech(out, words) };
});
errors.push(...checkListen(built), ...checkSegments(built), ...checkWordOrder(built));
if (SEGMENT_LESSONS) {
  const counts = built.map(
    ({ unit }) => unit.lessons.find((l) => l.type === 'segmenting')?.exercises.length ?? 0,
  );
  console.info(
    `Wörter zerlegen: ${counts.reduce((a, b) => a + b, 0)} Formen (${counts.join(' ')})`,
  );
}

// Einstufungstest: je Unit Probe und Bestätigung aus vorhandenen Übungen (src/placement/select.ts).
const overrides = existsSync(join(CONTENT_DIR, PLACEMENT_FILE))
  ? parsePlacementFile(readFileSync(join(CONTENT_DIR, PLACEMENT_FILE), 'utf8'))
  : { overrides: {}, errors: [] };
errors.push(...overrides.errors);
const placement = selectPlacement(
  built.map(({ unit }) => unit),
  overrides,
  allVocab,
);
errors.push(...placement.errors);

const explainers = new Map<string, string>();
for (const { file, unit } of units) {
  if (!unit.explainer || !existsSync(join(CONTENT_DIR, unit.explainer))) continue;
  const md = readFileSync(join(CONTENT_DIR, unit.explainer), 'utf8');
  explainers.set(unit.explainer, md);
  for (const slug of duplicateSlugs(md)) {
    errors.push(`${file}: ${unit.explainer}: Überschrift doppelt (Anker "${slug}")`);
  }
}

for (const w of [...report.warnings, ...readingWarnings]) console.warn(`⚠ ${w}`);
if (errors.length > 0) {
  for (const e of errors) console.error(`✖ ${e}`);
  console.error(`\nContent ungültig: ${errors.length} Fehler.`);
  process.exit(1);
}

rmSync(OUT_DIR, { recursive: true, force: true });
mkdirSync(join(OUT_DIR, 'units'), { recursive: true });
for (const { unit } of built) {
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
const manifest = built.map(({ unit }) => manifestEntry(unit));
writeFileSync(join(OUT_DIR, 'index.json'), JSON.stringify({ units: manifest }, null, 2));
writeFileSync(join(OUT_DIR, 'placement.json'), JSON.stringify(placement.plan));
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
const mc = built
  .flatMap(({ unit }) => unit.lessons.flatMap((l) => l.exercises))
  .filter((e) => e.type === 'multiple_choice');
console.log(
  `ℹ Vorlesen bei Multiple Choice: ${mc.filter((e) => e.speak_prompt).length} Prompts, ` +
    `${mc.filter((e) => e.speak_answer).length} Lösungen von ${mc.length}`,
);
console.log(`✔ ${units.length} Unit(s) validiert und nach ${OUT_DIR} geschrieben.`);
