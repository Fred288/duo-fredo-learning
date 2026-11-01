import { useEffect, useRef } from 'react';
import { t } from './i18n';
import { isFocusScreen, useApp } from './store/app';
import { useAudioSetup } from './store/audio';
import { AppNav } from './ui/AppNav';
import { CourseScreen } from './ui/CourseScreen';
import { ExplainerScreen } from './ui/ExplainerScreen';
import { LookupScreen } from './ui/LookupScreen';
import { LessonScreen } from './ui/LessonScreen';
import { MistakesScreen } from './ui/MistakesScreen';
import { MoreScreen } from './ui/MoreScreen';
import { PlacementScreen } from './ui/PlacementScreen';
import { RepeatScreen } from './ui/RepeatScreen';
import { Review } from './ui/Review';
import { Settings } from './ui/Settings';
import { StatsScreen } from './ui/StatsScreen';
import { Today } from './ui/Today';
import { UpdateBanner } from './ui/UpdateBanner';

export function App() {
  const screen = useApp((s) => s.screen);
  const openLookup = useApp((s) => s.openLookup);
  // Fokusbereiche (Lektion, Wiederholen, Test) zeigen keine Navigation: eine Aufgabe nach der anderen.
  const showNav = !isFocusScreen(screen);
  const main = useRef<HTMLElement>(null);
  const shownScreen = useRef(screen);
  useAudioSetup();

  // Taste „/“ öffnet auf den Navigationsbildschirmen das Nachschlagewerk (nicht beim Tippen in Feldern).
  useEffect(() => {
    if (!showNav) return;
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
  }, [showNav, openLookup]);

  // Beim Bildschirmwechsel an den Anfang und den Fokus auf die Überschrift (Ansage für Screenreader).
  // Hat der neue Bildschirm schon ein Feld fokussiert (autoFocus), bleibt es dabei.
  useEffect(() => {
    // Nur bei einem echten Wechsel (nicht beim ersten Anzeigen, auch nicht im doppelten Effekt von StrictMode).
    if (shownScreen.current === screen) return;
    shownScreen.current = screen;
    const el = main.current;
    if (!el) return;
    if (document.scrollingElement) document.scrollingElement.scrollTop = 0;
    const active = document.activeElement;
    if (active && active !== el && el.contains(active)) return;
    const heading = el.querySelector<HTMLElement>('h1');
    if (heading) heading.tabIndex = -1;
    (heading ?? el).focus({ preventScroll: true });
  }, [screen]);

  return (
    <div
      className={`min-h-dvh bg-canvas text-ink ${
        showNav
          ? '[--nav-offset:4.5rem] md:[--nav-offset:0px] md:[--side-w:5rem] xl:[--side-w:15rem]'
          : ''
      }`}
    >
      <a
        href="#main"
        onClick={(e) => {
          e.preventDefault();
          main.current?.focus();
        }}
        className="sr-only focus:not-sr-only focus:fixed focus:top-2 focus:left-2 focus:z-30 focus:rounded-lg focus:bg-surface focus:px-4 focus:py-3 focus:shadow-lg"
      >
        {t('nav.skip')}
      </a>
      {showNav && <AppNav screen={screen} />}
      <main
        id="main"
        ref={main}
        tabIndex={-1}
        className={`outline-none ${showNav ? 'md:pl-[calc(var(--side-w)+var(--safe-left))]' : ''}`}
      >
        <div className="mx-auto max-w-xl pt-[calc(1.5rem+var(--safe-top))] pr-[max(1rem,var(--safe-right))] pb-[calc(1.5rem+var(--nav-offset,0px)+var(--safe-bottom))] pl-[max(1rem,var(--safe-left))] md:pl-4">
          {screen.name === 'today' && <Today />}
          {screen.name === 'course' && <CourseScreen />}
          {screen.name === 'more' && <MoreScreen />}
          {screen.name === 'settings' && <Settings />}
          {screen.name === 'review' && <Review />}
          {screen.name === 'mistakes' && <MistakesScreen />}
          {screen.name === 'repeat' && <RepeatScreen />}
          {screen.name === 'lookup' && <LookupScreen />}
          {screen.name === 'stats' && <StatsScreen />}
          {screen.name === 'placement' && <PlacementScreen />}
          {screen.name === 'explainer' && (
            <ExplainerScreen unitId={screen.unitId} section={screen.section} from={screen.from} />
          )}
          {screen.name === 'lesson' && (
            <LessonScreen key={screen.lessonId} unitId={screen.unitId} lessonId={screen.lessonId} />
          )}
        </div>
      </main>
      <UpdateBanner />
    </div>
  );
}
