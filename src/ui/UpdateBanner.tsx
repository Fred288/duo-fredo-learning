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
      className="fixed inset-x-4 bottom-4 z-10 mx-auto flex max-w-xl items-center justify-between gap-3 rounded-xl border border-line-strong bg-surface p-3 text-sm shadow-lg"
    >
      <span>{needRefresh ? t('pwa.update') : t('pwa.offlineReady')}</span>
      <span className="flex gap-2">
        {needRefresh && (
          <button
            type="button"
            onClick={() => void updateServiceWorker(true)}
            className="min-h-11 rounded-lg bg-brand px-4 font-medium text-white focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-focus"
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
