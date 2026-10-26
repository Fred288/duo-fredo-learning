import { useEffect, useState } from 'react';
import { fetchUnit } from '../content/load';
import type { Exercise, Lesson, Vocab } from '../content/schema';
import { t } from '../i18n';
import { openMistakes, unitOfLesson } from '../progress/stats';
import { useApp } from '../store/app';
import { useProgress } from '../store/progress';
import { LessonRunner } from './LessonRunner';

/** Höchstens so viele Fehler pro Durchgang, älteste zuerst. */
const MAX = 15;

interface Run {
  lesson: Lesson;
  vocab: Vocab[];
  lessonOf: Map<string, string>;
}

export function MistakesScreen() {
  const goHome = useApp((s) => s.goHome);
  const recordAttempt = useProgress((s) => s.recordAttempt);
  const [run, setRun] = useState<Run | null>();
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    // Momentaufnahme beim Öffnen; neue Versuche ändern den laufenden Durchgang nicht.
    const open = openMistakes(useProgress.getState().attempts).slice(0, MAX);
    const unitIds = [...new Set(open.map((m) => unitOfLesson(m.lessonId)))];
    Promise.all(unitIds.map(fetchUnit))
      .then((units) => {
        const byId = new Map<string, Exercise>(
          units.flatMap((u) => u.lessons.flatMap((l) => l.exercises.map((e) => [e.id, e]))),
        );
        // Inzwischen entfernte Übungen fallen still heraus.
        const exercises = open.flatMap((m) => byId.get(m.exerciseId) ?? []);
        if (!exercises.length) return setRun(null);
        setRun({
          lesson: { id: 'mistakes', type: 'review', title: t('mistakes.title'), exercises },
          vocab: units.flatMap((u) => [...(u.vocab ?? []), ...(u.lexicon ?? [])]),
          lessonOf: new Map(open.map((m) => [m.exerciseId, m.lessonId])),
        });
      })
      .catch(() => setFailed(true));
  }, []);

  if (failed) return <p className="text-rose-700 dark:text-rose-400">{t('home.error')}</p>;
  if (run === undefined) return <p className="text-stone-500">{t('mistakes.loading')}</p>;
  if (run === null) {
    return (
      <section className="space-y-4 text-center">
        <p>{t('mistakes.empty')}</p>
        <button
          type="button"
          autoFocus
          onClick={goHome}
          className="min-h-12 w-full rounded-xl bg-teal-700 px-5 font-medium text-white focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-teal-600"
        >
          {t('done.home')}
        </button>
      </section>
    );
  }
  return (
    <LessonRunner
      lesson={run.lesson}
      vocab={run.vocab}
      onExit={goHome}
      doneTitle={t('mistakes.done')}
      // Versuche zählen für die echte Lektion; kein Lektionsabschluss, kein Tagesziel.
      onAttempt={(exerciseId, verdict) =>
        recordAttempt(exerciseId, run.lessonOf.get(exerciseId)!, verdict)
      }
    />
  );
}
