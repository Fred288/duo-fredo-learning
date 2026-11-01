import { defineConfig } from '@playwright/test';

// Offline-Test gegen den Produktions-Build (Service Worker gibt es nur dort).
export default defineConfig({
  testDir: 'e2e-pwa',
  webServer: {
    command: 'npm run build && npm run preview -- --port 4173 --strictPort',
    url: 'http://localhost:4173',
    reuseExistingServer: false,
    timeout: 120_000,
  },
  use: { baseURL: 'http://localhost:4173', serviceWorkers: 'allow' },
  projects: [
    { name: 'desktop', use: { viewport: { width: 1280, height: 720 } } },
    { name: 'mobile', use: { viewport: { width: 390, height: 844 } } },
  ],
});
