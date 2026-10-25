# Yol – Türkisch lernen (Deutsch → Türkisch)

Spec: `SPEC.md`. Strategie und Modellwahl: `STRATEGY.md`.

## Befehle

- `npm run dev` – Dev-Server
- `npm run lint` / `npm run typecheck` / `npm test` / `npm run build`
- `npm run content` – validiert `content/**/*.yaml` und schreibt `public/content/` (generiert, läuft automatisch vor dev/build)
- `npm run e2e` – Playwright (braucht `npx playwright install chromium`)

## Konventionen

- Türkischer Text: nur `toLocaleLowerCase('tr')` / `toLocaleUpperCase('tr')` (ESLint-Regel erzwingt das), am besten über `trLower`/`trUpper` aus `src/lib/turkish.ts` (inkl. NFC).
- Antwortprüfung: `checkAnswer` in `src/lib/answer.ts` (correct/almost/wrong + Hinweise). Grammatikübungen mit `allowTypos: false`, sonst gilt `evda` als Tippfehler von `evde`.
- Inhalte liegen in `content/` (YAML/JSON), nie im Code; Zod-Validierung im Build.
- Schema: `src/content/schema.ts`. IDs sind stabil (SRS hängt daran): Unit `a1-u01`, Lektion `a1-u01-l1`, Übung `a1-u01-l1-e1`; Vokabel-ID = `tr`, bei Homonymen explizites `id`.
- Suffix-Builder referenziert Morphem-Tags (`src/morphology/tags.ts`), keine Oberflächenformen.
- Von Claude erzeugter türkischer Content bleibt `reviewed: false`.
- Morphologie-Regeln in `src/morphology/`, jede Regel mit Unit-Test. Suffixe als Archiphonem-Templates (`suffixes.ts`: A, I, D, Klammer = Puffer). Erweichung und Harmonie-Ausnahmen sind lexikalisch (`softens`, `harmony_vowel` in der Vokabel), nicht geraten. Bekannte Lücken: `KNOWN_LIMITS` in `inflect.ts`.
- Der Build prüft jedes `suffix_builder`-`target` gegen die Engine.
- UI-Texte als i18n-Schlüssel, nicht hartcodiert.
- Keine Gamification (siehe SPEC Abschnitt 2).
