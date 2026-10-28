import { useEffect, useRef, useState } from 'react';
import { getRecorder, type RecordError } from '../audio/recorder';
import { t } from '../i18n';
import { speak, stopSpeaking, useCanSpeak } from '../store/audio';
import { useSettings } from '../store/settings';

const small =
  'inline-flex min-h-11 min-w-11 items-center justify-center rounded-lg text-stone-600 hover:bg-stone-200 focus-visible:outline-2 focus-visible:outline-teal-600 dark:text-stone-400 dark:hover:bg-stone-800';

const Mic = () => (
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
    <rect x="9" y="3" width="6" height="11" rx="3" />
    <path d="M5 11a7 7 0 0 0 14 0M12 18v3" />
  </svg>
);

type State = 'idle' | 'starting' | 'recording' | 'ready' | Exclude<RecordError, 'cancelled'>;

/** Der Knopf, dem die laufende Aufnahme gehört; startet ein anderer, fällt dieser zurück. */
let owner: (() => void) | undefined;

/**
 * Nachsprechen ohne Bewertung: aufnehmen, dann eigene Aufnahme und Vorbild nacheinander hören.
 * Die Aufnahme bleibt nur im Speicher und verschwindet beim Verlassen. Ohne Mikrofon/MediaRecorder
 * oder bei ausgeschalteter Einstellung erscheint nichts.
 */
export function ShadowButton({ text }: { text: string }) {
  const enabled = useSettings((s) => s.shadowing);
  const canSpeak = useCanSpeak();
  const [state, setState] = useState<State>('idle');
  const url = useRef<string>(undefined);
  const audio = useRef<HTMLAudioElement>(undefined);
  const alive = useRef(true);
  const [reset] = useState(() => () => setState('idle'));

  const drop = () => {
    audio.current?.pause();
    if (url.current) URL.revokeObjectURL(url.current);
    url.current = undefined;
  };
  useEffect(() => {
    alive.current = true;
    return () => {
      alive.current = false;
      // Nur die eigene Aufnahme abbrechen, nicht die eines anderen Satzes.
      if (owner === reset) {
        owner = undefined;
        getRecorder().cancel();
      }
      drop();
    };
  }, [reset]);

  if (!enabled || !getRecorder().supported()) return null;

  const playOwn = () =>
    new Promise<void>((resolve) => {
      if (!url.current) return resolve();
      audio.current?.pause();
      const a = new Audio(url.current);
      audio.current = a;
      a.onended = () => resolve();
      a.onerror = () => resolve();
      a.play().catch(() => resolve());
    });

  const finish = async () => {
    if (owner === reset) owner = undefined;
    const blob = await getRecorder().stop();
    // Inzwischen verlassen: keine Object-URL mehr anlegen, nichts mehr abspielen.
    if (!alive.current) return;
    drop();
    if (!blob) return setState('idle');
    url.current = URL.createObjectURL(blob);
    setState('ready');
    // Erst die eigene Aufnahme, dann das Vorbild: der Vergleich ist der Sinn der Übung.
    await playOwn();
    if (alive.current) await speak(text);
  };

  const record = async () => {
    if (state === 'starting') return;
    if (state === 'recording') return finish();
    stopSpeaking();
    drop();
    owner?.();
    owner = reset;
    setState('starting');
    try {
      // Höchstdauer erreicht: wie selbst beendet.
      await getRecorder().start(() => void finish());
      setState('recording');
    } catch (e) {
      if (owner === reset) owner = undefined;
      setState(e === 'denied' || e === 'failed' ? e : 'idle');
    }
  };

  return (
    <span className="inline-flex items-center">
      <button
        type="button"
        onClick={() => void record()}
        aria-pressed={state === 'recording'}
        aria-label={
          state === 'recording' ? t('shadow.stop', { text }) : t('shadow.record', { text })
        }
        className={`${small} ${state === 'recording' ? 'bg-rose-100 text-rose-700 dark:bg-rose-950 dark:text-rose-300' : ''}`}
      >
        <Mic />
      </button>
      {state === 'ready' && (
        <>
          <button
            type="button"
            onClick={() => void playOwn()}
            className={`${small} px-2 text-sm`}
            aria-label={t('shadow.mine', { text })}
          >
            {t('shadow.mine.short')}
          </button>
          {canSpeak && (
            <button
              type="button"
              onClick={() => void playOwn().then(() => speak(text))}
              className={`${small} px-2 text-sm`}
              aria-label={t('shadow.compare', { text })}
            >
              {t('shadow.compare.short')}
            </button>
          )}
        </>
      )}
      {(state === 'denied' || state === 'failed') && (
        <span role="status" className="px-1 text-xs text-stone-500">
          {t(`shadow.${state}`)}
        </span>
      )}
    </span>
  );
}
