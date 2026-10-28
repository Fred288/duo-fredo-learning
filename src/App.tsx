import { useEffect } from 'react';
import { t } from './i18n';
import { useApp } from './store/app';
import { useAudioSetup } from './store/audio';
import { ExplainerScreen } from './ui/ExplainerScreen';
import { Home } from './ui/Home';
import { LookupScreen } from './ui/LookupScreen';
import { LessonScreen } from './ui/LessonScreen';
import { MistakesScreen } from './ui/MistakesScreen';
import { RepeatScreen } from './ui/RepeatScreen';
import { Review } from './ui/Review';
import { Settings } from './ui/Settings';
import { UpdateBanner } from './ui/UpdateBanner';

export function App() {
  const screen = useApp((s) => s.screen);
  const openSettings = useApp((s) => s.openSettings);
  const openLookup = useApp((s) => s.openLookup);
  const onHome = screen.name === 'home';
  useAudioSetup();

  // Taste „/“ öffnet auf der Startseite das Nachschlagewerk (nicht beim Tippen in Feldern).
  useEffect(() => {
    if (!onHome) return;
    const onKey = (e: KeyboardEvent) => {
      const el = e.target as HTMLElement | null;
      // Windows meldet AltGr als Strg+Alt; auf Layouts mit „/“ hinter AltGr soll die Taste gelten.
      const altGr = e.getModifierState?.('AltGraph') ?? false;
      if (e.key !== '/' || e.metaKey || ((e.ctrlKey || e.altKey) && !altGr)) return;
      if (el && (el.isContentEditable || /^(INPUT|TEXTAREA|SELECT)$/.test(el.tagName))) return;
      e.preventDefault();
      openLookup();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onHome, openLookup]);

  return (
    <div className="min-h-dvh bg-stone-50 text-stone-900 dark:bg-stone-950 dark:text-stone-100">
      <main className="mx-auto max-w-xl px-4 py-6">
        {screen.name === 'home' && (
          <>
            <header className="flex items-start justify-between gap-3">
              <div>
                <h1 className="text-2xl font-semibold">{t('app.title')}</h1>
                <p className="mt-1 text-stone-600 dark:text-stone-400">{t('app.tagline')}</p>
              </div>
              <div className="flex">
                <button
                  type="button"
                  onClick={openLookup}
                  aria-label={t('home.lookup')}
                  aria-keyshortcuts="/"
                  className="min-h-11 min-w-11 rounded-lg hover:bg-stone-200 focus-visible:outline-2 focus-visible:outline-teal-600 dark:hover:bg-stone-800"
                >
                  <svg
                    aria-hidden="true"
                    viewBox="0 0 24 24"
                    className="mx-auto size-6"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="1.8"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  >
                    <circle cx="11" cy="11" r="7" />
                    <path d="m20 20-3.5-3.5" />
                  </svg>
                </button>
                <button
                  type="button"
                  onClick={openSettings}
                  aria-label={t('home.settings')}
                  className="min-h-11 min-w-11 rounded-lg text-xl hover:bg-stone-200 focus-visible:outline-2 focus-visible:outline-teal-600 dark:hover:bg-stone-800"
                >
                  <svg
                    aria-hidden="true"
                    viewBox="0 0 24 24"
                    className="mx-auto size-6"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="1.8"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  >
                    <circle cx="12" cy="12" r="3" />
                    <path d="M19.4 15a1.7 1.7 0 0 0 .3 1.9l.1.1a2 2 0 1 1-2.8 2.8l-.1-.1a1.7 1.7 0 0 0-1.9-.3 1.7 1.7 0 0 0-1 1.5V21a2 2 0 1 1-4 0v-.1a1.7 1.7 0 0 0-1.1-1.5 1.7 1.7 0 0 0-1.9.3l-.1.1a2 2 0 1 1-2.8-2.8l.1-.1a1.7 1.7 0 0 0 .3-1.9 1.7 1.7 0 0 0-1.5-1H3a2 2 0 1 1 0-4h.1a1.7 1.7 0 0 0 1.5-1.1 1.7 1.7 0 0 0-.3-1.9l-.1-.1a2 2 0 1 1 2.8-2.8l.1.1a1.7 1.7 0 0 0 1.9.3H9a1.7 1.7 0 0 0 1-1.5V3a2 2 0 1 1 4 0v.1a1.7 1.7 0 0 0 1 1.5 1.7 1.7 0 0 0 1.9-.3l.1-.1a2 2 0 1 1 2.8 2.8l-.1.1a1.7 1.7 0 0 0-.3 1.9V9a1.7 1.7 0 0 0 1.5 1H21a2 2 0 1 1 0 4h-.1a1.7 1.7 0 0 0-1.5 1z" />
                  </svg>
                </button>
              </div>
            </header>
            <Home />
          </>
        )}
        {screen.name === 'settings' && <Settings />}
        {screen.name === 'review' && <Review />}
        {screen.name === 'mistakes' && <MistakesScreen />}
        {screen.name === 'repeat' && <RepeatScreen />}
        {screen.name === 'lookup' && <LookupScreen />}
        {screen.name === 'explainer' && (
          <ExplainerScreen unitId={screen.unitId} section={screen.section} from={screen.from} />
        )}
        {screen.name === 'lesson' && (
          <LessonScreen key={screen.lessonId} unitId={screen.unitId} lessonId={screen.lessonId} />
        )}
      </main>
      <UpdateBanner />
    </div>
  );
}
