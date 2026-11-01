import { useEffect, useLayoutEffect, useRef } from 'react';
import { t } from './i18n';
import { isFocusScreen, takeRestoreScroll, useApp, type Screen } from './store/app';
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
import { useWide } from './ui/useWide';

const isCourse = (screen: Screen) => screen.name === 'course' || screen.name === 'unit';

export function App() {
  const screen = useApp((s) => s.screen);
  const openLookup = useApp((s) => s.openLookup);
  // Fokusbereiche (Lektion, Wiederholen, Test) zeigen keine Navigation: eine Aufgabe nach der anderen.
  const showNav = !isFocusScreen(screen);
  const inCourse = isCourse(screen);
  const wide = useWide();
  const main = useRef<HTMLElement>(null);
  const scrolledScreen = useRef(screen);
  const shownScreen = useRef(screen);
  const shownWide = useRef(wide);
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

  // Beim Bildschirmwechsel an den Anfang, Zurück stellt den alten Stand her. Als Layout-Effekt vor
  // den Effekten der Bildschirme, sonst überschriebe er deren Scrollen (Kurs zur Start-Unit).
  // In zwei Spalten bleibt die Liste stehen, wenn man eine Unit wählt.
  useLayoutEffect(() => {
    const previous = scrolledScreen.current;
    if (previous === screen) return;
    scrolledScreen.current = screen;
    const restore = takeRestoreScroll();
    const stay = wide && isCourse(previous) && isCourse(screen);
    if (document.scrollingElement && (restore !== undefined || !stay)) {
      document.scrollingElement.scrollTop = restore ?? 0;
    }
  }, [screen, wide]);

  // Beim Bildschirmwechsel bekommt die Überschrift den Fokus (Ansage für Screenreader).
  // Hat der neue Bildschirm schon ein Feld fokussiert (autoFocus), bleibt es dabei.
  useEffect(() => {
    // Nur bei einem echten Wechsel (nicht beim ersten Anzeigen, auch nicht im doppelten Effekt von StrictMode).
    if (shownScreen.current === screen) return;
    shownScreen.current = screen;
    const el = main.current;
    if (!el) return;
    const focusHeading = () => {
      const active = document.activeElement;
      if (active && active !== el && active !== document.body && el.contains(active)) return true;
      const heading = el.querySelector<HTMLElement>('h1');
      if (heading) heading.tabIndex = -1;
      (heading ?? el).focus({ preventScroll: true });
      return !!heading;
    };
    if (focusHeading()) return;
    // Der Bildschirm lädt noch: Überschrift übernimmt den Fokus, sobald sie erscheint.
    const observer = new MutationObserver(() => {
      if (el.querySelector('h1') && focusHeading()) observer.disconnect();
    });
    observer.observe(el, { childList: true, subtree: true });
    return () => observer.disconnect();
  }, [screen]);

  // Drehen des Geräts baut den Kurs um (Spalten ↔ eigener Bildschirm): Fokus nicht verlieren.
  useEffect(() => {
    if (shownWide.current === wide) return;
    shownWide.current = wide;
    if (!inCourse || document.activeElement !== document.body) return;
    const heading = main.current?.querySelector<HTMLElement>('h1');
    if (heading) heading.tabIndex = -1;
    heading?.focus({ preventScroll: true });
  }, [wide, inCourse]);

  return (
    <div
      className={`min-h-dvh text-ink ${
        showNav
          ? '[--nav-offset:4.5rem] md:[--nav-offset:0px] md:[--side-w:6rem] xl:[--side-w:15rem]'
          : 'bg-canvas'
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
        <div
          className={`mx-auto pt-[calc(1.5rem+var(--safe-top))] pr-[max(1rem,var(--safe-right))] pb-[calc(1.5rem+var(--nav-offset,0px)+var(--safe-bottom))] pl-[max(1rem,var(--safe-left))] md:pl-4 ${
            inCourse ? 'max-w-xl lg:max-w-5xl' : 'max-w-xl'
          }`}
        >
          {screen.name === 'today' && <Today />}
          {(screen.name === 'course' || screen.name === 'unit') && (
            <CourseScreen unitId={screen.name === 'unit' ? screen.unitId : undefined} />
          )}
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
