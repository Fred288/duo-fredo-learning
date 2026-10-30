# Umsetzungsstrategie: Yol (Türkisch lernen)

Basis: `SPEC.md`. Dieses Dokument legt Reihenfolge, Arbeitsweise und Modellwahl fest.

## 1. Leitprinzipien

1. **Vertikale Slices statt Schichten.** Früh eine komplette Lektion Ende-zu-Ende (Content-YAML → Schema → Engine → UI → Dexie), danach verbreitern.
2. **Engine und Schema zuerst.** Morphologie-Engine und Content-Schema sind das Fundament; UI und Inhalte hängen davon ab.
3. **Tests vor Code in der Engine (TDD).** Die Beispiele aus SPEC 3.2 sind die ersten Testfälle.
4. **Inhalte strikt getrennt vom Code**, Zod-Validierung bricht den Build. Alles von Claude Generierte bleibt `reviewed: false` (SPEC 9/10).
5. **Der Mensch ist der Türkisch-Reviewer.** Kein Modell ersetzt einen Muttersprachler; Review-Aufwand ist der Flaschenhals bei Inhalten, nicht die Generierung.
6. **Kleine, reviewbare PRs/Commits** pro Meilenstein; Definition of Done = Tests grün + Typecheck + Lint.

## 2. Entscheidungen vor Start (aus SPEC 12)

| Frage | Vorschlag (Default, falls keine Antwort) |
|---|---|
| Name | "Yol" beibehalten |
| Register | Standardtürkisch (Istanbul), informell `sen` in Alltagsdialogen, `siz` konsistent markiert |
| Audio | Phase 1 ohne Audio; Phase 2 TTS (tr-TR) als `synthetic: true`, Austausch gegen Aufnahmen später möglich |
| Inhaltsreview | Nutzer prüft pro Unit in der Review-Ansicht; Muttersprachler optional |

## 3. Phasen und Meilensteine

### Phase 1 (MVP), Meilensteine

| # | Meilenstein | Ergebnis / Done-Kriterium |
|---|---|---|
| M0 | **Gerüst** | Vite+React+TS, Tailwind, Zustand, Vitest, Playwright, ESLint/Prettier, CI (GitHub Actions: lint, typecheck, test, build) |
| M1 | **Datenschema** | Zod-Schemas für Unit/Lesson/Exercise (diskriminierte Union je Übungstyp), Vokabel, Erklärkarte; Build-Validator (`tools/validate-content`), Duplikat-ID-Check, `reviewed`-Warnung |
| M2 | **Türkisch-Utils + Antwortprüfung** | `tr-lower/upper`, NFC, Sonderzeichen-Toleranz, Levenshtein-"fast richtig", Mehrfachlösungen; Unit-Tests (Pflicht) |
| M3 | **Morphologie-Engine** | Vokalharmonie (2-/4-fach), Konsonantenwechsel, Pufferlaute, Suffixreihenfolge, Ausnahmeliste aus Daten; Tests: `ev→evler→evlerde`, `kitap→kitabı`, `okul→okulda`, `göz→gözler`, `saat→saati` |
| M4 | **Übungs-Runner + Basistypen** | Session-Logik (Lektion, Fortschritt, Feedback mit Erklärung), MC, Wortbank, Freitext, Sonderzeichen-Leiste, Tastatursteuerung |
| M5 | **Grammatik-Typ Suffix-Builder** | Lösung wird von der Engine erzeugt/validiert (nicht nur aus YAML gelesen); Hint aus Engine-Begründung (hell/dunkel, gerundet) |
| M6 | **Persistenz + Tagesziel** | Dexie-Schema (Versionierung/Migrationen von Anfang an), Fortschrittsbalken pro Unit, Tagesziel, Streak (abschaltbar), Hell/Dunkel, i18n-Schlüssel |
| M7 | **Inhalte A1-01, A1-02 + PWA + E2E** | Zwei Units, Service Worker/Offline, Playwright-Smoke über komplette Lektion; Review-Ansicht + "Fehler melden" |

Kritischer Pfad: M1 → M3 → M5. M2 kann parallel zu M3 laufen, M0 vor allem anderen.

### Phasen 2–4
Wie SPEC 11. Pro Phase wiederholt sich: neue Übungstypen (jeweils Engine-Funktion + Komponente + Test) → Content-Batch → Review → Release. Phase 2 startet mit SRS (SM-2 oder Leitner; Empfehlung **Leitner vereinfacht**, später austauschbar hinter Interface), da alles Weitere (Schwächen üben, Nachschlagewerk) darauf aufbaut.

**Stand Phase 2:** SRS umgesetzt (Leitner hinter `Scheduler`, Karten für Grammatikübungen, Fehler und Vokabeln, Screen „Wiederholen“; Details in `CLAUDE.md`). Nachschlagewerk umgesetzt (Index im Build, Suche in beiden Richtungen mit Rückführung gebeugter Formen, Formtabellen, SRS-Stand; Details in `CLAUDE.md`). Audio in Arbeit: Kern umgesetzt (Sprachausgabe hinter `Speaker`, Web Speech `tr-TR`, austauschbare Quelle, Übungstyp `listen` mit im Build erzeugter Hörlektion je Unit; Details in `CLAUDE.md`), Audio-UI (Knöpfe, Autoplay, Einstellungen) und Hörübungen in der App umgesetzt und reviewt. Wörter zerlegen und Satzbau (SOV) umgesetzt: Lektionen `-z1`/`-s1` je Unit im Build erzeugt, Zerlegung aus der Engine, Satzglieder aus annotierten Wortbank-Sätzen (92 Sätze, `reviewed: false`); Details in `CLAUDE.md`. Damit sind alle Punkte von Phase 2 laut SPEC 11 umgesetzt; Phase 2 abgeschlossen. Später: Nachschlagewerk als Overlay während einer Lektion.

**Stand Phase 3:** A2 fertig (aus Phase 2). Export/Import des Fortschritts als versioniertes JSON (Zusammenführen/Ersetzen, kein Server) umgesetzt und reviewt. Dezente Statistik (Wörter je Box, Fälligkeit, schwierige Wörter/Übungen, Unit-Übersicht; keine Punkte oder Vergleiche). Lesetexte: je A2-Unit ein eigener Text (`<unit>-r1`, Claude-Entwurf, Opus-gegengeprüft, `reviewed: false`), jedes Wort antippbar über Build-Auflösung. Sprechübung als Nachsprechen ohne Erkennung (Aufnahme bleibt im Speicher, Vergleich mit der Sprachausgabe); Web Speech Recognition bewusst nicht, weil sie in Chrome und Safari meist über Server läuft und offline nicht geht – Prüfung frühestens in Phase 4. Details in `CLAUDE.md`. Opus-Review der UI (Statistik, Lesen, Nachsprechen) erledigt, Zweifelsfälle in den Lesetexten vom Nutzer entschieden; Phase 3 abgeschlossen.

**Stand Phase 4:** Start mit B1 (Engine-Erweiterungen und Units laut `docs/CURRICULUM.md`; Plan: 10 Units, Meilensteine E1 Engine finite Formen → E2 infinite Formen → U1 UI → C1–C3 Inhalte). E1 umgesetzt: Konditional, Optativ, idi/imiş/ise an Zeitformen. E2 umgesetzt: Partizipien, Verbalnomen, Konverbien (`nonfinite.ts`). U1 umgesetzt: Nachschlage-Tabellen für Verben. Alle drei reviewt. C1 umgesetzt: b1-u01 bis u03 (Claude-Entwurf, `reviewed: false`, Opus-gegengeprüft). C2 umgesetzt: b1-u04 bis u06. C3 umgesetzt: b1-u07 bis u10 (Partizipien, Konverbien, indirekte Rede). B1 fertig, alle drei Inhaltspakete gegengeprüft (Opus) und eingearbeitet. Sync vorerst zurückgestellt (kein Server, Sicherung als Datei reicht). Einstufungstest in Arbeit (Plan: P1 Auswahl und Ablauf → P2 Daten → P3 UI und E2E, je mit Opus-Review): P1 umgesetzt (Aufgaben aus vorhandenen Übungen im Build, Ablauf A1 → A2 → B1 mit Abbruch, Empfehlung; Details in `CLAUDE.md`); P2 umgesetzt (Dexie v4 `placements`, Sicherung, Statistik; Test schreibt keine Versuche/Abschlüsse/Karten). P3 umgesetzt (PlacementScreen, Home-Angebot und Marken, Einstellungen, E2E), Opus-Review eingearbeitet; damit ist der Einstufungstest fertig.

## 4. Modellwahl pro Entwicklungsphase

Prinzip: stärkstes Modell dort, wo Fehler teuer und schwer zu finden sind (Architektur, Linguistik-Regeln, Review); günstigeres Modell für Masse und Routine.

| Phase / Aufgabe | Modell | Begründung |
|---|---|---|
| Architektur, Schema-Design (M1), Engine-Design (M3, Regelmodell, Ausnahmen) | **Opus 5.5** (hoher Effort, Plan-Modus) | Weitreichende Entscheidungen; Fehler hier ziehen sich durch alles |
| Engine-Implementierung + Tests (M2, M3), SRS-Algorithmus | **Opus 5.5** | Subtile Linguistik-Edge-Cases (Harmonie, Softening, Ausnahmen) |
| Gerüst, CI, Config (M0) | **Sonnet 5.5** | Standardarbeit |
| UI-Komponenten, Runner, Übungstypen, Dexie, PWA (M4–M7) | **Sonnet 5.5** | Gutes Preis-Leistungs-Verhältnis für Feature-Code |
| Playwright-E2E, Testausbau | **Sonnet 5.5** | Routine mit klaren Vorgaben |
| Content-Entwurf (Units, Erklärkarten, Dialoge, kontrastive Erklärungen) | **Opus 5.5** | Sprachqualität und didaktische Güte; Ergebnis bleibt `reviewed: false` |
| Content-Gegenprüfung: Türkisch-Korrektheit des Entwurfs (Grammatik, Glossen, Alternativen) | **Opus 5.5**, frische Session ohne Entwurfskontext, mit Prüfcheckliste; zusätzlich Engine-Abgleich der Suffixformen | Kein zweites Modell verfügbar, daher Unabhängigkeit über neue Session, Checkliste und deterministische Engine; senkt Fehlerquote vor dem menschlichen Review |
| Bulk-Mechanik: Vokabel-Glossen formatieren, YAML-Skelette, i18n-Keys, Tatoeba-/Frequenz-Import-Skripte (Filterlogik), Typo-/Format-Fixes | **Haiku 5.5** (Skripte ggf. Sonnet) | Hohe Menge, geringe Komplexität, durch Schema-Validator abgesichert |
| Code-Review pro Meilenstein, Sicherheits-/Lizenzcheck (Attribution Tatoeba/Wikibooks) | **Opus 5.5** | Gründlichkeit; Review-Modell sollte nicht das Schreib-Modell des Codes sein |

Regeln:
- **Autor ≠ Reviewer**: Wer Code oder Content schreibt, prüft ihn nicht allein. Ohne zweites Spitzenmodell heißt das: Opus-Review in frischer Session (Code von Sonnet) bzw. Mensch + Engine/Tests (Opus-Content).
- Eskalieren statt Zeit verbrennen: schlägt Sonnet bei einer Aufgabe zweimal fehl, an Opus geben.
- Claude Code: pro Meilenstein eigene Session, Plan-Modus für M1/M3, danach Ausführung mit kleinerem Modell nach dem Plan.

## 5. Arbeitsweise pro Meilenstein

1. Plan-Modus: Ziel, Dateien, Testfälle skizzieren (Opus bei M1/M3, sonst Sonnet).
2. Tests zuerst (Engine, Antwortprüfung), dann Implementierung.
3. Implementierung in kleinen Commits.
4. Verifikation: `lint`, `typecheck`, `test`, `build`, bei UI zusätzlich manuell im Browser / Playwright.
5. Review durch anderes Modell (siehe Regel oben), dann Merge.
6. `CLAUDE.md` pflegen: Befehle, Konventionen (`toLocaleLowerCase('tr')` Pflicht, kein `toLowerCase()`; Lint-Regel dafür), Content-Regeln.

## 6. Content-Workflow

1. Pipeline-Skripte (`tools/`) liefern Kandidaten (Frequenz, Tatoeba) mit `source`/`license`/Autor/ID.
2. Opus entwirft Unit-YAML → Schema-Validator → Opus-Gegenprüfung (frische Session) → Nutzer-Review in der App (`reviewed: true` nur manuell).
3. Lizenz-Datei im Repo (`LICENSES.md`/`ATTRIBUTION.md`): Wikibooks/Wiktionary/FrequencyWords sind CC BY-SA, die abgeleiteten Inhalte also unter gleicher Lizenz weitergeben; Tatoeba CC BY 2.0 FR mit Autorennennung.
4. Keine Inhalte von Duolingo/Babbel/Lehrbüchern übernehmen (SPEC 7.1).

## 7. Risiken

| Risiko | Gegenmaßnahme |
|---|---|
| Falsches Türkisch in KI-Inhalten | `reviewed:false`, Zweitmodell-Check, Review-Ansicht, Engine als Plausibilitätsprüfung der Suffixformen |
| Morphologie-Ausnahmen explodieren | Ausnahmeliste in Daten, Engine bleibt regelbasiert und klein; Tests pro Ausnahmeklasse |
| Scope Creep Richtung Gamification/Features | Phase-Gates; UX-Prinzipien aus SPEC 2 als Abnahmekriterium |
| Dexie-Schema später inkompatibel | Versionierte Migrationen ab M6, Export/Import früh mitdenken |
| Lizenzfehler (SA-Pflicht) | Attribution-Feld im Schema Pflicht, Build-Check |
| Offline-Cache veraltet | Versionierte Content-Bundles, Service-Worker-Update-Hinweis |

## 8. Nächster Schritt

M0 und M1 beginnen: Gerüst anlegen, dann Schema im Plan-Modus mit Opus 5.5 entwerfen. Vorher die Defaults aus Abschnitt 2 bestätigen oder ändern.
