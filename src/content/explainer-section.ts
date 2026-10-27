import { trLower } from '../lib/turkish';
import { searchKey } from '../lookup/key';
import type { Exercise } from './schema';

export interface ExplainerSection {
  title: string;
  body: string;
}

/** Anker einer Überschrift („mit: ile / -le, -la“ → `mit-ile-le-la`), innerhalb einer Karte eindeutig. */
export const sectionSlug = (title: string): string =>
  searchKey(title.replaceAll('**', '')).replaceAll(' ', '-');

/** Abschnitte einer Erklärkarte an den ##-Überschriften; Titel und Einleitung davor entfallen. */
export function explainerSections(markdown: string): ExplainerSection[] {
  const out: ExplainerSection[] = [];
  for (const line of markdown.replaceAll('\r\n', '\n').split('\n')) {
    const heading = /^##\s+(.*)$/.exec(line);
    if (heading) out.push({ title: heading[1]!.trim(), body: '' });
    else if (out.length) out.at(-1)!.body += `${line}\n`;
  }
  return out.map((s) => ({ ...s, body: s.body.trim() }));
}

// Wörter ohne Markdown-Fett und Apostroph (masa**nın**, Ayşe'den), ab drei Buchstaben.
const words = (text: string, min = 3) =>
  new Set(
    trLower(text.replaceAll('**', '').replace(/['’]/g, ''))
      .split(/[^\p{L}]+/u)
      .filter((w) => w.length >= min),
  );

// Lektionstitel sind von Hand gewählt wie die Überschriften („mit (ile, -le)“ ↔ „mit: ile / -le, -la“):
// Treffer in der Überschrift zählen doppelt, auch kurze Suffixe wie „ci“, ohne Füllwörter.
const TITLE_WEIGHT = 2;
const FILLER = new Set([
  'und',
  'oder',
  'der',
  'die',
  'das',
  'den',
  'dem',
  'des',
  'ein',
  'eine',
  'wie',
  'ist',
  'sein',
]);

/** Türkischer Stoff der Übung: Lösungen, Stamm, Prompt und Erklärung. */
function exerciseText(ex: Exercise): string {
  const parts: (string | undefined)[] = [
    'prompt' in ex ? ex.prompt : undefined,
    ex.explanation,
    ex.hint,
  ];
  switch (ex.type) {
    case 'multiple_choice':
      parts.push(ex.answer);
      break;
    case 'word_bank':
    case 'free_text':
      parts.push(...ex.answers);
      break;
    case 'suffix_builder':
      parts.push(ex.stem, ex.target);
      break;
    case 'conjugation':
      parts.push(ex.lemma, ex.target);
      break;
    case 'paradigm':
      parts.push(ex.lemma, ...ex.targets);
      break;
    case 'listen':
      parts.push(ex.text);
      break;
  }
  return parts.filter(Boolean).join(' ');
}

/** Wortform oder ihr längster Anfang ab vier Buchstaben, der im Abschnitt steht (evliyim → evli). */
function hit(word: string, vocab: Set<string>): string | undefined {
  for (let n = word.length; n >= Math.min(4, word.length); n--) {
    if (vocab.has(word.slice(0, n))) return word.slice(0, n);
  }
  return undefined;
}

/** Mindestpunktzahl: ein Wort, das nur in diesem Abschnitt steht, oder mehrere seltene. */
const MIN_SCORE = 1;

/**
 * Abschnitt der Erklärkarte, der am besten zur Übung passt: Wörter der Übung, die im Abschnitt
 * vorkommen, gewichtet nach Seltenheit (ein Wort aus nur einem Abschnitt zählt 1, eines aus
 * zwei Abschnitten ½ …), dazu der Lektionstitel. Unter der Mindestpunktzahl kein Abschnitt.
 */
export function sectionFor(
  markdown: string,
  ex: Exercise,
  lessonTitle = '',
): ExplainerSection | undefined {
  const sections = explainerSections(markdown);
  const vocab = sections.map((s) => words(`${s.title} ${s.body}`));
  const headings = sections.map((s) => words(s.title, 2));
  const spread = (w: string) => vocab.filter((v) => v.has(w)).length;
  const own = [...words(exerciseText(ex))];
  const title = [...words(lessonTitle, 2)].filter((w) => !FILLER.has(w));
  let best: ExplainerSection | undefined;
  let bestScore = MIN_SCORE - Number.EPSILON;
  sections.forEach((section, i) => {
    const found = new Set(own.flatMap((w) => hit(w, vocab[i]!) ?? []));
    const score =
      [...found].reduce((sum, w) => sum + 1 / spread(w), 0) +
      title.filter((w) => headings[i]!.has(w)).length * TITLE_WEIGHT;
    if (score > bestScore) [best, bestScore] = [section, score];
  });
  return best;
}
