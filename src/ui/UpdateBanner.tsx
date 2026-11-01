import { useRegisterSW } from 'virtual:pwa-register/react';
import { t } from '../i18n';

/** Dezente Leiste für Service-Worker-Meldungen; lädt nie ungefragt neu. */
export function UpdateBanner() {
  const {
    needRefresh: [needRefresh, setNeedRefresh],
    offlineReady: [offlineReady, setOfflineReady],
    updateServiceWorker,
  } = useRegisterSW();

  if (!needRefresh && !offlineReady) return null;
  const close = () => {
    setNeedRefresh(false);
    setOfflineReady(false);
  };

  return (
    <div
      role="status"
      className="fixed inset-x-4 bottom-[calc(1rem+var(--banner-offset,0px)+var(--safe-bottom))] z-20 mx-auto md:left-[calc(var(--side-w,0px)+var(--safe-left)+1rem)] flex max-w-xl items-center justify-between gap-3 rounded-2xl border border-line-strong glass-strong p-3 text-sm"
    >
      <span>{needRefresh ? t('pwa.update') : t('pwa.offlineReady')}</span>
      <span className="flex gap-2">
        {needRefresh && (
          <button
            type="button"
            onClick={() => void updateServiceWorker(true)}
            className="min-h-11 rounded-lg bg-brand px-4 font-medium text-on-brand focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-focus"
          >
            {t('pwa.reload')}
          </button>
        )}
        <button
          type="button"
          onClick={close}
          className="min-h-11 rounded-lg px-3 text-ink-muted hover:bg-hover"
        >
          {t('pwa.dismiss')}
        </button>
      </span>
    </div>
  );
}
