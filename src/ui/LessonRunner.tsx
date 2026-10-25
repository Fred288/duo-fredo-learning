import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import type { Verdict } from '../lib/answer';
import type { Lesson, Vocab } from '../content/schema';
import { t } from '../i18n';
import { explainSteps } from '../i18n/explain';
import { grade, isSupported, solutionOf } from '../session/grade';
import {
  createSession,
  currentExercise,
  next,
  submit,
  summary,
  type Session,
} from '../session/session';
import { suffixTiles } from '../session/suffix-tiles';
import { useSettings } from '../store/settings';
import { Feedback } from './Feedback';
import { FreeTextInput } from './exercises/FreeTextInput';
import { MultipleChoiceInput } from './exercises/MultipleChoiceInput';
import { SuffixBuilderInput } from './exercises/SuffixBuilderInput';
import { WordBankInput } from './exercises/WordBankInput';

const buttonBase =
  'min-h-12 w-full rounded-xl px-5 font-medium focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-teal-600 disabled:opacity-40';

interface Props {
  lesson: Lesson;
  /** Wortschatz der Unit; liefert Harmonie-/Erweichungs-Flags für Suffix-Builder. */
  vocab?: readonly Vocab[];
  onExit: () => void;
  /** Erster Versuch je Übung und Lauf. */
  onAttempt?: (exerciseId: string, verdict: Verdict) => void;
  /** Einmal pro abgeschlossenem Lauf; zählt den ersten Versuch je Übung. */
  onComplete?: (correct: number, total: number) => void;
}

export function LessonRunner({ lesson, vocab = [], onExit, onAttempt, onComplete }: Props) {
  const tolerateDiacritics = useSettings((s) => s.tolerateDiacritics);
  const exercises = useMemo(() => lesson.exercises.filter(isSupported), [lesson]);
  const [session, setSession] = useState(() => createSession(exercises));
  const [answer, setAnswer] = useState('');

  const ex = currentExercise(session);
  const supported = ex && isSupported(ex) ? ex : undefined;

  const check = useCallback(() => {
    if (!supported || !answer.trim()) return;
    const result = grade(supported, answer, { tolerateDiacritics });
    if (!(supported.id in session.firstTry)) onAttempt?.(supported.id, result.verdict);
    setSession((s) => submit(s, result));
  }, [supported, answer, tolerateDiacritics, session.firstTry, onAttempt]);

  // Abschluss genau einmal melden, auch unter StrictMode (doppelte Effekte).
  const reported = useRef<Session>(null);
  useEffect(() => {
    if (session.phase !== 'done' || exercises.length === 0 || reported.current === session) return;
    reported.current = session;
    const { correct, total } = summary(session);
    onComplete?.(correct, total);
  }, [session, exercises.length, onComplete]);

  const proceed = useCallback(() => {
    setAnswer('');
    setSession((s) => next(s));
  }, []);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      // Aktive Buttons lösen Enter selbst aus; sonst würde doppelt geprüft.
      // Ein gerade deaktivierter Baustein kann den Fokus noch halten.
      const button = e.target instanceof HTMLButtonElement ? e.target : undefined;
      if (e.key !== 'Enter' || (button && !button.disabled)) return;
      e.preventDefault();
      if (session.phase === 'feedback') proceed();
      else if (session.phase === 'answering') check();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [session.phase, check, proceed]);

  if (session.phase === 'done') {
    const { correct, total } = summary(session);
    return (
      <section aria-labelledby="done-title" className="space-y-4 text-center">
        <h2 id="done-title" className="text-xl font-semibold">
          {exercises.length ? t('done.title') : t('runner.empty')}
        </h2>
        {exercises.length > 0 && <p>{t('done.score', { correct, total })}</p>}
        <div className="space-y-2">
          {exercises.length > 0 && (
            <button
              type="button"
              className={`${buttonBase} bg-stone-200 dark:bg-stone-800`}
              onClick={() => setSession(createSession(exercises))}
            >
              {t('done.again')}
            </button>
          )}
          <button
            type="button"
            autoFocus
            className={`${buttonBase} bg-teal-700 text-white`}
            onClick={onExit}
          >
            {t('done.home')}
          </button>
        </div>
      </section>
    );
  }

  if (!supported) return null;
  const answering = session.phase === 'answering';
  const total = session.queue.length;

  return (
    <section className="space-y-6">
      <header className="flex items-center gap-3">
        <button
          type="button"
          onClick={onExit}
          className="min-h-11 rounded-lg px-3 text-stone-600 hover:bg-stone-200 dark:text-stone-400 dark:hover:bg-stone-800"
        >
          ← {t('runner.back')}
        </button>
        <div
          role="progressbar"
          aria-label={t('runner.progress', { current: session.index + 1, total })}
          aria-valuemin={0}
          aria-valuemax={total}
          aria-valuenow={session.index}
          className="h-2 flex-1 overflow-hidden rounded-full bg-stone-200 dark:bg-stone-800"
        >
          <div
            className="h-full bg-teal-600 transition-[width]"
            style={{ width: `${(session.index / total) * 100}%` }}
          />
        </div>
      </header>

      <div key={`${supported.id}-${session.index}`}>
        {supported.type === 'multiple_choice' && (
          <MultipleChoiceInput
            ex={supported}
            value={answer}
            onChange={setAnswer}
            disabled={!answering}
          />
        )}
        {supported.type === 'word_bank' && (
          <WordBankInput ex={supported} onChange={setAnswer} disabled={!answering} />
        )}
        {supported.type === 'free_text' && (
          <FreeTextInput ex={supported} value={answer} onChange={setAnswer} disabled={!answering} />
        )}
        {supported.type === 'suffix_builder' && (
          <SuffixBuilderInput
            ex={supported}
            vocab={vocab}
            onChange={setAnswer}
            disabled={!answering}
          />
        )}
      </div>

      {answering ? (
        <button
          type="button"
          onClick={check}
          disabled={!answer.trim()}
          className={`${buttonBase} bg-teal-700 text-white`}
        >
          {t('runner.check')}
        </button>
      ) : (
        <div className="space-y-4">
          <Feedback
            result={session.last!}
            solution={solutionOf(supported)}
            reasons={
              supported.type === 'suffix_builder'
                ? explainSteps(suffixTiles(supported, vocab).solution.steps)
                : undefined
            }
            explanation={supported.explanation ?? supported.hint}
            retry={session.queue.slice(session.index + 1).some((e) => e.id === supported.id)}
          />
          <button
            type="button"
            autoFocus
            onClick={proceed}
            className={`${buttonBase} bg-teal-700 text-white`}
          >
            {t('runner.continue')}
          </button>
        </div>
      )}
    </section>
  );
}
