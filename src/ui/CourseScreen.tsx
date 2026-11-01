import { useEffect, useMemo, type ReactNode } from 'react';
import { currentPlacement, placementMark } from '../placement';
import { LEVELS } from '../content/schema';
import type { Manifest } from '../content/load';
import { t } from '../i18n';
import { completedLessonIds, progressLessons, unitProgress } from '../progress/stats';
import { useApp } from '../store/app';
import { useAudio, useCanSpeak } from '../store/audio';
import { useProgress } from '../store/progress';
import { nextLesson } from './course/next-lesson';
import { useManifest } from './useManifest';
import { useWide } from './useWide';

type ManifestUnit = Manifest['units'][number];

/**
 * „Kurs“: alle Units nach Niveau (A1–B2), das aktuelle Niveau offen. Ein Tipp auf eine Unit öffnet
 * sie: auf dem Handy als eigener Bildschirm, ab 1024 px als zweite Spalte neben der Liste.
 */
export function CourseScreen({ unitId }: { unitId?: string }) {
  const wide = useWide();
  const { manifest, failed } = useManifest();
  // Hörlektionen brauchen eine Stimme; währenddessen laden die Stimmen noch.
  const canListen = useCanSpeak();
  const voicesLoading = useAudio((s) => s.status === 'loading');
  // Das offene Niveau hängt am Fortschritt: erst zeichnen, wenn er da ist.
  const progressLoaded = useProgress((s) => s.loaded);

  if (failed || !manifest || !progressLoaded) {
    return (
      <section aria-labelledby="course-title">
        <h1 id="course-title" className="text-2xl font-semibold">
          {t('course.title')}
        </h1>
        <p className={`mt-6 ${failed ? 'text-danger' : 'text-ink-subtle'}`}>
          {t(failed ? 'home.error' : 'home.loading')}
        </p>
      </section>
    );
  }

  const unit = unitId ? manifest.units.find((u) => u.id === unitId) : undefined;
  const hint = !canListen &&
    !voicesLoading &&
    manifest.units.some((u) => u.lessons.some((l) => l.type === 'listening')) && (
      // Einmal oben statt in jeder Unit.
      <p className="text-sm text-ink-subtle">{t('home.listen.unavailable')}</p>
    );

  if (!wide && unit) return <UnitDetail unit={unit} page canListen={canListen} hint={hint} />;

  const list = (
    <CourseList manifest={manifest} selected={wide ? unit?.id : undefined} wide={wide} />
  );
  return (
    <section aria-labelledby="course-title">
      <h1 id="course-title" className="text-2xl font-semibold">
        {t('course.title')}
      </h1>
      {wide ? (
        <div className="mt-6 grid grid-cols-[minmax(0,22rem)_minmax(0,1fr)] gap-8">
          <div className="space-y-4">
            {hint}
            {list}
          </div>
          <div className="sticky top-[calc(1.5rem+var(--safe-top))] -m-0.5 max-h-[calc(100dvh-3rem-var(--safe-top))] self-start overflow-y-auto p-0.5">
            {unit ? (
              <UnitDetail unit={unit} canListen={canListen} hint={hint} />
            ) : (
              <p className="text-ink-subtle">{t('course.pick')}</p>
            )}
          </div>
        </div>
      ) : (
        <div className="mt-6 space-y-4">
          {hint}
          {list}
        </div>
      )}
    </section>
  );
}

function CourseList({
  manifest,
  selected,
  wide,
}: {
  manifest: Manifest;
  selected?: string;
  wide: boolean;
}) {
  const openUnit = useApp((s) => s.openUnit);
  const completions = useProgress((s) => s.completions);
  const placements = useProgress((s) => s.placements);
  const courseOpen = useApp((s) => s.courseOpen);
  const setCourseOpen = useApp((s) => s.setCourseOpen);
  const focusUnit = useApp((s) => s.focusUnit);
  const clearFocusUnit = useApp((s) => s.clearFocusUnit);

  const completed = completedLessonIds(completions);
  const placement = currentPlacement(placements);

  // Standard: das Niveau, in dem es als Nächstes weitergeht (sonst das erste).
  const current = useMemo(
    () => nextLesson(manifest.units, completions, placement)?.unit.level ?? LEVELS[0],
    [manifest, completions, placement],
  );
  const open = useMemo(() => courseOpen ?? [current], [courseOpen, current]);

  // Der Standard gilt einmal: Wer die letzte Lektion eines Niveaus schafft, behält es offen.
  useEffect(() => {
    if (!courseOpen) setCourseOpen([current]);
  }, [courseOpen, current, setCourseOpen]);

  // Nach übernommener Einstufung zur Start-Unit scrollen (einmal): erst das Niveau öffnen.
  useEffect(() => {
    if (!focusUnit) return;
    const unit = manifest.units.find((u) => u.id === focusUnit);
    if (!unit) {
      clearFocusUnit();
      return;
    }
    if (!open.includes(unit.level)) {
      setCourseOpen([...open, unit.level]);
      return;
    }
    document
      .getElementById(`unit-${focusUnit}`)
      ?.scrollIntoView({ block: 'start', behavior: 'instant' });
    clearFocusUnit();
  }, [manifest, focusUnit, open, setCourseOpen, clearFocusUnit]);

  return (
    <div className="space-y-3">
      {LEVELS.map((level) => {
        const units = manifest.units.filter((u) => u.level === level);
        if (!units.length) return null;
        const isOpen = open.includes(level);
        const lessons = units.flatMap((u) => progressLessons(u.lessons).map((l) => l.id));
        const { done, total } = unitProgress(lessons, completed);
        return (
          <details
            key={level}
            open={isOpen}
            onToggle={(e) => {
              const now = e.currentTarget.open;
              if (now !== isOpen)
                setCourseOpen(now ? [...open, level] : open.filter((l) => l !== level));
            }}
            className="group rounded-xl border border-line bg-surface"
          >
            <summary className="flex min-h-12 cursor-pointer items-center rounded-xl px-4 py-2 focus-visible:outline-2 focus-visible:outline-focus">
              <h2 className="flex flex-1 items-center gap-2">
                <svg
                  aria-hidden="true"
                  viewBox="0 0 24 24"
                  className="size-4 shrink-0 text-ink-subtle transition-transform group-open:rotate-90 motion-reduce:transition-none"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2.2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                >
                  <path d="m9 5 7 7-7 7" />
                </svg>
                <span className="flex-1 font-medium">{t('home.level', { level })}</span>
                <span className="text-sm font-normal text-ink-subtle">
                  {t('home.unitProgress', { done, total })}
                </span>
              </h2>
            </summary>
            <ul className="space-y-2 px-3 pb-3">
              {units.map((unit) => (
                <UnitRow
                  key={unit.id}
                  unit={unit}
                  completed={completed}
                  mark={placementMark(placement, unit.id)}
                  selected={selected === unit.id}
                  onOpen={(keyboard) => {
                    openUnit(unit.id);
                    // Per Tastatur in die Spalte, sonst lägen die Lektionen hinter der ganzen Liste.
                    if (keyboard && wide) {
                      requestAnimationFrame(() =>
                        document.getElementById('unit-title')?.focus({ preventScroll: true }),
                      );
                    }
                  }}
                />
              ))}
            </ul>
          </details>
        );
      })}
    </div>
  );
}

function UnitRow({
  unit,
  completed,
  mark,
  selected,
  onOpen,
}: {
  unit: ManifestUnit;
  completed: ReadonlySet<string>;
  mark?: 'start' | 'skipped';
  selected: boolean;
  onOpen: (keyboard: boolean) => void;
}) {
  const { done, total } = unitProgress(
    progressLessons(unit.lessons).map((l) => l.id),
    completed,
  );
  const label = t('home.unitProgress', { done, total });
  return (
    <li
      id={`unit-${unit.id}`}
      className={`relative scroll-mt-4 rounded-lg border p-3 hover:bg-hover ${
        selected ? 'border-brand-edge bg-brand-soft' : 'border-line bg-surface'
      }`}
    >
      <h3 className="font-medium">
        {/* Der ganze Eintrag ist der Knopf (die Fläche spannt über `after`). */}
        <button
          type="button"
          onClick={(e) => onOpen(e.detail === 0)}
          aria-current={selected ? 'true' : undefined}
          className="text-left after:absolute after:inset-0 after:rounded-lg focus-visible:outline-none focus-visible:after:outline-2 focus-visible:after:outline-focus"
        >
          {unit.title}
        </button>
      </h3>
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
    </li>
  );
}

/** Eine Unit: Erklärung und Lektionen. Als Seite (Handy) mit `h1` und Zurück, sonst als Spalte. */
function UnitDetail({
  unit,
  page = false,
  canListen,
  hint,
}: {
  unit: ManifestUnit;
  page?: boolean;
  canListen: boolean;
  hint?: ReactNode;
}) {
  const openLesson = useApp((s) => s.openLesson);
  const openExplainer = useApp((s) => s.openExplainer);
  const goBack = useApp((s) => s.goBack);
  const completions = useProgress((s) => s.completions);
  const placements = useProgress((s) => s.placements);
  const completed = completedLessonIds(completions);
  const mark = placementMark(currentPlacement(placements), unit.id);
  const { done, total } = unitProgress(
    progressLessons(unit.lessons).map((l) => l.id),
    completed,
  );
  const Title = page ? 'h1' : 'h2';
  return (
    <section aria-labelledby="unit-title" className="space-y-4">
      {page && (
        <button
          type="button"
          onClick={goBack}
          className="min-h-11 rounded-lg px-3 text-ink-muted hover:bg-hover focus-visible:outline-2 focus-visible:outline-focus"
        >
          ← {t('runner.back')}
        </button>
      )}
      <div>
        <Title id="unit-title" tabIndex={-1} className="text-xl font-semibold">
          {unit.title}
        </Title>
        <p className="mt-1 text-sm text-ink-subtle">
          {t('home.unitProgress', { done, total })}
          {mark && ` · ${t(`placement.mark.${mark}`)}`}
        </p>
      </div>
      {hint}
      <div className="flex flex-wrap gap-2">
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
    </section>
  );
}
