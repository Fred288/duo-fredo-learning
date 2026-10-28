import { defineConfig } from '@playwright/test';

// Der Vite-Dev-Server transformiert Module bei Bedarf; viele parallele Browser
// (Standard: halbe Kernzahl) lassen einzelne Klicks unter Last in Zeitüberschreitungen laufen.
// Vier Worker sind schnell genug und bleiben auch auf kleinen Rechnern stabil.
export default defineConfig({
  testDir: 'e2e',
  workers: process.env.E2E_WORKERS ? Number(process.env.E2E_WORKERS) : 4,
  expect: { timeout: 10_000 },
  use: { baseURL: 'http://localhost:5173', actionTimeout: 15_000 },
  webServer: { command: 'npm run dev -- --port 5173', url: 'http://localhost:5173', reuseExistingServer: true },
});
