import { t } from '../i18n';
import { speak, useCanSpeak } from '../store/audio';

const small =
  'inline-flex min-h-11 min-w-11 items-center justify-center rounded-lg text-ink-muted hover:bg-hover focus-visible:outline-2 focus-visible:outline-focus';
const large =
  'inline-flex min-h-14 flex-1 items-center justify-center gap-2 rounded-xl border border-line-strong bg-surface px-5 font-medium hover:bg-hover focus-visible:outline-2 focus-visible:outline-focus';

const Icon = () => (
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
);

/**
 * Spricht türkischen Text vor, normal und langsam. Ohne Audio oder Stimme erscheint nichts
 * (der Hinweis steht in den Einstellungen); der Text daneben bleibt immer sichtbar.
 * `large` (Hörübungen): große Knöpfe, deren Beschriftung den Text nicht verrät.
 */
export function SpeakButton({
  text,
  slow = true,
  size = 'small',
}: {
  text: string;
  slow?: boolean;
  size?: 'small' | 'large';
}) {
  const can = useCanSpeak();
  if (!can) return null;
  if (size === 'large') {
    return (
      <div className="flex gap-2">
        <button type="button" className={large} onClick={() => void speak(text)}>
          <Icon />
          {t('audio.listen')}
        </button>
        {slow && (
          <button type="button" className={large} onClick={() => void speak(text, 'slow')}>
            <Icon />
            {t('audio.listen.slow')}
          </button>
        )}
      </div>
    );
  }
  return (
    <span className="inline-flex items-center">
      <button
        type="button"
        className={small}
        aria-label={t('audio.play', { text })}
        onClick={() => void speak(text)}
      >
        <Icon />
      </button>
      {slow && (
        <button
          type="button"
          className={`${small} px-2 text-sm`}
          aria-label={t('audio.slow', { text })}
          onClick={() => void speak(text, 'slow')}
        >
          {t('audio.slow.short')}
        </button>
      )}
    </span>
  );
}
