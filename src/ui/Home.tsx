import { useEffect, useState } from 'react';
import { currentPlacement, placementMark } from '../placement';
import { fetchManifest, type Manifest } from '../content/load';
import { isListeningCard } from '../content/listening';
import { LEVELS } from '../content/schema';
import { t } from '../i18n';
import { dayKey } from '../progress/day';
import { completedLessonIds, openMistakes, progressLessons, unitProgress } from '../progress/stats';
import { planRepeat } from '../srs';
import { useApp } from '../store/app';
import { useAudio, useCanSpeak } from '../store/audio';
import { useProgress } from '../store/progress';
import { useSettings } from '../store/settings';
import { DailyGoal } from './DailyGoal';

export function Home() {
  const openLesson = useApp((s) => s.openLesson);
  const openExplainer = useApp((s) => s.openExplainer);
  const completions = useProgress((s) => s.completions);
  const attempts = useProgress((s) => s.attempts);
  const openMistakesScreen = useApp((s) => s.openMistakes);
  const openRepeat = useApp((s) => s.openRepeat);
  const openStats = useApp((s) => s.openStats);
  // Hörlektionen brauchen eine Stimme; währenddessen laden die Stimmen noch.
  const canListen = useCanSpeak();
  const voicesLoading = useAudio((s) => s.status === 'loading');
  const cards = useProgress((s) => s.cards);
  const placements = useProgress((s) => s.placements);
  const progressLoaded = useProgress((s) => s.loaded);
  const settingsLoaded = useSettings((s) => s.loaded);
  const placementOffered = useSettings((s) => s.placementOffered);
  const setSetting = useSettings((s) => s.set);
  const openPlacement = useApp((s) => s.openPlacement);
  const focusUnit = useApp((s) => s.focusUnit);
  const clearFocusUnit = useApp((s) => s.clearFocusUnit);
  const newWordsPerDay = useSettings((s) => s.newWordsPerDay);
  const [manifest, setManifest] = useState<Manifest>();
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    fetchManifest()
      .then(setManifest)
      .catch(() => setFailed(true));
  }, []);

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
  // Angebot nur bei einem ersten Start: nichts gemacht, nichts eingestuft, noch nicht entschieden.
  // Das rohe Protokoll zählt (nicht `currentPlacement`), damit eine Rücknahme es nicht zurückholt.
  const offerPlacement =
    progressLoaded &&
    settingsLoaded &&
    !placementOffered &&
    completions.length === 0 &&
    placements.length === 0;
  const mistakes = openMistakes(attempts).length;
  const plan = manifest
    ? planRepeat(manifest.units, completions, cards, dayKey(), newWordsPerDay, {
        // Hörkarten ohne Stimme bleiben fällig, zählen aber nicht: Wiederholen zeigt sie nicht.
        skip: canListen ? undefined : isListeningCard,
      })
    : undefined;
  const repeatCount = [
    plan && plan.due + plan.recall ? t('repeat.due', { count: plan.due + plan.recall }) : '',
    plan?.fresh ? t('repeat.new', { count: plan.fresh }) : '',
  ]
    .filter(Boolean)
    .join(' · ');

  return (
    <>
      <DailyGoal />
      <div className="mt-1 text-right">
        <button
          type="button"
          onClick={openStats}
          className="min-h-11 rounded-lg px-2 text-sm text-brand-ink underline hover:bg-hover focus-visible:outline-2 focus-visible:outline-focus"
        >
          {t('stats.open')}
        </button>
      </div>
      {offerPlacement && (
        <section
          aria-labelledby="placement-offer"
          className="mt-4 rounded-xl border border-brand-line bg-brand-soft p-4"
        >
          <h2 id="placement-offer" className="font-medium">
            {t('placement.offer.title')}
          </h2>
          <p className="mt-1 text-sm text-ink-muted">
            {t('placement.offer.text')}
          </p>
          <div className="mt-3 flex flex-wrap gap-2">
            <button
              type="button"
              onClick={() => {
                setSetting('placementOffered', true);
                openPlacement();
              }}
              className="min-h-11 rounded-lg bg-brand px-4 font-medium text-white focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-focus"
            >
              {t('placement.offer.start')}
            </button>
            <button
              type="button"
              onClick={() => setSetting('placementOffered', true)}
              className="min-h-11 rounded-lg border border-brand-edge px-4 text-brand-ink hover:bg-brand-soft-hover focus-visible:outline-2 focus-visible:outline-focus"
            >
              {t('placement.offer.decline')}
            </button>
          </div>
        </section>
      )}
      {repeatCount && (
        <button
          type="button"
          onClick={openRepeat}
          className="mt-4 block min-h-11 w-full rounded-xl border border-brand-line bg-brand-soft p-4 text-left hover:bg-brand-soft-hover focus-visible:outline-2 focus-visible:outline-focus"
        >
          <span className="block font-medium">{t('repeat.title')}</span>
          <span className="block text-sm text-ink-muted">{repeatCount}</span>
        </button>
      )}
      {mistakes > 0 && (
        <button
          type="button"
          onClick={openMistakesScreen}
          className="mt-4 block min-h-11 w-full rounded-xl border border-warn-line bg-warn-soft p-4 text-left hover:bg-warn-soft-hover focus-visible:outline-2 focus-visible:outline-focus"
        >
          <span className="block font-medium">{t('mistakes.title')}</span>
          <span className="block text-sm text-ink-muted">
            {t('mistakes.count', { count: mistakes })}
          </span>
        </button>
      )}
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
    </>
  );
}
