import { solveForm } from '../content/lexicon';
import type { Exercise, SegmentTag, Vocab } from '../content/schema';
import type { Inflection } from '../morphology';
import type { AnswerResult } from '../lib/answer';
import { trLower } from '../lib/turkish';
import { seededShuffle } from '../lib/shuffle';

type Segment = Extract<Exercise, { type: 'segment' }>;

// Antwort einer Zerlege-Übung als Text (wie die Tabellen): Stücke mit | getrennt, darunter die
// Rollen mit ; getrennt. ev|ler|imiz|den\nSTEM;PL;POSS_1PL;ABL. Leere Rolle = noch nicht gewählt.

export interface SegmentAnswer {
  pieces: string[];
  tags: (SegmentTag | '')[];
}

export const segmentAnswer = ({ pieces, tags }: SegmentAnswer): string =>
  `${pieces.join('|')}\n${tags.join(';')}`;

export function parseSegmentAnswer(answer: string): SegmentAnswer {
  const [pieces = '', tags = ''] = answer.split('\n');
  return {
    pieces: pieces ? pieces.split('|') : [],
    tags: tags.split(';') as SegmentAnswer['tags'],
  };
}

/** Buchstaben des Worts ohne feste Grenzen (Leerzeichen, Apostroph); daraus entstehen die Stücke. */
export const segmentLetters = (word: string): string => word.replace(/[\s'’]/g, '');

/**
 * Stellen, an denen ohnehin ein neues Stück beginnt (nach Leerzeichen bzw. Apostroph),
 * als Index in `segmentLetters`: geliyor musun → [7], İstanbul'da → [8].
 */
export function fixedBoundaries(word: string): number[] {
  const out: number[] = [];
  let i = 0;
  for (const ch of word) {
    if (/[\s'’]/.test(ch)) {
      if (i > 0 && out.at(-1) !== i) out.push(i);
    } else i++;
  }
  return out;
}

/** Stücke aus gesetzten Grenzen (Index = Anzahl Buchstaben davor), feste Grenzen inklusive. */
export function piecesFromCuts(word: string, cuts: Iterable<number>): string[] {
  const letters = segmentLetters(word);
  const all = [...new Set([...cuts, ...fixedBoundaries(word)])]
    .filter((c) => c > 0 && c < letters.length)
    .sort((a, b) => a - b);
  return [0, ...all].map((start, i) => letters.slice(start, all[i] ?? letters.length));
}

/** Je Stück der Lösung: Grenze richtig gesetzt, Rolle richtig gewählt. */
export interface PieceResult {
  text: string;
  tag: SegmentTag;
  /** Das Stück steht genau so in der Antwort (Anfang und Ende stimmen). */
  found: boolean;
  /** Gefunden und mit der richtigen Rolle. */
  correct: boolean;
}

type Piece = Segment['segments'][number];

/** Die gültigen Zerlegungen: die der Engine, dazu ggf. die zweite übliche (bekli-yor). */
export const segmentVariants = (ex: Segment): Piece[][] =>
  ex.alt_segments ? [ex.segments, ex.alt_segments] : [ex.segments];

function compare(solution: readonly Piece[], given: SegmentAnswer): PieceResult[] {
  const starts = new Map<number, number>();
  let at = 0;
  given.pieces.forEach((p, i) => {
    starts.set(at, i);
    at += p.length;
  });
  at = 0;
  return solution.map((seg) => {
    const i = starts.get(at);
    at += seg.text.length;
    const found = i !== undefined && trLower(given.pieces[i]!) === trLower(seg.text);
    // Der Stamm hat keine Auswahl: richtig, sobald seine Grenze stimmt.
    const correct = found && (seg.tag === 'STEM' || given.tags[i!] === seg.tag);
    return { text: seg.text, tag: seg.tag, found, correct };
  });
}

const score = (r: PieceResult[]) => r.filter((p) => p.correct).length;

/**
 * Vergleicht Stück für Stück mit der Zerlegung, die der Antwort am nächsten liegt (bei
 * Gleichstand die der Engine); Groß/Klein zählt nicht (İstanbul ↔ istanbul).
 */
export function segmentPieces(ex: Segment, answer: string): PieceResult[] {
  const given = parseSegmentAnswer(answer);
  const results = segmentVariants(ex).map((v) => compare(v, given));
  return results.reduce((best, r) => (score(r) > score(best) ? r : best));
}

/** Richtig nur, wenn alle Grenzen und alle Rollen stimmen und es keine zusätzlichen Stücke gibt. */
export function gradeSegment(ex: Segment, answer: string): AnswerResult {
  const given = parseSegmentAnswer(answer);
  const hit = segmentVariants(ex).find(
    (v) => given.pieces.length === v.length && compare(v, given).every((p) => p.correct),
  );
  return hit
    ? { verdict: 'correct', matched: hit.map((s) => s.text).join('-'), hints: [] }
    : { verdict: 'wrong', hints: [] };
}

/** Lösung zum Anzeigen: ev-ler-imiz-den. */
export const solutionOfSegment = (ex: Segment): string => ex.segments.map((s) => s.text).join('-');

// Verwechslungsgruppen: Rollen, die sich in Form oder Bedeutung ähneln.
const CONFUSABLE: readonly (readonly SegmentTag[])[] = [
  ['ACC', 'DAT', 'LOC', 'ABL', 'GEN', 'INS'],
  ['POSS_1SG', 'POSS_2SG', 'POSS_3SG', 'POSS_1PL', 'POSS_2PL', 'POSS_3PL', 'ACC'],
  ['P1SG', 'P2SG', 'P3SG', 'P1PL', 'P2PL', 'P3PL', 'POSS_1SG', 'POSS_2SG', 'POSS_1PL'],
  ['PL', 'P3PL', 'POSS_3PL'],
  ['PRES', 'PAST', 'FUT', 'AOR', 'EVID', 'NEC', 'IMP', 'COND', 'OPT'],
  ['NEG', 'Q', 'ABIL', 'NEG_COP', 'PASS'],
  // ohne Zeitformen: sonst bekämen A2-Formen (yaptım) Partizip-Rollen als Ablenker
  ['PART_AN', 'PART_DIK', 'PART_ACAK', 'VN_MA', 'VN_MAK', 'VN_IS'],
  ['CV_IP', 'CV_ARAK', 'CV_INCA', 'CV_ALI', 'CV_MADAN'],
  ['LI', 'SIZ', 'LIK', 'CI', 'KI'],
  ['DIR', 'P3SG', 'LOC'],
];

/** Höchstens so viele Rollen, die nicht im Wort vorkommen. */
export const MAX_ROLE_DISTRACTORS = 4;

/**
 * Auswahl der Rollen für die Endungen: alle richtigen plus Verwechsler aus denselben Gruppen
 * (Kasus untereinander, Possessiv ↔ Personalendung, Zeiten …), stabil gemischt.
 */
export function segmentRoleOptions(ex: Segment): SegmentTag[] {
  const correct = [...new Set(ex.segments.slice(1).map((s) => s.tag))];
  const pool = [
    ...new Set(CONFUSABLE.filter((g) => correct.some((c) => g.includes(c))).flat()),
  ].filter((tag) => !correct.includes(tag));
  const distractors = seededShuffle(pool, `${ex.id}:roles`).slice(0, MAX_ROLE_DISTRACTORS);
  return seededShuffle([...correct, ...distractors], `${ex.id}:options`);
}

/** Engine-Form der Übung (Begründung im Feedback); `vocab` = Wortschatz und Lexikon der Unit. */
export const segmentSolution = (ex: Segment, vocab: readonly Vocab[] = []): Inflection =>
  solveForm(ex.analysis, vocab);
