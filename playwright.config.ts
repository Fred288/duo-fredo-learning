import { defineConfig } from '@playwright/test';

// Der Vite-Dev-Server transformiert Module bei Bedarf; viele parallele Browser
// (Standard: halbe Kernzahl) lassen einzelne Klicks unter Last in Zeitüberschreitungen laufen.
// Vier Worker sind schnell genug und bleiben auch auf kleinen Rechnern stabil.
//
// Drei Breiten, weil sich die Navigation ändert: Desktop (Seitenleiste mit Text, 1280 px), Tablet
// (schmale Seitenleiste, 820 px) und Handy (Leiste unten, 390 px). Die Unit-Läufe lösen alle
// Lektionen und hängen nicht am Layout; sie laufen nur am Desktop.
export default defineConfig({
  testDir: 'e2e',
  workers: process.env.E2E_WORKERS ? Number(process.env.E2E_WORKERS) : 4,
  expect: { timeout: 10_000 },
  use: { baseURL: 'http://localhost:5173', actionTimeout: 15_000 },
  projects: [
    { name: 'desktop', use: { viewport: { width: 1280, height: 720 } } },
    {
      name: 'tablet',
      use: { viewport: { width: 820, height: 1180 } },
      testIgnore: /units\.spec/,
    },
    {
      name: 'mobile',
      use: { viewport: { width: 390, height: 844 } },
      testIgnore: /units\.spec/,
    },
  ],
  webServer: {
    command: 'npm run dev -- --port 5173',
    url: 'http://localhost:5173',
    reuseExistingServer: true,
  },
});
