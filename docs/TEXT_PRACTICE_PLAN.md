# Erweiterungsplan: Übungstexte nach der Lektion

Stand: 2026-11-05. T1 umgesetzt (Schema, Build-Prüfung, Auswahl, Einstellung `practiceRecent`, ein Beispieltext `a1-u02-t1`); T2–T6 offen.

## Ziel

Nach jeder abgeschlossenen Lektion bietet der Abschlussbildschirm einen kurzen Text an. Der
Text passt zum Niveau und benutzt nur, was bis zur aktuellen Unit gelernt wurde. Man kann ihn
lesen oder Satz für Satz übersetzen.

Entscheidungen des Nutzers (2026-11-05):

- **Quelle:** neue Kurztexte, 2–3 je Unit, auch für A1. Claude-Entwurf, `reviewed: false`.
- **Zeitpunkt:** Angebot auf dem Abschlussbildschirm („Einen Text lesen“), kein Zwang.
- **Prüfung:** selbst vergleichen. Eigene Übersetzung eingeben (optional), dann die Referenz
  ansehen und selbst „Passt“ oder „Daneben“ wählen. Es gibt keine automatische Bewertung.
- **Zählen:** gar nicht. Kein Tagesziel, keine SRS-Karten, keine Statistik, kein `attempts`.

## Was schon da ist und genutzt wird

- **Lesetexte** (`passage` in `reading`-Lektionen): Sätze tr/de, `glossary`, Build-Auflösung
  über `annotatePassage` → `tokens`, Anzeige `ReadingPassage` (antippbare Wörter, Sheet,
  „Übersetzung zeigen“, Vorlesen, Nachsprechen). Die neuen Texte nutzen dieselbe Form und
  dieselbe Anzeige.
- **Abschlussbildschirm:** `LessonRunner` (`done.title`, „Nochmal“, „Zur Übersicht“).
- **Muster für Fokusbereiche:** `flashcards-run`, `mistakes`.

## Daten (T1)

Neues Feld in der Unit-YAML, getrennt von den Lektionen (die IDs der Lektionen bleiben
unberührt):

```yaml
texts:
  - id: a1-u03-t1        # stabil, <unit>-t<n>
    title: Beim Bäcker   # deutsch, kurz
    sentences:
      - { tr: "…", de: "…" }
    glossary: []          # wie bei passage, nur für Namen u. Ä.
    reviewed: false
```

- Schema: `PracticeText` (strict) mit `id`, `title`, `sentences`, `glossary?`, `reviewed`. Der
  Build schreibt `tokens` dazu (wie `passage.tokens`).
- **Länge je Niveau** (Build-Warnung außerhalb): A1 3–5 Sätze, A2 5–7, B1 6–9, B2 8–12.
- **Nur Bekanntes** (Build-Fehler, nicht Warnung): Jedes Wort muss sich auflösen lassen
  (Glossar, Vokabel, Engine-Form). Die Vokabel muss aus dieser Unit oder einer früheren stammen.
  Glossar nur für Namen und Ausnahmen, die der Lesetext auch zulässt.
- `countUnreviewed` zählt die Texte mit.
- Manifest: je Unit `texts: [{ id, title }]`; die Sätze selbst bleiben in der Unit-JSON.
- Snapshot-Test über die echten Inhalte: jede Text-ID, Unit, Satzzahl.

## Auswahl (T1, rein)

`pickText(manifest, unitId, recent, rand)` in `src/practice/pick.ts`:

- Kandidaten sind die Texte der aktuellen Unit und der zwei Units davor, nur im selben Niveau.
- Die zuletzt gelesenen Texte (`recent`, höchstens 5) kommen nur dann dran, wenn sonst nichts
  übrig ist.
- Der Zufall wird hineingereicht.
- `recent` liegt in den Einstellungen (`practiceRecent`). Das ist keine Wertung, nur gegen
  Wiederholung. Es wird beim Zusammenführen einer Sicherung nicht übertragen (wie andere
  Einstellungen).

## Ansicht (T2)

Neuer Fokusbereich `text-practice` (`openTextPractice(unitId, textId?)`):

1. **Kopf:** Titel, Niveau, „Lesen | Übersetzen“ als Umschalter (Einstellung `practiceMode`).
2. **Lesen:** `ReadingPassage` mit dem ganzen Text (antippbar, Übersetzung zeigen, Vorlesen,
   Nachsprechen). Darunter „Fertig“ und „Anderer Text“.
3. **Übersetzen:** Satz für Satz, „Satz 2 von 5“.
   - Oben steht der türkische Satz (antippbar, Vorlesen).
   - Darunter ein Textfeld „Deine Übersetzung“ (optional) und der Knopf „Vergleichen“.
   - Dann erscheinen die Referenz und die Knöpfe „Passt“ und „Daneben“, beide führen weiter.
   - Am Ende kommt eine kurze Übersicht: Sätze, die mit „Daneben“ markiert wurden, mit
     Referenz, dazu „Diese nochmal“, „Anderer Text“ und „Fertig“. Der Stand bleibt nur im
     Speicher.
4. **Tasten:** Enter = Vergleichen bzw. Passt, wie bei den Karteikarten. Keine Tasten, solange
   das Wort-Sheet offen ist (`ownsKeys`).

Einstiege:

- **Abschlussbildschirm:** Knopf „Einen Text lesen“ unter „Nochmal“. Er erscheint nur, wenn
  `pickText` einen Text findet, und nicht im Wiederholen, bei „Fehler wiederholen“, in der
  Einstufung oder in Hörlektionen.
- **Unit-Seite:** Abschnitt „Texte (n)“ mit Liste, damit man gezielt einen Text wählen kann.

i18n-Schlüssel unter `practice.*`. E2E `e2e/practice.spec.ts`:

- Lektion spielen, dann Angebot, Lesen und Übersetzen bis zur Übersicht.
- Nach dem Text keine neuen `attempts`, `completions` oder `cards`.
- axe in `a11y.spec.ts`.

## Inhalte (T3–T6)

Je Niveau ein Paket. Ablauf wie bei den Units:

1. Opus schreibt den Entwurf.
2. Der Build prüft „nur Bekanntes“.
3. Opus prüft gegen, in einer frischen Session mit Checkliste.
4. Der Nutzer entscheidet die Zweifelsfälle.

| Paket | Units | Texte |
|---|---|---|
| T3 | A1 (12) | 2 je Unit, ca. 24 |
| T4 | A2 (10) | 2–3 je Unit, ca. 25 |
| T5 | B1 (10) | 2–3 je Unit, ca. 25 |
| T6 | B2 (10) | 2–3 je Unit, ca. 25 |

Regeln für die Texte:

- Alltagsszenen, die zum Thema der Unit passen.
- Keine Übernahme aus Büchern (`docs/REFERENCES.md`).
- Keine Sätze, die wörtlich aus den Übungen der Unit stammen; der Text soll Neues zu lesen
  geben.
- Die Grammatik der Unit kommt im Text vor.

## Modellwahl

T1 (Schema, Build-Prüfung, Auswahl) und T2 (UI) gehen mit Sonnet oder Opus. T3–T6 (Türkisch)
nur mit Opus, die Gegenprüfung jeweils in einer neuen Session.

## Offene Punkte

- Sollen die vorhandenen Lesetexte (`-r1`) zusätzlich in die Auswahl? Sie sind länger und
  stehen schon als Lektion da. Vorschlag: nein.
- Gibt es ein Angebot auch nach dem Wiederholen? Vorschlag: nein, nur nach Kurslektionen.
