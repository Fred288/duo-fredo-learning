import { useEffect, useState } from 'react';
import { sectionFor } from '../content/explainer-section';
import { fetchExplainer, fetchUnit } from '../content/load';
import type { Lesson, Vocab } from '../content/schema';
import { t } from '../i18n';
import { useApp } from '../store/app';
import { useProgress } from '../store/progress';
import { LessonRunner } from './LessonRunner';
import { ReadingPassage } from './ReadingPassage';

const buttonBase =
  'min-h-12 w-full rounded-xl px-5 font-medium focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-teal-600';

export function LessonScreen({ unitId, lessonId }: { unitId: string; lessonId: string }) {
  const goHome = useApp((s) => s.goHome);
  const recordAttempt = useProgress((s) => s.recordAttempt);
  const recordCompletion = useProgress((s) => s.recordCompletion);
  const [lesson, setLesson] = useState<Lesson>();
  const [vocab, setVocab] = useState<Vocab[]>([]);
  const [unitReviewed, setUnitReviewed] = useState(false);
  const [failed, setFailed] = useState(false);
  const [explainer, setExplainer] = useState<string>();
  /** Lesetext: erst lesen, dann die Fragen (der Text bleibt dabei aufklappbar). */
  const [reading, setReading] = useState(true);

  useEffect(() => {
    fetchUnit(unitId)
      .then((unit) => {
        const found = unit.lessons.find((l) => l.id === lessonId);
        if (found) {
          setVocab([...(unit.vocab ?? []), ...(unit.lexicon ?? [])]);
          setUnitReviewed(unit.reviewed);
          setLesson(found);
          // Ohne Erklärkarte (oder offline nicht geladen) läuft die Lektion ohne Grammatik-Hinweis.
          if (unit.explainer) fetchExplainer(unit.explainer).then(setExplainer, () => {});
        } else setFailed(true);
      })
      .catch(() => setFailed(true));
  }, [unitId, lessonId]);

  if (failed) return <p className="text-rose-700 dark:text-rose-400">{t('home.error')}</p>;
  if (!lesson) return <p className="text-stone-500">{t('runner.loading')}</p>;
  const { passage } = lesson;
  if (passage && reading) {
    return (
      <section className="space-y-6" aria-labelledby="reading-title">
        <header className="flex items-center gap-3">
          <button
            type="button"
            onClick={goHome}
            className="min-h-11 rounded-lg px-3 text-stone-600 hover:bg-stone-200 dark:text-stone-400 dark:hover:bg-stone-800"
          >
            ← {t('runner.back')}
          </button>
          <h1 id="reading-title" className="text-xl font-semibold">
            {lesson.title}
          </h1>
        </header>
        <p className="text-sm text-stone-500">{t('reading.hint')}</p>
        <ReadingPassage passage={passage} />
        <button
          type="button"
          onClick={() => setReading(false)}
          className={`${buttonBase} bg-teal-700 text-white`}
        >
          {t('reading.start')}
        </button>
      </section>
    );
  }
  return (
    <LessonRunner
      lesson={lesson}
      vocab={vocab}
      unitId={unitId}
      unitReviewed={unitReviewed}
      onExit={goHome}
      onAttempt={(ex, verdict) => recordAttempt(ex.id, lessonId, verdict, ex.type)}
      onComplete={(correct, total) => recordCompletion(unitId, lessonId, correct, total)}
      grammarFor={explainer ? (ex) => sectionFor(explainer, ex, lesson.title) : undefined}
      aside={
        passage && (
          <details className="rounded-xl border border-stone-200 bg-white p-3 dark:border-stone-800 dark:bg-stone-900">
            <summary className="min-h-11 cursor-pointer content-center font-medium">
              {t('reading.show')}
            </summary>
            <div className="mt-3">
              <ReadingPassage passage={passage} />
            </div>
          </details>
        )
      }
    />
  );
}
