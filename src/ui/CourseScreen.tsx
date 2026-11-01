import { useEffect } from 'react';
import { currentPlacement, placementMark } from '../placement';
import { LEVELS } from '../content/schema';
import { t } from '../i18n';
import { completedLessonIds, progressLessons, unitProgress } from '../progress/stats';
import { useApp } from '../store/app';
import { useAudio, useCanSpeak } from '../store/audio';
import { useProgress } from '../store/progress';
import { useManifest } from './useManifest';

/** „Kurs“: alle Units nach Niveau (A1–B2) mit Fortschritt und Lektionen. */
export function CourseScreen() {
  const openLesson = useApp((s) => s.openLesson);
  const openExplainer = useApp((s) => s.openExplainer);
  const completions = useProgress((s) => s.completions);
  const placements = useProgress((s) => s.placements);
  // Hörlektionen brauchen eine Stimme; währenddessen laden die Stimmen noch.
  const canListen = useCanSpeak();
  const voicesLoading = useAudio((s) => s.status === 'loading');
  const focusUnit = useApp((s) => s.focusUnit);
  const clearFocusUnit = useApp((s) => s.clearFocusUnit);
  const { manifest, failed } = useManifest();

  // Nach übernommener Einstufung zur Start-Unit scrollen (einmal), sobald der Kurs steht.
  useEffect(() => {
    if (!manifest || !focusUnit) return;
    document
      .getElementById(`unit-${focusUnit}`)
      ?.scrollIntoView({ block: 'start', behavior: 'instant' });
    clearFocusUnit();
  }, [manifest, focusUnit, clearFocusUnit]);

  const completed = completedLessonIds(completions);
  const placement = currentPlacement(placements);

  return (
    <section aria-labelledby="course-title">
      <h1 id="course-title" className="text-2xl font-semibold">
        {t('course.title')}
      </h1>
      {failed ? (
        <p className="mt-6 text-danger">{t('home.error')}</p>
      ) : !manifest ? (
        <p className="mt-6 text-ink-subtle">{t('home.loading')}</p>
      ) : (
        <div className="mt-6 space-y-8">
          {/* Einmal oben statt in jeder Unit-Karte. */}
          {!canListen &&
            !voicesLoading &&
            manifest.units.some((u) => u.lessons.some((l) => l.type === 'listening')) && (
              <p className="text-sm text-ink-subtle">{t('home.listen.unavailable')}</p>
            )}
          {LEVELS.map((level) => {
            const units = manifest.units.filter((u) => u.level === level);
            if (!units.length) return null;
            return (
              <section key={level} aria-labelledby={`level-${level}`}>
                <h2
                  id={`level-${level}`}
                  className="text-sm font-medium tracking-wide text-ink-subtle"
                >
                  {t('home.level', { level })}
                </h2>
                <ul className="mt-3 space-y-4">
                  {units.map((unit) => {
                    const { done, total } = unitProgress(
                      progressLessons(unit.lessons).map((l) => l.id),
                      completed,
                    );
                    const label = t('home.unitProgress', { done, total });
                    const mark = placementMark(placement, unit.id);
                    return (
                      <li
                        key={unit.id}
                        id={`unit-${unit.id}`}
                        className="scroll-mt-4 rounded-xl border border-line bg-surface p-4"
                      >
                        <h3 className="font-medium">{unit.title}</h3>
                        {mark && (
                          <p
                            className={`mt-1 text-xs ${mark === 'start' ? 'font-medium text-brand-ink' : 'text-ink-subtle'}`}
                          >
                            {t(`placement.mark.${mark}`)}
                          </p>
                        )}
                        <div className="mt-2 flex items-center gap-3 text-xs text-ink-subtle">
                          <div
                            role="progressbar"
                            aria-label={`${unit.title}: ${label}`}
                            aria-valuemin={0}
                            aria-valuemax={total}
                            aria-valuenow={done}
                            className="h-1.5 flex-1 overflow-hidden rounded-full bg-fill"
                          >
                            <div
                              className="h-full bg-brand-bar"
                              style={{ width: `${total ? (done / total) * 100 : 0}%` }}
                            />
                          </div>
                          <span>{label}</span>
                        </div>
                        <div className="mt-3 flex flex-wrap gap-2">
                          {unit.explainer && (
                            <button
                              type="button"
                              onClick={() => openExplainer(unit.id)}
                              className="min-h-11 rounded-lg border border-brand-edge px-4 text-brand-ink hover:bg-brand-soft focus-visible:outline-2 focus-visible:outline-focus"
                            >
                              {t('home.explainer')}
                            </button>
                          )}
                          {unit.lessons
                            .filter((l) => l.type !== 'listening' || canListen)
                            .map((lesson) => (
                              <button
                                key={lesson.id}
                                type="button"
                                onClick={() => openLesson(unit.id, lesson.id)}
                                className="min-h-11 rounded-lg bg-fill-soft px-4 text-left hover:bg-fill focus-visible:outline-2 focus-visible:outline-focus"
                              >
                                <span className="block text-xs text-ink-subtle">
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
    </section>
  );
}
