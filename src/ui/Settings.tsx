import { canSpeak } from '../audio/types';
import { t, type MessageKey } from '../i18n';
import { useApp } from '../store/app';
import { getSpeaker, speak, useAudio } from '../store/audio';
import { GOAL_RANGE, NEW_WORDS_RANGE, useSettings, type Theme } from '../store/settings';

const THEMES: Theme[] = ['system', 'light', 'dark'];

const stepButton =
  'min-h-11 min-w-11 rounded-lg border border-stone-300 bg-white text-lg focus-visible:outline-2 focus-visible:outline-teal-600 disabled:opacity-40 dark:border-stone-700 dark:bg-stone-900';

export function Settings() {
  const goHome = useApp((s) => s.goHome);
  const openReview = useApp((s) => s.openReview);
  const {
    dailyGoal,
    newWordsPerDay,
    showStreak,
    tolerateDiacritics,
    theme,
    audioEnabled,
    autoplay,
    voiceURI,
    set,
  } = useSettings();
  const { status, voices } = useAudio();
  // Offline nimmt der Speaker die beste lokale Stimme; deren Name zählt, nicht der der Auswahl.
  const current =
    getSpeaker().current() ?? voices.find((v) => v.voiceURI === voiceURI) ?? voices[0];

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

      <div className="flex items-center justify-between gap-4">
        <span id="newwords-label">{t('settings.newWords')}</span>
        <div className="flex items-center gap-2" role="group" aria-labelledby="newwords-label">
          <button
            type="button"
            aria-label={t('settings.newWords.dec')}
            disabled={newWordsPerDay <= NEW_WORDS_RANGE.min}
            onClick={() => set('newWordsPerDay', newWordsPerDay - 1)}
            className={stepButton}
          >
            −
          </button>
          <output aria-live="polite" className="w-8 text-center text-lg">
            {newWordsPerDay}
          </output>
          <button
            type="button"
            aria-label={t('settings.newWords.inc')}
            disabled={newWordsPerDay >= NEW_WORDS_RANGE.max}
            onClick={() => set('newWordsPerDay', newWordsPerDay + 1)}
            className={stepButton}
          >
            +
          </button>
        </div>
      </div>
      <p className="-mt-4 text-sm text-stone-500">{t('settings.newWords.hint')}</p>

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

      <fieldset className="space-y-2">
        <legend className="mb-1 font-medium">{t('settings.audio')}</legend>
        <label className="flex min-h-11 items-center justify-between gap-4">
          <span>{t('settings.audio.enabled')}</span>
          <input
            type="checkbox"
            checked={audioEnabled}
            onChange={(e) => set('audioEnabled', e.target.checked)}
            className="size-6 accent-teal-700"
          />
        </label>
        <p className="text-sm text-stone-500" role="status">
          {t(`audio.status.${status}` as MessageKey, { name: current?.name ?? '' })}
        </p>
        {audioEnabled && canSpeak(status) && (
          <>
            <div>
              <label className="flex min-h-11 items-center justify-between gap-4">
                <span>{t('settings.audio.autoplay')}</span>
                <input
                  type="checkbox"
                  checked={autoplay}
                  onChange={(e) => set('autoplay', e.target.checked)}
                  className="size-6 accent-teal-700"
                />
              </label>
              <p className="text-sm text-stone-500">{t('settings.audio.autoplay.hint')}</p>
            </div>
            <label className="flex min-h-11 items-center justify-between gap-4">
              <span>{t('settings.audio.voice')}</span>
              <select
                value={voiceURI}
                onChange={(e) => set('voiceURI', e.target.value)}
                className="min-h-11 max-w-[60%] rounded-lg border border-stone-300 bg-white px-2 dark:border-stone-700 dark:bg-stone-900"
              >
                <option value="">{t('settings.audio.voice.auto')}</option>
                {voices.map((v) => (
                  <option key={v.voiceURI} value={v.voiceURI}>
                    {v.name}
                  </option>
                ))}
              </select>
            </label>
            <button
              type="button"
              onClick={() => void speak(t('audio.sample'))}
              className="min-h-11 w-full rounded-lg border border-stone-300 px-4 text-left hover:bg-stone-100 dark:border-stone-700 dark:hover:bg-stone-800"
            >
              {t('settings.audio.test')}
            </button>
          </>
        )}
      </fieldset>

      <button
        type="button"
        onClick={openReview}
        className="min-h-11 w-full rounded-lg border border-stone-300 px-4 text-left hover:bg-stone-100 dark:border-stone-700 dark:hover:bg-stone-800"
      >
        {t('review.open')}
      </button>

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
