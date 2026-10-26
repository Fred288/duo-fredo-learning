# Yol – Türkisch lernen (Deutsch → Türkisch)

Spec: `SPEC.md`. Strategie und Modellwahl: `STRATEGY.md`. Curriculum: `docs/CURRICULUM.md`, Engine-Lücken: `docs/ENGINE_GAPS.md`, Quellenregeln: `docs/REFERENCES.md` (keine Texte aus geschützten Werken übernehmen).

## Befehle

- `npm run dev` – Dev-Server
- `npm run lint` / `npm run typecheck` / `npm test` / `npm run build`
- `npm run content` – validiert `content/**/*.yaml` und schreibt `public/content/` (generiert, läuft automatisch vor dev/build)
- `npm run e2e` – Playwright gegen den Dev-Server (braucht `npx playwright install chromium`)
- `npm run e2e:pwa` – Offline- und Manifest-Test gegen den Produktions-Build

## Konventionen

- Türkischer Text: nur `toLocaleLowerCase('tr')` / `toLocaleUpperCase('tr')` (ESLint-Regel erzwingt das), am besten über `trLower`/`trUpper` aus `src/lib/turkish.ts` (inkl. NFC).
- Antwortprüfung: `checkAnswer` in `src/lib/answer.ts` (correct/almost/wrong + Hinweise). Grammatikübungen mit `allowTypos: false`, sonst gilt `evda` als Tippfehler von `evde`.
- Inhalte liegen in `content/` (YAML/JSON), nie im Code; Zod-Validierung im Build.
- Schema: `src/content/schema.ts`. IDs sind stabil (SRS hängt daran): Unit `a1-u01`, Lektion `a1-u01-l1`, Übung `a1-u01-l1-e1`; Vokabel-ID = `tr`, bei Homonymen explizites `id`.
- Suffix-Builder referenziert Morphem-Tags (`src/morphology/tags.ts`), keine Oberflächenformen.
- Persistenz: Dexie in `src/db/db.ts` (Schemaänderungen nur als neue `version(n)` mit `upgrade`, nie v1 ändern). Zugriffe über `safely()`, damit die App ohne IndexedDB weiterläuft. Einstellungen in `store/settings.ts`, Fortschritt in `store/progress.ts`; Tagesziel zählt Lektionen, Streak/Fortschritt sind reine Funktionen in `src/progress/stats.ts`.
- Von Claude erzeugter türkischer Content bleibt `reviewed: false`.
- Morphologie-Regeln in `src/morphology/`, jede Regel mit Unit-Test. Suffixe als Archiphonem-Templates (`suffixes.ts`: A, I, D, C, Klammer = Puffer; Ableitungen `LI`/`SIZ`/`LIK`/`CI` in Slot 0 ohne Apostroph, `KI` danach mit Plural/Kasus). Erweichung und Harmonie-Ausnahmen sind lexikalisch (`softens`, `harmony_vowel` in der Vokabel), nicht geraten. Bekannte Lücken: `KNOWN_LIMITS` in `inflect.ts`.
- Der Build prüft jedes `suffix_builder`- und `conjugation`-`target` sowie jede Zelle einer `paradigm`-Tabelle gegen die Engine (`src/content/lexicon.ts`: `solveExercise`, `solveParadigm`, `sameForm`). Vokabeln anderer Units, die eine Grammatikübung braucht, schreibt der Build als `lexicon` in die Unit-JSON.
- Schemas sind `strict`: unbekannte Schlüssel brechen den Build. In YAML-Flow-Mappings (`{ … }`) Werte mit Komma quoten, sonst werden sie abgeschnitten.
- Übungstyp `paradigm`: Tabelle durchdeklinieren (`kind: noun`, `rows` = Tag-Folgen) oder durchkonjugieren (`verb`/`copula`, `persons`). Copula-Tabellen ohne 3pl (-lar optional). Zellen ohne Groß/Klein-Strenge (`paradigmCells` in `src/session/grade.ts`).
- „Fehler wiederholen“: reine Funktion `openMistakes` in `src/progress/stats.ts` (letzter Versuch je Übung falsch); Screen `MistakesScreen`, kein Lektionsabschluss.
- Neue Übungen hinten an die Lektion anhängen, neue Lektionen dürfen mit höherer Nummer vor der Wiederholung stehen; IDs nie umnummerieren.
- Verben: Vokabel `tr` = Infinitiv (gelmek), Engine `conjugate()` mit `tense` present/past/future/aorist/evidential/necessitative/imperative sowie `ability` (können), `polite` (Imperativ geliniz) und `passive` (yapılır), in `conjugation` und `paradigm`; Kopula `predicate()` mit `tense` past/evidential (öğrenciydim); Nominalsatz `predicate()`; Pronomen als Tabelle (`pronouns.ts`). Weitere Vokabel-Flags: `drops_vowel` (oğul → oğlum), `proper` (İstanbul'da), `capitalized` (Almanlar), `y_stem` (su → suyun), `aorist: ar|ir` (Override der Aorist-Regel).
- UI-Texte als i18n-Schlüssel, nicht hartcodiert.
- Keine Gamification (siehe SPEC Abschnitt 2).
- PWA: `vite-plugin-pwa` (`registerType: 'prompt'`), Inhalte (`public/content/*.json`) sind im Precache. `BASE_PATH` setzt die Basis für GitHub Pages. Icons: `npx tsx tools/make-icons.ts` (rendert `public/icon.svg`).
- Review: Notizen ("Fehler melden") liegen lokal in Dexie (`notes`, seit Schema v2). `reviewed: true` wird nur im Repo in der YAML gesetzt.
