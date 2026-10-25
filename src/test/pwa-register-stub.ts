// Ersatz für das virtuelle Modul von vite-plugin-pwa in Vitest (kein Service Worker in jsdom).
const state = () => [false, () => {}] as const;

export function useRegisterSW() {
  return {
    needRefresh: state(),
    offlineReady: state(),
    updateServiceWorker: async () => {},
  };
}
