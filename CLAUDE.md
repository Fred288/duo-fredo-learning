# Yol – Türkisch lernen (Deutsch → Türkisch)

Spec: `SPEC.md`. Strategie und Modellwahl: `STRATEGY.md`.

## Befehle
- `npm run dev` – Dev-Server
- `npm run lint` / `npm run typecheck` / `npm test` / `npm run build`
- `npm run e2e` – Playwright (braucht `npx playwright install chromium`)

## Konventionen
- Türkischer Text: nur `toLocaleLowerCase('tr')` / `toLocaleUpperCase('tr')` (ESLint-Regel erzwingt das). Vergleich nach NFC-Normalisierung.
- Inhalte liegen in `content/` (YAML/JSON), nie im Code; Zod-Validierung im Build.
- Von Claude erzeugter türkischer Content bleibt `reviewed: false`.
- Morphologie-Regeln in `src/morphology/`, jede Regel mit Unit-Test.
- UI-Texte als i18n-Schlüssel, nicht hartcodiert.
- Keine Gamification (siehe SPEC Abschnitt 2).
