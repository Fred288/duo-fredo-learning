import { t } from '../i18n';
import { speak, useCanSpeak } from '../store/audio';

const button =
  'inline-flex min-h-11 min-w-11 items-center justify-center rounded-lg text-stone-600 hover:bg-stone-200 focus-visible:outline-2 focus-visible:outline-teal-600 dark:text-stone-400 dark:hover:bg-stone-800';

/**
 * Spricht türkischen Text vor, normal und langsam. Ohne Audio oder Stimme erscheint nichts
 * (der Hinweis steht in den Einstellungen); der Text daneben bleibt immer sichtbar.
 */
export function SpeakButton({ text, slow = true }: { text: string; slow?: boolean }) {
  const can = useCanSpeak();
  if (!can) return null;
  return (
    <span className="inline-flex items-center">
      <button
        type="button"
        className={button}
        aria-label={t('audio.play', { text })}
        onClick={() => void speak(text)}
      >
        <svg
          aria-hidden="true"
          viewBox="0 0 24 24"
          className="size-5"
          fill="none"
          stroke="currentColor"
          strokeWidth="1.8"
          strokeLinecap="round"
          strokeLinejoin="round"
        >
          <path d="M11 5 6 9H3v6h3l5 4z" />
          <path d="M15.5 8.5a5 5 0 0 1 0 7M18.5 5.5a9 9 0 0 1 0 13" />
        </svg>
      </button>
      {slow && (
        <button
          type="button"
          className={`${button} px-2 text-sm`}
          aria-label={t('audio.slow', { text })}
          onClick={() => void speak(text, 'slow')}
        >
          {t('audio.slow.short')}
        </button>
      )}
    </span>
  );
}
