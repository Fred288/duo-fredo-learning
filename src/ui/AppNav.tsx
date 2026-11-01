import type { ReactNode } from 'react';
import { t } from '../i18n';
import { useApp, type Screen } from '../store/app';
import { CourseIcon, MoreIcon, SearchIcon, SettingsIcon, StatsIcon, TodayIcon } from './NavIcons';

interface Item {
  id: string;
  label: string;
  icon: ReactNode;
  current: boolean;
  onSelect: () => void;
  keys?: string;
  /** Sichtbarkeit je Breite: Handy zeigt „Mehr“, ab Tablet stehen Statistik und Einstellungen direkt da. */
  show?: 'phone' | 'wide';
}

const itemBase =
  'flex min-h-14 flex-1 flex-col items-center justify-center gap-0.5 rounded-2xl px-2 text-xs ' +
  'focus-visible:outline-2 focus-visible:outline-focus md:min-h-12 md:flex-none md:py-2 ' +
  'xl:flex-row xl:justify-start xl:gap-3 xl:px-4 xl:text-sm';

/**
 * Hauptnavigation: Leiste unten auf dem Handy, Seitenleiste ab 768 px (ab 1280 px mit Text daneben).
 * Eine einzige `<nav>`, nur das Layout ändert sich mit der Breite.
 */
export function AppNav({ screen }: { screen: Screen }) {
  const { openToday, openCourse, openLookup, openMore, openStats, openSettings } =
    useApp.getState();
  const name = screen.name;
  const fromLookup = name === 'explainer' && screen.from === 'lookup';
  const items: Item[] = [
    {
      id: 'today',
      label: t('nav.today'),
      icon: <TodayIcon />,
      current: name === 'today',
      onSelect: openToday,
    },
    {
      id: 'course',
      label: t('nav.course'),
      icon: <CourseIcon />,
      current: name === 'course' || name === 'unit' || (name === 'explainer' && !fromLookup),
      onSelect: openCourse,
    },
    {
      id: 'lookup',
      label: t('nav.lookup'),
      icon: <SearchIcon />,
      current: name === 'lookup' || fromLookup,
      onSelect: openLookup,
      keys: '/',
    },
    {
      id: 'stats',
      label: t('nav.stats'),
      icon: <StatsIcon />,
      current: name === 'stats',
      onSelect: openStats,
      show: 'wide',
    },
    {
      id: 'settings',
      label: t('nav.settings'),
      icon: <SettingsIcon />,
      current: name === 'settings' || name === 'review',
      onSelect: openSettings,
      show: 'wide',
    },
    {
      id: 'more',
      label: t('nav.more'),
      icon: <MoreIcon />,
      current: name === 'more' || name === 'stats' || name === 'settings' || name === 'review',
      onSelect: openMore,
      show: 'phone',
    },
  ];

  return (
    <nav
      aria-label={t('nav.label')}
      className="fixed inset-x-0 bottom-0 z-20 flex gap-1 border-t border-line glass [--shadow-y:-8px] md:[--shadow-y:0px] pt-1 pr-[max(0.5rem,var(--safe-right))] pb-[max(0.25rem,var(--safe-bottom))] pl-[max(0.5rem,var(--safe-left))] md:inset-x-auto md:inset-y-0 md:left-0 md:w-[calc(var(--side-w)+var(--safe-left))] md:flex-col md:overflow-y-auto md:border-t-0 md:border-r md:pt-[calc(1.5rem+var(--safe-top))] md:pr-2"
    >
      {items.map((item) => (
        <button
          key={item.id}
          type="button"
          onClick={item.onSelect}
          aria-current={item.current ? 'page' : undefined}
          aria-keyshortcuts={item.keys}
          className={`${itemBase} ${
            item.current
              ? 'bg-brand-soft font-medium text-brand-ink'
              : 'text-ink-muted hover:bg-hover'
          } ${item.show === 'wide' ? 'max-md:hidden' : ''} ${item.show === 'phone' ? 'md:hidden' : ''}`}
        >
          {item.icon}
          <span>{item.label}</span>
        </button>
      ))}
    </nav>
  );
}
