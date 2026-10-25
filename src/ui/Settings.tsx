import { t } from '../i18n';
import { useApp } from '../store/app';
import { GOAL_RANGE, useSettings, type Theme } from '../store/settings';

const THEMES: Theme[] = ['system', 'light', 'dark'];

const stepButton =
  'min-h-11 min-w-11 rounded-lg border border-stone-300 bg-white text-lg focus-visible:outline-2 focus-visible:outline-teal-600 disabled:opacity-40 dark:border-stone-700 dark:bg-stone-900';

export function Settings() {
  const goHome = useApp((s) => s.goHome);
  const { dailyGoal, showStreak, tolerateDiacritics, theme, set } = useSettings();

  return (
    <section className="space-y-6" aria-labelledby="settings-title">
      <header className="flex items-center gap-3">
        <button
          type="button"
          onClick={goHome}
          className="min-h-11 rounded-lg px-3 text-stone-600 hover:bg-stone-200 dark:text-stone-400 dark:hover:bg-stone-800"
        >
          ← {t('settings.back')}
        </button>
        <h1 id="settings-title" className="text-xl font-semibold">
          {t('settings.title')}
        </h1>
      </header>

      <div className="flex items-center justify-between gap-4">
        <span id="goal-label">{t('settings.goal')}</span>
        <div className="flex items-center gap-2" role="group" aria-labelledby="goal-label">
          <button
            type="button"
            aria-label={t('settings.goal.dec')}
            disabled={dailyGoal <= GOAL_RANGE.min}
            onClick={() => set('dailyGoal', dailyGoal - 1)}
            className={stepButton}
          >
            −
          </button>
          <output aria-live="polite" className="w-8 text-center text-lg">
            {dailyGoal}
          </output>
          <button
            type="button"
            aria-label={t('settings.goal.inc')}
            disabled={dailyGoal >= GOAL_RANGE.max}
            onClick={() => set('dailyGoal', dailyGoal + 1)}
            className={stepButton}
          >
            +
          </button>
        </div>
      </div>

      <label className="flex min-h-11 items-center justify-between gap-4">
        <span>{t('settings.streak')}</span>
        <input
          type="checkbox"
          checked={showStreak}
          onChange={(e) => set('showStreak', e.target.checked)}
          className="size-6 accent-teal-700"
        />
      </label>

      <div>
        <label className="flex min-h-11 items-center justify-between gap-4">
          <span>{t('settings.tolerate')}</span>
          <input
            type="checkbox"
            checked={tolerateDiacritics}
            onChange={(e) => set('tolerateDiacritics', e.target.checked)}
            className="size-6 accent-teal-700"
          />
        </label>
        <p className="text-sm text-stone-500" lang="de">
          {t('settings.tolerate.hint')}
        </p>
      </div>

      <fieldset>
        <legend className="mb-2">{t('settings.theme')}</legend>
        <div className="flex gap-2">
          {THEMES.map((value) => (
            <label
              key={value}
              className={`flex min-h-11 flex-1 cursor-pointer items-center justify-center rounded-lg border px-3 has-focus-visible:outline-2 has-focus-visible:outline-teal-600 ${
                theme === value
                  ? 'border-teal-600 bg-teal-50 dark:bg-teal-950'
                  : 'border-stone-300 bg-white dark:border-stone-700 dark:bg-stone-900'
              }`}
            >
              <input
                type="radio"
                name="theme"
                value={value}
                checked={theme === value}
                onChange={() => set('theme', value)}
                className="sr-only"
              />
              {t(`settings.theme.${value}`)}
            </label>
          ))}
        </div>
      </fieldset>
    </section>
  );
}
