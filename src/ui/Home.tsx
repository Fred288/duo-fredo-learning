import { useEffect, useState } from 'react';
import { fetchManifest, type Manifest } from '../content/load';
import { LEVELS } from '../content/schema';
import { t } from '../i18n';
import { completedLessonIds, unitProgress } from '../progress/stats';
import { useApp } from '../store/app';
import { useProgress } from '../store/progress';
import { DailyGoal } from './DailyGoal';

export function Home() {
  const openLesson = useApp((s) => s.openLesson);
  const completions = useProgress((s) => s.completions);
  const [manifest, setManifest] = useState<Manifest>();
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    fetchManifest()
      .then(setManifest)
      .catch(() => setFailed(true));
  }, []);

  const completed = completedLessonIds(completions);

  return (
    <>
      <DailyGoal />
      {failed ? (
        <p className="mt-6 text-rose-700 dark:text-rose-400">{t('home.error')}</p>
      ) : !manifest ? (
        <p className="mt-6 text-stone-500">{t('home.loading')}</p>
      ) : (
        <div className="mt-6 space-y-8">
          {LEVELS.map((level) => {
            const units = manifest.units.filter((u) => u.level === level);
            if (!units.length) return null;
            return (
              <section key={level} aria-labelledby={`level-${level}`}>
                <h2
                  id={`level-${level}`}
                  className="text-sm font-medium tracking-wide text-stone-500"
                >
                  {t('home.level', { level })}
                </h2>
                <ul className="mt-3 space-y-4">
                  {units.map((unit) => {
                    const { done, total } = unitProgress(
                      unit.lessons.map((l) => l.id),
                      completed,
                    );
                    const label = t('home.unitProgress', { done, total });
                    return (
                      <li
                        key={unit.id}
                        className="rounded-xl border border-stone-200 bg-white p-4 dark:border-stone-800 dark:bg-stone-900"
                      >
                        <h3 className="font-medium">{unit.title}</h3>
                        <div className="mt-2 flex items-center gap-3 text-xs text-stone-500">
                          <div
                            role="progressbar"
                            aria-label={`${unit.title}: ${label}`}
                            aria-valuemin={0}
                            aria-valuemax={total}
                            aria-valuenow={done}
                            className="h-1.5 flex-1 overflow-hidden rounded-full bg-stone-200 dark:bg-stone-800"
                          >
                            <div
                              className="h-full bg-teal-600"
                              style={{ width: `${total ? (done / total) * 100 : 0}%` }}
                            />
                          </div>
                          <span>{label}</span>
                        </div>
                        <div className="mt-3 flex flex-wrap gap-2">
                          {unit.lessons.map((lesson) => (
                            <button
                              key={lesson.id}
                              type="button"
                              onClick={() => openLesson(unit.id, lesson.id)}
                              className="min-h-11 rounded-lg bg-stone-100 px-4 text-left hover:bg-stone-200 focus-visible:outline-2 focus-visible:outline-teal-600 dark:bg-stone-800 dark:hover:bg-stone-700"
                            >
                              <span className="block text-xs text-stone-500">
                                {t(`lesson.type.${lesson.type}`)}
                                {completed.has(lesson.id) && (
                                  <span role="img" aria-label={t('home.lessonDone')}>
                                    {' '}
                                    ✓
                                  </span>
                                )}
                              </span>
                              {lesson.title}
                            </button>
                          ))}
                        </div>
                      </li>
                    );
                  })}
                </ul>
              </section>
            );
          })}
        </div>
      )}
    </>
  );
}
