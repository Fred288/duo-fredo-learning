import { t } from '../i18n';
import type { AnswerResult } from '../lib/answer';

const tone = {
  correct:
    'border-emerald-300 bg-emerald-50 text-emerald-900 dark:border-emerald-800 dark:bg-emerald-950 dark:text-emerald-100',
  almost:
    'border-amber-300 bg-amber-50 text-amber-900 dark:border-amber-800 dark:bg-amber-950 dark:text-amber-100',
  wrong:
    'border-rose-300 bg-rose-50 text-rose-900 dark:border-rose-800 dark:bg-rose-950 dark:text-rose-100',
};

interface Props {
  result: AnswerResult;
  solution: string;
  explanation?: string;
  retry: boolean;
}

export function Feedback({ result, solution, explanation, retry }: Props) {
  const shown = result.matched ?? solution;
  return (
    <div
      role="status"
      aria-live="polite"
      className={`rounded-xl border p-4 ${tone[result.verdict]}`}
    >
      <p className="font-semibold">{t(`feedback.${result.verdict}`)}</p>
      {result.verdict !== 'correct' || result.hints.length > 0 ? (
        <p className="mt-1" lang="tr">
          {t('feedback.solution', { answer: shown })}
        </p>
      ) : null}
      {result.hints.map((h) => (
        <p key={h} className="mt-1 text-sm">
          {t(`feedback.hint.${h}`)}
        </p>
      ))}
      {explanation && <p className="mt-2 text-sm">{explanation}</p>}
      {retry && <p className="mt-2 text-sm opacity-80">{t('feedback.retry')}</p>}
    </div>
  );
}
