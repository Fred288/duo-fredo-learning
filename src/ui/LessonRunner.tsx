import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import type { Verdict } from '../lib/answer';
import type { Exercise, Lesson, Vocab } from '../content/schema';
import type { ExplainerSection } from '../content/explainer-section';
import { speakables } from '../audio/speakables';
import { t } from '../i18n';
import { explainSteps } from '../i18n/explain';
import { grade, isSupported, paradigmCells, solutionOf, type Supported } from '../session/grade';
import {
  createSession,
  currentExercise,
  next,
  skip,
  submit,
  summary,
  type Session,
} from '../session/session';
import { stopSpeaking, useAudio, useAutoplay, useCanSpeak } from '../store/audio';
import { useSettings } from '../store/settings';
import { solveExercise, solveParadigm } from '../content/lexicon';
import { ConjugationInput } from './exercises/ConjugationInput';
import { Feedback } from './Feedback';
import { GrammarHint } from './GrammarHint';
import { ReportError } from './ReportError';
import { FreeTextInput } from './exercises/FreeTextInput';
import { ListenInput } from './exercises/ListenInput';
import { MultipleChoiceInput } from './exercises/MultipleChoiceInput';
import { ParadigmInput } from './exercises/ParadigmInput';
import { SuffixBuilderInput } from './exercises/SuffixBuilderInput';
import { WordBankInput } from './exercises/WordBankInput';

const buttonBase =
  'min-h-12 w-full rounded-xl px-5 font-medium focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-teal-600 disabled:opacity-40';

interface Props {
  lesson: Lesson;
  /** Wortschatz der Unit; liefert Harmonie-/Erweichungs-Flags für Suffix-Builder. */
  vocab?: readonly Vocab[];
  /** Für "Fehler melden" und den Prüfstatus; ohne unitId entfällt der Melde-Bereich. */
  unitId?: string;
  unitReviewed?: boolean;
  onExit: () => void;
  /** Erster Versuch je Übung und Lauf. */
  onAttempt?: (exercise: Exercise, verdict: Verdict) => void;
  /** Einmal pro abgeschlossenem Lauf; zählt den ersten Versuch je Übung. */
  onComplete?: (correct: number, total: number) => void;
  /** Überschrift am Ende, Default „Lektion geschafft“. */
  doneTitle?: string;
  /** Passender Abschnitt der Erklärkarte; erscheint nach einer falschen Antwort. */
  grammarFor?: (ex: Exercise) => ExplainerSection | undefined;
}

/** Regelbegründungen; bei Tabellen nur für die falsch ausgefüllten Zeilen. */
function reasonsFor(ex: Supported, answer: string, vocab: readonly Vocab[]): string[] | undefined {
  if (ex.type === 'suffix_builder' || ex.type === 'conjugation') {
    return explainSteps(solveExercise(ex, vocab).steps);
  }
  if (ex.type !== 'paradigm') return undefined;
  const ok = paradigmCells(ex, answer);
  const steps = solveParadigm(ex, vocab).flatMap((row, i) => (ok[i] ? [] : row.steps));
  return [...new Set(explainSteps(steps))];
}

/**
 * Hörübungen brauchen eine Stimme: ohne sie fehlen sie im Durchgang (sie werden nicht gewertet).
 * Solange die Stimmen laden, wartet der Durchgang kurz, damit er sie nicht vorschnell verliert.
 */
export function LessonRunner(props: Props) {
  const can = useCanSpeak();
  const loading = useAudio((s) => s.status === 'loading');
  const audioEnabled = useSettings((s) => s.audioEnabled);
  const needsVoice = audioEnabled && props.lesson.exercises.some((e) => e.type === 'listen');
  if (needsVoice && loading) return <p className="text-stone-500">{t('audio.status.loading')}</p>;
  return <Runner {...props} canListen={can} />;
}

function Runner({
  canListen,
  lesson,
  vocab = [],
  unitId,
  unitReviewed = false,
  onExit,
  onAttempt,
  onComplete,
  doneTitle = t('done.title'),
  grammarFor,
}: Props & { canListen: boolean }) {
  const tolerateDiacritics = useSettings((s) => s.tolerateDiacritics);
  const exercises = useMemo(
    () => lesson.exercises.filter((e) => isSupported(e) && (canListen || e.type !== 'listen')),
    [lesson, canListen],
  );
  const [session, setSession] = useState(() => createSession(exercises));
  const [answer, setAnswer] = useState('');

  const ex = currentExercise(session);
  const supported = ex && isSupported(ex) ? ex : undefined;

  // Optional: türkischen Prompt beim Anzeigen und die Lösung im Feedback vorlesen.
  const spoken = supported ? speakables(supported, session.last?.matched) : {};
  // Hörübungen spielen ihren Satz selbst (ListenInput), sonst käme er doppelt.
  useAutoplay(
    supported?.type === 'listen' ? undefined : spoken.prompt,
    session.phase === 'answering',
  );
  useAutoplay(spoken.solution, session.phase === 'feedback');

  const check = useCallback(() => {
    if (!supported || !answer.trim()) return;
    const result = grade(supported, answer, { tolerateDiacritics });
    if (!(supported.id in session.firstTry)) onAttempt?.(supported, result.verdict);
    setSession((s) => submit(s, result));
  }, [supported, answer, tolerateDiacritics, session.firstTry, onAttempt]);

  // Abschluss genau einmal melden, auch unter StrictMode (doppelte Effekte).
  const reported = useRef<Session>(null);
  useEffect(() => {
    if (session.phase !== 'done' || exercises.length === 0 || reported.current === session) return;
    reported.current = session;
    const { correct, total } = summary(session);
    // Alles übersprungen (Hörübungen ohne Ton): keine Lektion geschafft.
    if (total === 0) return;
    onComplete?.(correct, total);
  }, [session, exercises.length, onComplete]);

  // Verlassen (Zurück, Startseite) beendet auch eine noch laufende Ansage.
  useEffect(() => stopSpeaking, []);

  const proceed = useCallback(() => {
    stopSpeaking();
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
          {!exercises.length
            ? lesson.exercises.some((e) => e.type === 'listen')
              ? t('home.listen.unavailable')
              : t('runner.empty')
            : total === 0
              ? t('runner.skipped')
              : doneTitle}
        </h2>
        {total > 0 && <p>{t('done.score', { correct, total })}</p>}
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
  const grammar = answering ? undefined : grammarFor?.(supported);
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

      <div key={`${supported.id}-${session.index}`} data-exercise-id={supported.id}>
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
        {supported.type === 'conjugation' && (
          <ConjugationInput
            ex={supported}
            vocab={vocab}
            onChange={setAnswer}
            disabled={!answering}
          />
        )}
        {supported.type === 'listen' && (
          <ListenInput ex={supported} value={answer} onChange={setAnswer} disabled={!answering} />
        )}
        {supported.type === 'paradigm' && (
          <ParadigmInput ex={supported} onChange={setAnswer} disabled={!answering} />
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
        <div className="space-y-2">
          <button
            type="button"
            onClick={check}
            disabled={!answer.trim()}
            className={`${buttonBase} bg-teal-700 text-white`}
          >
            {t('runner.check')}
          </button>
          {supported.type === 'listen' && (
            <button
              type="button"
              onClick={() => {
                stopSpeaking();
                setAnswer('');
                setSession((s) => skip(s, { sameType: true }));
              }}
              className={`${buttonBase} bg-stone-200 dark:bg-stone-800`}
            >
              {t('ex.listen.skip')}
            </button>
          )}
        </div>
      ) : (
        <div className="space-y-4">
          <Feedback
            result={session.last!}
            solution={solutionOf(supported)}
            reasons={reasonsFor(supported, answer, vocab)}
            explanation={supported.explanation ?? supported.hint}
            retry={session.queue.slice(session.index + 1).some((e) => e.id === supported.id)}
            speak={spoken.solution}
          />
          {unitId && (
            <ReportError
              key={supported.id}
              exerciseId={supported.id}
              unitId={unitId}
              unreviewed={!(supported.reviewed ?? unitReviewed)}
            />
          )}
          <button
            type="button"
            autoFocus
            onClick={proceed}
            className={`${buttonBase} bg-teal-700 text-white`}
          >
            {t('runner.continue')}
          </button>
          {/* Unter „Weiter“: der Fokus auf dem Knopf lässt Ergebnis und Lösung im Blick. */}
          {session.last!.verdict === 'wrong' && grammar && <GrammarHint section={grammar} />}
        </div>
      )}
    </section>
  );
}
