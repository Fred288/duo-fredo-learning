# SPEC: Türkisch lernen (Deutsch → Türkisch) – persönliche Lern-Web-App

Arbeitstitel: **Yol** (türk. "Weg"). Privates Projekt für einen einzelnen Nutzer, kein Multi-User, kein Social.

## 1. Vision

Eine Web-App (PWA, mobile-first, offlinefähig) zum Türkischlernen für Deutschsprachige.
Sie übernimmt das Gute an Duolingo und Babbel (kurze Lektionen, sofortiges Feedback,
Wiederholung), ergänzt aber das, was dort fehlt: **systematisches Training der
grammatischen Zusammensetzung** (Suffixe, Vokalharmonie, Satzbau). Türkisch ist
agglutinierend; wer nur Sätze auswendig lernt, versteht das System nicht.

### Zielgruppe und Niveaus
- Einstieg: Anfänger (A1), Ausbau bis B2 (Reihenfolge der Entwicklung: A1 → A2 → B1 → B2).
- Sprachrichtung: UI und Erklärungen auf Deutsch, Lernsprache Türkisch.
- Niveaus entsprechen dem GER (CEFR). Jede Unit trägt ein Niveau-Tag.

### Abgrenzung zu Duolingo
- Explizite Grammatik-Module mit Regelerklärung **und** Baukasten-Übungen.
- Erklärungen kontrastiv Türkisch/Deutsch (z. B. kein Artikel, kein Genus, Fälle über Suffixe, SOV).
- Nutzer kann Lektionen und Wortschatz frei durchsuchen, nicht nur dem Pfad folgen.

## 2. UX-Prinzipien

- Ruhig und fokussiert. **Keine** aufwendige Gamification, keine Belohnungsanimationen,
  keine Ligen, keine Social-Funktionen, kein Herzen-System.
- Erlaubt und gewünscht: Fortschrittsbalken pro Unit, Tagesziel (Minuten oder Lektionen),
  ein dezenter Streak-Zähler (abschaltbar), sofortiges Richtig/Falsch-Feedback mit Erklärung.
- Freie Navigation: Der Pfad ist eine Empfehlung. Alle Units sind jederzeit anwählbar
  (Einstufungstest optional, später).
- Hell/Dunkel-Modus, große Touch-Ziele, Tastatursteuerung am Desktop.
- UI-Sprache Deutsch, für spätere Übersetzung vorbereitet (i18n-Schlüssel statt Hardcoding).

## 3. Funktionale Anforderungen

### 3.1 Struktur
Kurs → Niveau (A1…B2) → Unit → Lektion → Übungen. Jede Unit hat:
1. optionale **Erklärkarte** (Grammatik/Kultur, kurz, mit Tabellen und Beispielen)
2. Vokabel-Lektion(en)
3. **Grammatik-Lektion(en)** (siehe 3.2)
4. Dialog- oder Lesetext (ab A2)
5. Wiederholungslektion (gemischt aus früheren Units)

### 3.2 Grammatik-Baukasten (Kern-Differenzierung)
Eigene Übungstypen, die im Code **regelbasiert** unterstützt werden:

- **Suffix-Builder**: Wortstamm + Suffix-Bausteine in die richtige Reihenfolge und
  Form bringen (Beispiel: `ev` + Plural + Lokativ → `evlerde`).
- **Vokalharmonie-Trainer**: Welche Form passt (`-ler/-lar`, `-de/-da`, `-i/-ı/-u/-ü`)?
  Mit Rückmeldung, *warum* (letzter Vokal hell/dunkel, gerundet/ungerundet).
- **Konsonantenwechsel**: Auslautverhärtung und -erweichung (`kitap` → `kitabı`),
  Assimilation (`-de` → `-te` nach stimmlosem Konsonant), Pufferlaute (y, n, s).
- **Wort zerlegen** (Segmentierung): `evlerimizden` in Stamm und Suffixe aufteilen und
  jedem Suffix die Funktion zuordnen (Plural, Possessiv 1. Pl., Ablativ).
- **Satzbau-Puzzle (SOV)**: Satzglieder in türkische Reihenfolge ziehen; Verb am Ende.
- **Kasus-Zuordnung**: Deutsche Präposition/Kasus ↔ türkisches Suffix (Dativ -e, Akkusativ -i,
  Lokativ -de, Ablativ -den, Genitiv -in).
- **Satz transformieren**: Aussage → Frage (mi/mı/mu/mü), Aussage → Verneinung (-me/-ma),
  Zeitformwechsel, Personenwechsel.
- **Fehler finden**: Satz mit einem Grammatikfehler, Nutzer markiert und korrigiert.

Wichtig: Eine kleine **Morphologie-Engine** (`src/morphology/`) implementiert die Regeln
deterministisch (Vokalharmonie, Konsonantenwechsel, Pufferlaute, Suffixreihenfolge).
Sie dient (a) zum Erzeugen und Validieren der Lösungen in Grammatikübungen und
(b) als Testbasis (Unit-Tests mit Beispielen: `ev→evler→evlerde`, `kitap→kitabı`,
`okul→okulda`, `göz→gözler`). Ausnahmen (z. B. Lehnwörter wie `saat → saati`,
Wörter mit "falschem" Harmonievokal) laufen über eine Ausnahmeliste in den Daten.

### 3.3 Allgemeine Übungstypen
Multiple Choice, Wortbank-Übersetzung (Bausteine antippen), Freitext-Übersetzung (tolerant),
Zuordnungspaare, Lückentext, Hörverständnis (Audio → Wort/Satz), Diktat (Audio → tippen),
Lesetext mit Verständnisfragen (ab A2), Sprechübung (optional, Web Speech API `tr-TR`).

### 3.4 Wiederholung
- Spaced Repetition (SM-2 oder vereinfachtes Leitner) für Vokabeln **und** für
  Grammatik-Items (z. B. einzelne Suffixregeln).
- Modus "Schwächen üben": automatisch aus Fehlerhistorie.
- Vokabel- und Grammatik-Nachschlagewerk mit Suche (Türkisch und Deutsch, auch Flexionsformen).

### 3.5 Türkisch-spezifische Details
- Sonderzeichen-Leiste (ç ğ ı İ ö ş ü) für Eingabefelder.
- Groß/Kleinschreibung nur mit `toLocaleLowerCase('tr')` / `toLocaleUpperCase('tr')`
  (`I`↔`ı`, `İ`↔`i`). Niemals `toLowerCase()` für türkischen Text.
- Normalisierung beim Vergleich: Unicode NFC; Option "Sonderzeichen tolerieren"
  (z. B. `s` statt `ş`) mit Hinweis statt Fehler.
- Akzeptierte Alternativen: pro Aufgabe mehrere gültige Lösungen; Satzzeichen und
  Groß/Klein tolerant; Tippfehler (Levenshtein ≤ 1 bei längeren Wörtern) als "fast richtig".
- Formelles "siz" vs. informelles "sen" konsistent kennzeichnen.

### 3.6 Fortschritt und Daten
- Alles lokal (IndexedDB, z. B. Dexie). Kein Account.
- Export/Import des Fortschritts als JSON (Backup, Gerätewechsel).
- Optional später: Sync über eigenen kleinen Backend-Dienst (SQLite) oder Dateiexport.

## 4. Nicht-funktionale Anforderungen

- PWA: installierbar, offline nutzbar (Service Worker, Inhalte vorab cachen).
- Performance: Start unter 2 s auf Mittelklasse-Handy; Lektionsdaten lazy laden.
- Barrierefreiheit: Kontrast, Fokus-Reihenfolge, Screenreader-Labels, Audio immer mit Text.
- **Inhalte strikt vom Code getrennt** (`/content/*.yaml` oder `.json`) mit Schema-Validierung
  (Zod/JSON-Schema) im Build. Ungültige Inhalte brechen den Build.
- Tests: Unit-Tests für Morphologie-Engine und Antwortprüfung (Pflicht),
  Playwright-Smoke-Test für eine komplette Lektion.

## 5. Tech-Stack (Vorschlag, bitte befolgen)

- React + Vite + TypeScript, Tailwind, Zustand für UI-State
- Dexie (IndexedDB) für Fortschritt, vite-plugin-pwa
- Vitest (Unit), Playwright (E2E)
- Audio: vorgenerierte MP3 pro Wort/Satz (siehe 7.4), Fallback Web Speech API
- Hosting: statisch (GitHub Pages oder Vercel)

## 6. Datenmodell (Beispiele, vereinfacht)

```yaml
# content/a1/u03-ortsangaben.yaml
id: a1-u03
level: A1
title: Orte und Richtungen
grammar_focus: [lokativ, ablativ, dativ]
explainer: explainers/a1-lokativ.md
lessons:
  - id: a1-u03-l1
    type: grammar
    exercises:
      - type: suffix_builder
        stem: ev
        target: evde
        parts: [ev, -de]
        gloss_de: "im Haus"
        hint: "Letzter Vokal e = hell → -de"
      - type: segment
        word: evlerimizden
        segments:
          - { text: ev,   role: Stamm }
          - { text: ler,  role: Plural }
          - { text: imiz, role: "Possessiv 1. Pl." }
          - { text: den,  role: Ablativ }
        gloss_de: "aus unseren Häusern"
      - type: sov_puzzle
        gloss_de: "Ich trinke Tee."
        tokens: [Ben, çay, içiyorum]
        order: [Ben, çay, içiyorum]
vocab:
  - { tr: ev, de: [Haus, Wohnung], pos: noun, tags: [wohnen], audio: ev.mp3, source: "..." }
  - { tr: kitap, de: [Buch], pos: noun, harmony_exception: false, softens: true }
```

Jeder Datensatz trägt `source` und `license`, damit Herkunft und Namensnennung nachvollziehbar bleiben.

## 7. Lerninhalte und Quellen

### 7.1 Grundsatz
Keine Texte, Lektionen, Bilder oder Audios von Duolingo, Babbel oder kommerziellen
Lehrbüchern kopieren. Mechaniken und Übungstypen sind frei nachbaubar, konkrete Inhalte nicht.
Kommerzielle Lehrbücher dienen **nur als didaktische Orientierung** für Reihenfolge und
Themen (z. B. GER-Niveaustufen), nicht als Textquelle. Eigene Formulierungen verwenden.

### 7.2 Offene Quellen (vor Nutzung Lizenz prüfen und im Repo dokumentieren)

| Quelle | Nutzen | Lizenz / Hinweis |
|---|---|---|
| Wikibooks "Türkisch" (de.wikibooks.org/wiki/Türkisch) | Grammatikkapitel (u. a. Vokalharmonie, Konjugation, Zeitformen), Wortlisten Tr↔De, Kurs "Theo und Ümit" für Alltagsdialoge | Wikibooks-Inhalte, i. d. R. CC BY-SA: Lizenz der Einzelseite prüfen, Namensnennung und Weitergabe unter gleicher Lizenz beachten. Buch ist laut eigener Angabe etwa zur Hälfte fertig, also Lücken und mögliche Fehler einplanen. |
| Wikibooks "Turkish" (en.wikibooks.org/wiki/Turkish) | Englischsprachiger Lehrgang mit Lektionen und Grammatik-Referenz, nützlich als zweite Struktur-Referenz | wie oben |
| Tatoeba (tatoeba.org/downloads) | Satzpaare Türkisch↔Deutsch (Satzpaar-Export je Sprachpaar) für Übersetzungs-, Lücken- und Hörübungen | CC BY 2.0 FR, Namensnennung des Autors Pflicht; Satz-IDs und Autoren mitführen. Qualität schwankt, Sätze vor Aufnahme kuratieren. |
| Wiktionary-Extrakte (kaikki.org, Türkisch) | Lemmata, Wortarten, Flexionsformen, IPA, Audio-Verweise | CC BY-SA. Glossen dort überwiegend englisch, deutsche Übersetzungen müssen ergänzt oder aus Tatoeba/Wikibooks-Wortlisten abgeleitet werden. |
| FrequencyWords (github.com/hermitdave/FrequencyWords), Türkisch | Häufigkeitsliste (aus Untertiteln) zur Priorisierung des Wortschatzes | Inhalt CC BY-SA 4.0. Untertitelsprache ist umgangssprachlich, für Schriftsprache ergänzend prüfen. |
| FMHY (fmhy.net/educational, Abschnitt Language Learning) | Linksammlung, siehe 7.3 | Nur Verweise, jeweilige Lizenz je Ziel prüfen. |

### 7.3 Aus FMHY relevant für Struktur und Methodik (keine Türkisch-spezifischen Treffer gefunden)
Die Sammlung listet sprachübergreifend u. a.: Language Transfer (Methodik: Selbst-Entdecken von
Regeln), FSI Language Courses (Struktur klassischer Kurse), clozemaster (Lückentext im Kontext),
50languages (Zweisprachige Phrasen mit Audio, Lizenz vor Nutzung klären), Omniglot
(Schriftsystem und Sprachübersichten), Refold (Lernpfad-Methodik), Wörterbücher wie
WordReference, dict.cc, Glosbe und WikDict (nur als Nachschlage-Referenz, nicht scrapen).
Diese dienen als **Inspiration für Didaktik**, nicht als Datenquelle.

### 7.4 Audio
Reihenfolge der Präferenz: (1) eigene oder von Muttersprachlern geprüfte Aufnahmen,
(2) Tatoeba-/Wiktionary-/Forvo-Audio mit passender Lizenz, (3) TTS (tr-TR) als Fallback,
klar als "synthetisch" im Datenmodell markieren. Dateien pro Wort/Satz als MP3, Namensschema = Daten-ID.

### 7.5 Didaktische Referenz (nur Orientierung für Aufbau, nicht kopieren)
Gängige Lehrwerke nutzen für A1–B2 folgende Reihenfolge, die als Gerüst dient:
Alphabet/Aussprache → Vokalharmonie und Suffixbildung → Substantiv (Plural, Fälle, Possessiv) →
Adjektiv/Adverb → Pronomen → Verb (Präsens, Vergangenheit, Zukunft, Negation, Frage) →
Satzbau und Nebensätze (Partizipien und Verbalnomen statt deutscher Nebensatzkonjunktionen).
Hilfreich als Gliederungsbeispiele: Landmann "Türkisch. Grammatisches Lehrbuch" (A1–B2,
84 kurze Lektionen), Ersen-Rasch "Türkische Grammatik" und "Übungsgrammatik" (A1–C2/C1,
kontrastiv Türkisch–Deutsch), Hueber "Kurzgrammatik Türkisch". Der Nutzer kann Inhaltsverzeichnisse
oder eigene Notizen daraus bei Bedarf nachreichen.

## 8. Curriculum-Gerüst (Startvorschlag, anpassbar)

**A1**: Alphabet und Aussprache, Vokalharmonie, Begrüßung, "sein" (Kopula -im/-sin/-dir),
Plural, Zahlen, Familie, Essen und Trinken, Lokativ/Ablativ/Dativ, Akkusativ, Possessiv,
Präsens (-iyor), Fragepartikel mi, Negation, Uhrzeit, Alltag.
**A2**: Vergangenheit (-di, -miş), Zukunft (-ecek), Aorist, Modalität (-ebil, -meli),
Komparation, Imperativ, Reflexiv/Passiv (Basis), Postpositionen, Reise, Einkauf, Gesundheit.
**B1**: Partizipien und Verbalnomen (-dik, -ecek, -en), Relativsätze, Konditional (-se),
Konverbien (-ip, -erek, -ince), Wunschformen, indirekte Rede, Texte zu Alltag und Kultur.
**B2**: Komplexe Nebensatzstrukturen, Kausativ und Passiv vertieft, Idiomatik,
formelle und schriftliche Register, längere Lesetexte, Hörverständnis.

## 9. Content-Pipeline

1. Skript `tools/build_vocab.ts`: Frequenzliste + Wiktionary/Wortlisten → Kandidatenliste je Niveau.
2. Skript `tools/import_tatoeba.ts`: Satzpaare filtern (Länge, Wortschatz bekannt), Autor und ID speichern.
3. Inhalte werden als YAML/JSON erzeugt (auch durch Claude), **müssen als `reviewed: false`
   markiert bleiben**, bis ein Muttersprachler oder der Nutzer sie geprüft hat.
4. Build-Schritt prüft Schema, doppelte IDs, fehlende Audios, nicht freigegebene Inhalte (Warnung).

## 10. Qualitätssicherung

- Alle türkischen Texte aus Claude-Generierung gelten als ungeprüft (`reviewed: false`).
- Grammatikregeln im Code per Unit-Test absichern.
- Review-Ansicht in der App: Inhalte mit "Fehler melden"-Button (lokal als Notiz speichern).

## 11. Phasenplan

**Phase 1 (MVP)**: Projektgerüst, Datenschema, Morphologie-Engine + Tests, Unit A1-01 (Alphabet,
Begrüßung) und A1-02 (Vokalharmonie und Plural), Übungstypen: Multiple Choice, Wortbank,
Freitext, Suffix-Builder, lokale Speicherung, Tagesziel, PWA-Grundlagen.
**Phase 2**: Restliches A1, Wiederholungssystem (SRS), Nachschlagewerk, Audio, Hörübungen,
Segmentierungs- und SOV-Übungen.
**Phase 3**: A2, Lesetexte, Sprechübung, Export/Import, Statistik (dezent).
**Phase 4**: B1/B2, Einstufungstest, optionaler Sync.

## 12. Offene Punkte für den Nutzer

- Namensentscheidung (Arbeitstitel "Yol").
- Dialekt/Register-Fokus (Standardtürkisch Istanbul/TRT, Alltag vs. formell).
- Bevorzugte Audio-Strategie (TTS-Dienst, eigene Aufnahmen).
- Weitere Referenzmaterialien (Lehrbuch-Inhaltsverzeichnisse, Notizen) werden nachgereicht.
