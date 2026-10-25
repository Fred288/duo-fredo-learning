import { foldDiacritics, levenshtein, normalizeAnswer } from './turkish';

export type Verdict = 'correct' | 'almost' | 'wrong';
export type AnswerHint = 'diacritics' | 'typo';

export interface AnswerResult {
  verdict: Verdict;
  /** Die akzeptierte Lösung, der die Eingabe zugeordnet wurde. */
  matched?: string;
  hints: AnswerHint[];
}

export interface AnswerOptions {
  /** Fehlende Sonderzeichen (s statt ş) als richtig mit Hinweis werten. */
  tolerateDiacritics?: boolean;
  /** Ein Tippfehler bei längeren Wörtern = fast richtig. In Grammatikübungen aus. */
  allowTypos?: boolean;
}

const TYPO_MIN_LENGTH = 5;

/** Prüft eine Freitext-Antwort gegen alle akzeptierten Lösungen, beste Bewertung gewinnt. */
export function checkAnswer(
  input: string,
  accepted: readonly string[],
  { tolerateDiacritics = false, allowTypos = true }: AnswerOptions = {},
): AnswerResult {
  const given = normalizeAnswer(input);
  if (!given) return { verdict: 'wrong', hints: [] };
  const givenFolded = foldDiacritics(given);

  let best: (AnswerResult & { rank: number }) | undefined;
  const offer = (rank: number, verdict: Verdict, matched: string, hints: AnswerHint[]) => {
    if (!best || rank < best.rank) best = { rank, verdict, matched, hints };
  };

  for (const answer of accepted) {
    const target = normalizeAnswer(answer);
    const targetFolded = foldDiacritics(target);
    const typoAllowed = allowTypos && target.length >= TYPO_MIN_LENGTH;

    if (given === target) offer(0, 'correct', answer, []);
    else if (givenFolded === targetFolded) {
      offer(tolerateDiacritics ? 1 : 3, tolerateDiacritics ? 'correct' : 'almost', answer, [
        'diacritics',
      ]);
    } else if (typoAllowed && levenshtein(given, target) <= 1) {
      offer(2, 'almost', answer, ['typo']);
    } else if (typoAllowed && tolerateDiacritics && levenshtein(givenFolded, targetFolded) <= 1) {
      offer(4, 'almost', answer, ['diacritics', 'typo']);
    }
  }

  if (!best) return { verdict: 'wrong', hints: [] };
  const { verdict, matched, hints } = best;
  return { verdict, matched, hints };
}
