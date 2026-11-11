import { isListeningCard } from '../content/listening';
import { openWrong } from '../flashcards/deck';
import { t } from '../i18n';
import { dayKey } from '../progress/day';
import { frequentMistakes, openMistakes } from '../progress/stats';
import { planRepeat } from '../srs';
import { currentPlacement } from '../placement';
import { useApp } from '../store/app';
import { useCanSpeak } from '../store/audio';
import { useFlashcards } from '../store/flashcards';
import { useProgress } from '../store/progress';
import { useSettings } from '../store/settings';
import { DailyGoal } from './DailyGoal';
import { nextLesson } from './course/next-lesson';
import { useManifest } from './useManifest';

/** „Heute“: was jetzt dran ist (Tagesziel, Angebot, Fälliges). Der Kurs liegt im Bereich „Kurs“. */
export function Today() {
  const completions = useProgress((s) => s.completions);
  const attempts = useProgress((s) => s.attempts);
  const cards = useProgress((s) => s.cards);
  const placements = useProgress((s) => s.placements);
  const progressLoaded = useProgress((s) => s.loaded);
  const settingsLoaded = useSettings((s) => s.loaded);
  const placementOffered = useSettings((s) => s.placementOffered);
  const setSetting = useSettings((s) => s.set);
  const newWordsPerDay = useSettings((s) => s.newWordsPerDay);
  const openMistakesScreen = useApp((s) => s.openMistakes);
  const openRepeat = useApp((s) => s.openRepeat);
  const openStats = useApp((s) => s.openStats);
  const openPlacement = useApp((s) => s.openPlacement);
  const openLesson = useApp((s) => s.openLesson);
  const openFlashRun = useApp((s) => s.openFlashRun);
  const flashMode = useSettings((s) => s.flashMode);
  const flashWrong = openWrong(useFlashcards((s) => s.flashes)).length;
  // Hörkarten ohne Stimme bleiben fällig, zählen aber nicht: Wiederholen zeigt sie nicht.
  const canListen = useCanSpeak();
  const { manifest, failed } = useManifest();

  // Angebot nur bei einem ersten Start: nichts gemacht, nichts eingestuft, noch nicht entschieden.
  // Das rohe Protokoll zählt (nicht `currentPlacement`), damit eine Rücknahme es nicht zurückholt.
  const offerPlacement =
    progressLoaded &&
    settingsLoaded &&
    !placementOffered &&
    completions.length === 0 &&
    placements.length === 0;
  const mistakes = openMistakes(attempts).length;
  const frequent = frequentMistakes(attempts).length;
  // Weiterlernen: erst mit geladenem Fortschritt und nach einem ersten Start (sonst das Angebot).
  const next =
    manifest && progressLoaded && settingsLoaded && !offerPlacement
      ? nextLesson(manifest.units, completions, currentPlacement(placements))
      : undefined;
  const plan = manifest
    ? planRepeat(manifest.units, completions, cards, dayKey(), newWordsPerDay, {
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
    <section aria-labelledby="today-title">
      <header>
        <h1 id="today-title" className="text-2xl font-semibold">
          {t('app.title')}
        </h1>
        <p className="mt-1 text-ink-muted">{t('app.tagline')}</p>
      </header>
      <div className="xl:grid xl:grid-cols-[minmax(0,1fr)_minmax(0,18rem)] xl:items-start xl:gap-x-10">
        <div className="xl:col-start-2 xl:row-start-1">
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
        </div>
        <div className="mt-4 space-y-4 xl:col-start-1 xl:row-start-1 xl:mt-6">
          {next && (
            <button
              type="button"
              onClick={() => openLesson(next.unit.id, next.lesson.id)}
              className="block min-h-11 w-full rounded-xl bg-brand p-4 text-left text-on-brand focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-focus"
            >
              <span className="block font-medium">{t('today.continue.title')}</span>
              <span className="block text-sm">
                {next.unit.title} · {next.lesson.title}
              </span>
            </button>
          )}
          {offerPlacement && (
            <section
              aria-labelledby="placement-offer"
              className="rounded-xl border border-brand-line bg-brand-soft p-4"
            >
              <h2 id="placement-offer" className="font-medium">
                {t('placement.offer.title')}
              </h2>
              <p className="mt-1 text-sm text-ink-muted">{t('placement.offer.text')}</p>
              <div className="mt-3 flex flex-wrap gap-2">
                <button
                  type="button"
                  onClick={() => {
                    setSetting('placementOffered', true);
                    openPlacement();
                  }}
                  className="min-h-11 rounded-lg bg-brand px-4 font-medium text-on-brand focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-focus"
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
              className="block min-h-11 w-full rounded-xl border border-brand-line bg-brand-soft p-4 text-left hover:bg-brand-soft-hover focus-visible:outline-2 focus-visible:outline-focus"
            >
              <span className="block font-medium">{t('repeat.title')}</span>
              <span className="block text-sm text-ink-muted">{repeatCount}</span>
            </button>
          )}
          {mistakes > 0 && (
            <button
              type="button"
              onClick={() => openMistakesScreen()}
              className="block min-h-11 w-full rounded-xl border border-warn-line bg-warn-soft p-4 text-left hover:bg-warn-soft-hover focus-visible:outline-2 focus-visible:outline-focus"
            >
              <span className="block font-medium">{t('mistakes.title')}</span>
              <span className="block text-sm text-ink-muted">
                {t('mistakes.count', { count: mistakes })}
              </span>
            </button>
          )}
          {frequent > 0 && (
            <button
              type="button"
              onClick={() => openMistakesScreen('frequent')}
              className="card block min-h-11 w-full rounded-xl border border-line p-4 text-left hover:bg-hover focus-visible:outline-2 focus-visible:outline-focus"
            >
              <span className="block font-medium">{t('mistakes.frequent.title')}</span>
              <span className="block text-sm text-ink-muted">
                {t('mistakes.frequent.count', { count: frequent })}
              </span>
            </button>
          )}
          {flashWrong > 0 && (
            <button
              type="button"
              onClick={() =>
                openFlashRun(
                  { scope: { scope: 'wrong' }, content: 'both', dir: 'mixed', order: 'course' },
                  flashMode,
                )
              }
              className="block min-h-11 w-full rounded-xl card border border-line p-4 text-left hover:bg-hover focus-visible:outline-2 focus-visible:outline-focus"
            >
              <span className="block font-medium">{t('flash.title')}</span>
              <span className="block text-sm text-ink-muted">
                {t('flash.today.wrong', { count: flashWrong })}
              </span>
            </button>
          )}
        </div>
      </div>
      {failed ? (
        <p className="mt-6 text-danger">{t('home.error')}</p>
      ) : (
        !manifest && <p className="mt-6 text-ink-subtle">{t('home.loading')}</p>
      )}
    </section>
  );
}
