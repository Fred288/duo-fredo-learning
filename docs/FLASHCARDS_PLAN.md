# Erweiterungsplan: Karteikarten

Stand: 2026-11-04. K1 umgesetzt (1057 Wörter je Lektion zugeordnet, 212 Satzkarten), K2 umgesetzt (Dexie v5, Stapel, Runde, Sicherung), K3 umgesetzt (Auswahl, Runde, Rückseite, Einstiege); K4 umgesetzt (Zusammenfassung in der Auswahl, Statistik-Abschnitt); K5–K6 offen. Abweichungen in K3: ein Knopf je Unit statt je Lektion (die Lektion wählt man in der Auswahl), kein Sprung ins Nachschlagen aus der Runde, antippbare Wörter in Satzkarten erst mit K5; Markieren und der Falsch-Stapel sind schon bedienbar. Offene Entscheidungen stehen am Ende.

## Ziel

Ein eigener Karteikasten. Er sammelt je Lektion die neuen Wörter und fragt sie wahlweise
Türkisch → Deutsch oder Deutsch → Türkisch ab. Jede Antwort wird als richtig oder falsch
gespeichert. Die falschen Karten lassen sich gesammelt noch einmal üben.

Vorbild für die Handhabung ist Repetico, ohne die App nachzubauen. Übernommen werden:

- Karte zeigen, umdrehen, selbst bewerten.
- Eine Runde läuft so lange, bis alle Karten gewusst sind; die nicht gewussten kommen am Ende
  noch einmal.
- Stapel lassen sich frei wählen.
- Schwierige Karten kann man markieren.

## Was schon da ist und genutzt wird

- **Vokabeln:** stehen je Unit in der YAML (`vocab:`), insgesamt 1057 in 42 Units (15–41 je
  Unit). Eine Zuordnung zur Lektion gibt es bisher nicht.
- **SRS:** Es gibt schon Vokabelkarten `vo:tr_de` und `vo:de_tr` im Leitner-System, über
  „Wiederholen“. Der Karteikasten ergänzt das. Er ist freies, selbstbestimmtes Üben und kein
  zweiter Planer.
- **Prüfung, Audio, Nachschlagen:** Antworten prüft `checkAnswer`, mit Tippfehlern und
  Sonderzeichen-Hinweisen. Dazu kommen `speak`/`SpeakButton`, `LookupEntry compact` (Formtabelle
  und Erklärkarte) sowie `vocabStatus` (Box und Fälligkeit).
- **Muster für „falsch gesammelt“:** `openMistakes` ist eine reine Funktion: Der letzte Versuch
  ist falsch, also gilt die Karte als offen. Genauso entsteht der Falsch-Stapel.

## Neue Wörter je Lektion

Vokabeln gehören heute zur Unit. Die Zuordnung zur Lektion leitet der Build ab, ohne neuen
türkischen Text:

1. Die Lektionen der Unit laufen in Reihenfolge durch.
2. Eine Vokabel gehört zur ersten Lektion, in der sie vorkommt. Dafür zählen Antworten,
   Optionen, Prompts, `text` und `passage.tokens`. Der Vergleich läuft über `exactKey` und für
   gebeugte Formen über `lemmatize`, so wie bei den Lesetexten.
3. Erzeugte Lektionen zählen nicht: Hören `-h1`, Zerlegen `-z1`, Satzbau `-s1`, Wiederholung
   `-r1`.
4. Was nirgends vorkommt, kommt zur ersten `vocab`-Lektion der Unit, sonst zur ersten Lektion.
   So geht kein Wort verloren.
5. Als Korrektur ist ein optionales Vokabel-Feld `lesson: a1-u03-l2` möglich. Der Build prüft,
   ob die Lektion existiert.

Der Build schreibt `lessons[].vocab` (Vokabel-IDs) ins Manifest. Ein Snapshot-Test über die
echten Inhalte hält die Zuordnung fest, wie es schon `tools/placement.test.ts` macht. Ändert sich
die Zuordnung, wird der Snapshot bewusst erneuert.

## Satzkarten: übliche Sätze je Lektion

Nutzerwunsch vom 2026-11-04, nach Bewertung aufgenommen.

**Bewertung: sinnvoll.** Fertige Sätze wie „Wie viel kostet das?“ → „Bu ne kadar?“ oder
„Mir geht es gut, danke.“ → „İyiyim, teşekkürler.“ braucht man im Alltag sofort, oft bevor
man die Grammatik dahinter kennt. Als Karte lernt man sie als Ganzes. Neuer türkischer Text ist
dafür nicht nötig, der Kurs enthält die Sätze schon:

- **Wortbank-Übungen:** Es gibt 680 Wortbank-Übungen. Jede hat einen deutschen Satz als
  `prompt` und den türkischen in `answers`, also schon ein fertiges Kartenpaar. Davon sind 195
  kurz (höchstens 6 Wörter) und stehen in Vokabel- oder Dialog-Lektionen.
- **Freitext-Übungen:** 151 `free_text`-Übungen der Richtung de→tr haben mehrwortige Antworten.
- **Wendungen im Wortschatz:** 39 Vokabeln mit `pos: phrase` sind ohnehin Wortkarten. Sie stehen
  im Satzstapel zusätzlich, nicht doppelt.

**Auswahl** (Build, reine Funktion `phraseCards` in `src/flashcards/phrases.ts`):

1. In Frage kommen Übungen der Typen `word_bank` und `free_text` (Richtung `de_tr`).
2. Sie müssen in Lektionen der Typen `vocab` und `dialog` stehen.
3. Die Antwort hat höchstens 7 Wörter.
4. Der Prompt ist ein deutscher Satz: keine Arbeitsanweisung wie „Übersetze …“, keine Lücke,
   keine Suffix-Notation.
5. Grammatik-, Lese- und erzeugte Lektionen bleiben draußen, weil dort Drillsätze stehen, keine
   Alltagssätze.
6. Doppelte Sätze werden über `exactKey` der ersten Antwort entfernt; das erste Vorkommen im Kurs
   gewinnt.
7. Die Karte gehört zur Lektion der Übung. Ihre ID ist `ph:<exerciseId>`, stabil wie die
   Übungs-IDs.
8. Beim Eintippen gelten alle `answers` als richtig, bei Wortbank-Übungen auch die `orders`.
9. Korrektur in der YAML: `card: false` an der Übung schließt einen Satz aus, `card: true` nimmt
   ihn trotz der Regeln auf. Der Build prüft, dass das Feld nur an `word_bank`/`free_text`
   steht.
10. Ein Snapshot-Test über die echten Inhalte hält die Auswahl fest. Ändert sie sich, wird der
    Snapshot bewusst erneuert.

**Bedienung:** Die Satzkarten sind ein eigener Stapel je Lektion: „Wörter (n)“ und „Sätze (m)“,
dazu „Beides“. Es gelten dieselben Richtungen, Modi, derselbe Falsch-Stapel und dieselben
Markierungen; `Flash` bekommt dafür `kind: 'vocab' | 'phrase'` und `ref` statt `vocabId`. Auf der
Rückseite stehen:

- der Satz, mit Vorlese-Knopf und Nachsprechen über `ShadowButton`,
- `hint`/`explanation` der Übung, falls vorhanden (zum Beispiel sen/siz),
- die enthaltenen Wörter als antippbare Wörter, wie im Lesetext (`tokenize` + `lemmatize`).

Bei de→tr im Modus „Eintippen“ wird großzügig bewertet: `checkAnswer` mit Tippfehlern;
Satzzeichen und Groß- und Kleinschreibung zählen nicht.

**Prüfstand:** Die Sätze erben `reviewed` von ihrer Übung. Ungeprüfte Sätze tragen wie bisher
die dezente Kennzeichnung.

**Grenze:** Manche Wortbank-Sätze sind eher Übungssätze als Alltagssätze. Die Regeln oben
filtern grob; den Rest korrigiert `card: false`, sobald es beim Üben auffällt (auch über
„Fehler melden“).

## Datenmodell

**Neue Tabelle:** Dexie `version(5)` bekommt `flashes: '++id, at, ref'`. Sie wird nur
angehängt. Eine Zeile sieht so aus:

```ts
interface Flash {
  kind: 'vocab' | 'phrase';
  ref: string; // vocabId bzw. exerciseId (`id` ist der Dexie-Schlüssel)
  dir: 'tr_de' | 'de_tr';
  correct: boolean;
  mode: 'flip' | 'type';
  at: number; // ms
}
```

**Markierte Karten:** Tabelle `flashMarks: 'key'`, mit `key = vocabId|dir` oder nur `vocabId`
(Entscheidung offen, Vorschlag: je Wort).

**Reine Funktionen** in `src/flashcards/`:

- `deckFor(selection, manifest)` stellt den Stapel aus Lektion, Unit, Niveau, „alles Gelernte“,
  „Falsche“ oder „Markierte“ zusammen.
- `openWrong(flashes)` liefert alle Karten, deren letzte Antwort falsch war.
- `lastResult(flashes, vocabId, dir)` liefert das Ergebnis der letzten Antwort einer Karte.
- `lessonFlashSummary` liefert je Lektion den Wert „zuletzt gewusst x von n“.

**Ablauf einer Runde:** eine reine Zustandsmaschine in `session.ts`, mit `startRound`,
`current`, `flip`, `grade` und `next`:

1. Die nicht gewussten Karten wandern ans Ende der Runde.
2. Die Runde endet erst, wenn jede Karte einmal gewusst wurde. Abbrechen geht jederzeit.
3. Gespeichert wird nur die erste Antwort je Karte und Runde, damit Wiederholungen in der Runde
   die Auswertung nicht schönen.

**Sicherung:** Beide Tabellen kommen in `TABLES`. Die Merge-Schlüssel sind
`kind|ref|dir|at|correct` und `key`. Dateien ohne die Felder lesen sich als leer,
`BACKUP_VERSION` bleibt 1. Das ist dasselbe Muster wie bei `placements`.

**Abgrenzung zum SRS (entschieden):** Karteikarten beeinflussen die Leitner-Boxen nicht. Freies
Pauken am Stück würde sonst die Abstände verfälschen, und eine Karte, die heute fünfmal gesehen
wurde, ist noch nicht gefestigt. Der Karteikasten liest das SRS nur, für den „Schwer“-Stapel.

## Bedienung

**Einstieg:**

- In der Unit-Ansicht bekommt jede Lektion einen Knopf „Karteikarten (n)“.
- „Heute“ bekommt eine Karte „Karteikasten“ mit der Zahl der falschen Karten, ohne Badge in der
  Navigation.
- „Mehr“ und die Seitenleiste bekommen einen Eintrag „Karteikasten“.

**Wahlbildschirm** `flashcards` (Navigationsbereich):

- Stapel: Lektion, Unit, Niveau, alles bisher Gelernte, Falsche, Markierte.
- Richtung: tr→de, de→tr oder gemischt.
- Modus: Aufdecken oder Eintippen.
- Reihenfolge: Kurs oder gemischt.
- Die zuletzt gewählten Einstellungen merkt sich die App über Einstellungen in `settings.ts`.

**Runde** `flashcards-run` (Fokusbereich, ohne Navigation):

- **Vorderseite:** das Wort, bei tr→de mit Vorlese-Knopf. Bei de→tr stehen alle deutschen
  Bedeutungen da, damit klar ist, welches Wort gemeint ist.
- **Aufdecken:** „Umdrehen“ mit Leertaste oder Tippen. Danach „Gewusst“ und „Nicht gewusst“,
  mit den Tasten → und ← oder 1 und 2. Wischen nach rechts und links ist optional und kommt erst
  später, weil Gesten mit Barrierefreiheit kollidieren.
- **Eintippen:** über `checkAnswer` mit Tippfehler-Toleranz, wie bei Vokabelübungen. „Fast
  richtig“ zählt als richtig, mit Hinweis.
- **Rückseite:** alle Bedeutungen und die Wortart, Hinweise aus den Engine-Flags (zum Beispiel
  „kitap → kitabı“ bei `softens`, „şehir → şehri“ bei `drops_vowel`). Dazu kommen der
  Vorlese-Knopf, „Markieren“ und „Im Nachschlagen öffnen“ (Formtabelle).
- **Fortschritt:** „Karte 7 von 20 · 3 noch einmal“, ohne Punkte und ohne Animationen.
- **Ende der Runde:** „15 sofort gewusst, 5 nach Wiederholung“. Danach „Nur die falschen
  nochmal“ und „Zurück“.

**Barrierefreiheit:** Die Karte ist ein Knopf mit `aria-pressed`. Die Rückseite wird über
`aria-live` angesagt. Mit `prefers-reduced-motion` gibt es keine Drehanimation, ohne die
Einstellung höchstens ein kurzes Überblenden. Glas, Tokens und Breiten folgen den bestehenden
Regeln, die Karte nutzt `card` ohne neues `backdrop-filter`.

## Weitere Ideen (mein Input)

Nach Nutzen sortiert:

1. **Satzkarten aus Kursinhalten.** Die Rückseite zeigt einen Beispielsatz mit dem Wort aus
   einem Lesetext oder einer Wortbank-Übung der Unit. Das ist kein neuer Text, die Zuordnung
   steht schon aus Schritt 2. Ein Wort im Satz merkt man sich deutlich besser als ein Wort
   allein.
2. **Hörkarte als dritte Richtung.** Die Karte spielt nur das Wort ab, man nennt die Bedeutung.
   Das braucht `useCanSpeak` und erscheint ohne Stimme nicht.
3. **Markieren und „Schwer“-Stapel.** Neben den eigenen Markierungen gibt es einen
   automatischen Stapel aus `hardItems`, also Karten mit vielen `lapses` im SRS.
4. **Formkarten für Verben und Nomen.** Die Vorderseite zeigt „gitmek · Präsens · ich“, die
   Rückseite „gidiyorum“. Die Engine erzeugt die Form, es entsteht also kein neuer Text. Das ist
   das, was andere Karteikarten-Apps nicht können. Dafür ist eine eigene Phase sinnvoll.
5. **Eigene Karten.** Die nutzt man zum Beispiel für Wörter aus dem Alltag. Sie liegen in Dexie
   und kommen in die Sicherung. Weil der Nutzer sie selbst schreibt, sind sie kein
   Claude-Inhalt. Später, nicht im ersten Wurf.
6. **„Wiederholen“ ergänzen statt doppeln.** Wer eine Karte im Karteikasten falsch hat, bekommt
   sie in „Wiederholen“ früher wieder (Entscheidung 1, Variante B).
7. **Gezielt vor dem Lernen.** Nach dem Abschluss einer Vokabel-Lektion gibt es den Knopf „Die
   neuen Wörter als Karteikarten“.

Bewusst nicht dabei: Lernziele mit Datum („Prüfung am …“), Ranglisten und Belohnungen. Die
widersprechen SPEC Abschnitt 2.

## Phasen

| Phase | Inhalt | Prüfung | Modell |
|---|---|---|---|
| K1 | Build: Vokabel → Lektion, Feld `lesson`, Manifest `lessons[].vocab`; Satzkarten `phraseCards`, Feld `card`, Manifest `lessons[].phrases`; Snapshots | Unit- und Build-Tests | Opus (Zuordnung über `lemmatize`, Satzauswahl, Randfälle) |
| K2 | Dexie v5, reine Logik (`deckFor`, `openWrong`, Rundenmaschine), Sicherung | Unit-Tests, Backup-Rundlauf | Opus |
| K3 | UI: Wahlbildschirm, Runde mit Aufdecken und Eintippen, Rückseite, i18n, Einstiege | Komponententests, E2E in 3 Breiten, axe hell/dunkel | Sonnet reicht |
| K4 | Falsch-Stapel, Markieren, Zusammenfassung je Lektion, Statistik-Zeile | E2E `flashcards.spec.ts` | Sonnet |
| K5 | Ideen 1–3 (Beispielsatz, Hörkarte, Schwer-Stapel) | Unit-Tests, E2E | Sonnet, Satzauswahl Opus |
| K6 (optional) | Formkarten über die Engine | Engine-Rundlauf gegen `allForms` | Opus |

Nach jeder Phase laufen Lint, Typecheck, Unit-Tests, Build und E2E. Am Ende wird `CLAUDE.md`
nachgeführt. Gepusht wird nur auf Zuruf.

## Offene Entscheidungen

1. ~~Einfluss aufs SRS.~~ **Entschieden (2026-11-04): A, getrennt.** Karteikarten verändern
   keine Leitner-Boxen. Idee 6 entfällt damit.
2. **Welche Lektionen.** Alle Lektionen sind frei wählbar, passend zu SPEC „freie Navigation“
   (Vorschlag). Die Alternative ist, nur abgeschlossene Lektionen zuzulassen.
3. **Standardmodus.** Aufdecken mit Selbstbewertung, schnell wie bei Repetico (Vorschlag). Die
   Alternative ist Eintippen.
4. **Markieren.** Je Wort (Vorschlag) oder je Richtung.
5. **Formkarten (K6).** Gewünscht oder nicht.
