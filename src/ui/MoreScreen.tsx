import { t } from '../i18n';
import { useApp } from '../store/app';
import { SettingsIcon, StatsIcon } from './NavIcons';

const row =
  'flex min-h-14 w-full items-center gap-3 rounded-xl border border-line bg-surface p-3 text-left hover:bg-hover focus-visible:outline-2 focus-visible:outline-focus';

/** „Mehr“ (Handy): Statistik und Einstellungen; ab Tablet stehen beide in der Seitenleiste. */
export function MoreScreen() {
  const openStats = useApp((s) => s.openStats);
  const openSettings = useApp((s) => s.openSettings);
  return (
    <section aria-labelledby="more-title" className="space-y-4">
      <h1 id="more-title" className="text-2xl font-semibold">
        {t('more.title')}
      </h1>
      <button type="button" onClick={openStats} className={row}>
        <StatsIcon />
        <span>
          <span className="block font-medium">{t('nav.stats')}</span>
          <span className="block text-sm text-ink-muted">{t('more.stats.hint')}</span>
        </span>
      </button>
      <button type="button" onClick={openSettings} className={row}>
        <SettingsIcon />
        <span>
          <span className="block font-medium">{t('nav.settings')}</span>
          <span className="block text-sm text-ink-muted">{t('more.settings.hint')}</span>
        </span>
      </button>
    </section>
  );
}
