# Morphologie-Engine: Abgleich mit den Grammatik-Referenzen

Stand: Oktober 2026, Engine aus M3 (`src/morphology/`). Abgeglichen mit den Regelkapiteln der
in `docs/REFERENCES.md` genannten Werke (Lautlehre, Rechtschreibung, Nomen, Verb). Regeln sind
eigenständig formuliert, alle Beispiele sind eigene oder allgemein gebräuchliche Grundwörter.

Legende: ✅ abgedeckt · 🟡 teilweise · ❌ fehlt. Priorität = wann der Lernstoff es braucht.

## 1. Lautlehre und Rechtschreibung

| Regel                                                                                                        | Status | Umsetzung / Lücke                                                                                                                    | Priorität                            |
| ------------------------------------------------------------------------------------------------------------ | ------ | ------------------------------------------------------------------------------------------------------------------------------------ | ------------------------------------ |
| Zweifache Harmonie (e/a)                                                                                     | ✅     | Archiphonem `A`                                                                                                                      | –                                    |
| Vierfache Harmonie (i/ı/ü/u)                                                                                 | ✅     | Archiphonem `I`                                                                                                                      | –                                    |
| Harmonie nach Gehör statt Schrift (Lehnwörter: saat, gol, kabul)                                             | ✅     | `harmony_vowel` in der Vokabel; Tests für saat, gol, kabul                                                                           | –                                    |
| Puffer y/n/s gegen Vokalzusammenstoß                                                                         | ✅     | Klammer-Templates `(y)`, `(n)`, `(s)`                                                                                                | –                                    |
| Stimmlos-Assimilation d→t                                                                                    | ✅     | Archiphonem `D`                                                                                                                      | –                                    |
| Assimilation c→ç, g→k (Suffixe -ci, -ce, -gen …)                                                             | ❌     | Archiphoneme `C`, `G` ergänzen, sobald Ableitungssuffixe kommen (Türkçe, kitapçı)                                                    | A2                                   |
| Erweichung p/ç/t/k → b/c/d/ğ vor Vokal                                                                       | ✅     | lexikalisch über `softens` (nicht jedes Wort erweicht: at → atı)                                                                     | –                                    |
| nk → ng                                                                                                      | ✅     | in `soften()`                                                                                                                        | –                                    |
| Erweichung bei Verbstämmen (et-, git-, tat- → ed-, gid-, tad-)                                               | ❌     | Teil der Verbmorphologie, Flag am Verb                                                                                               | A1 (Präsens: gidiyorum)              |
| Vokalausfall bei Suffix mit Vokal (ağız → ağzı, burun → burnu, oğul → oğlu, isim → ismi)                     | ❌     | neues Vokabel-Flag `drops_vowel: true`; Engine streicht den letzten Stammvokal vor vokalisch anlautendem Suffix                      | **A1** (Familie: oğlum; Name: ismim) |
| Konsonantenverdopplung (hak → hakkı, his → hissi, sır → sırrı)                                               | ❌     | Vokabel-Flag `doubles: true`, kombinierbar mit Erweichung (ret → reddi)                                                              | A2                                   |
| Stumme Endung arabischer Lehnwörter (cami → camii)                                                           | ❌     | Vokabel-Flag `consonant_final: true` (wie Konsonant behandeln, kein Puffer); beide Formen akzeptieren, da camisi inzwischen zulässig | A2                                   |
| Eigennamen mit Apostroph (Berlin'de, Frankfurt'ta), keine geschriebene Erweichung (Mehmet'e, nicht *Mehmede) | ❌     | `proper: true`: Großschreibung erhalten, Apostroph vor dem ersten Suffix, Erweichung nur lautlich                                    | **A1** (Herkunft, Orte)              |
| Zirkumflex (kâr, hala vs. hâlâ)                                                                              | ❌     | nur Orthografie in Inhalten; Antwortprüfung sollte `â` ≈ `a` tolerieren (Hinweis statt Fehler)                                       | A2                                   |
| Betonung (meist letzte Silbe; Ausnahmen bei Ortsnamen, -mA-Verneinung, Fragepartikel)                        | ❌     | kein Engine-Thema; Audio und Erklärkarten                                                                                            | später                               |
| Unregelmäßige Stämme (su → suyun/suyu, ne → neyi)                                                            | 🟡     | su + ACC zufällig richtig (suyu); Gen. und Poss. 3. Sg. falsch. Ausnahmeliste mit festen Formen je Tag                               | A1 (Essen und Trinken)               |

## 2. Nominalmorphologie

| Bereich                                                                        | Status | Lücke                                                                                       | Priorität |
| ------------------------------------------------------------------------------ | ------ | ------------------------------------------------------------------------------------------- | --------- |
| Plural, Possessiv 1.–3. Person Sg./Pl., sechs Kasus                            | ✅     | –                                                                                           | –         |
| Pronominales n nach Possessiv 3. Person                                        | ✅     | –                                                                                           | –         |
| Possessiv-Kompositum (Genitiv-Possessiv-Verbindung: okul müdürü, Türk kahvesi) | ❌     | zwei Wörter, das zweite mit POSS_3SG; als eigener Übungsfall, keine neue Engine-Regel nötig | A1/A2     |
| Zugehörigkeitssuffix -ki (evdeki, benimki)                                     | ❌     | neuer Tag `KI` (harmonisiert nicht, außer bugünkü)                                          | A2        |
| Ableitungen -lI, -sIz, -lIk, -CI                                               | ❌     | neue Tags; brauchen `C` für -ci                                                             | A2        |
| Personalpronomen mit Kasus (bana, sana, beni, benim)                           | ❌     | unregelmäßig → Tabelle statt Regel                                                          | **A1**    |
| Kein Plural nach Zahlen und çok/birkaç                                         | –      | keine Engine-Regel; in Inhalten und Erklärkarte (A1-02 erledigt)                            | –         |

## 3. Verbmorphologie (größte Lücke, Voraussetzung für A1-03 ff.)

Die Grammatiken unterscheiden vier Typen von Personalendungen; die Engine braucht sie als
eigene Template-Gruppen:

| Typ                  | Verwendung                                       | Formen (Archiphonem)                  | Priorität    |
| -------------------- | ------------------------------------------------ | ------------------------------------- | ------------ |
| 1 „Kopula“           | Präsens -Iyor, Futur, Aorist, -mIş, Nominalsätze | -(y)Im, -sIn, –, -(y)Iz, -sInIz, -lAr | **A1**       |
| 2 „Possessiv-artig“  | Präteritum -DI, Konditional -sA                  | -m, -n, –, -k, -nIz, -lAr             | A1 Ende / A2 |
| 3 Imperativ          |                                                  | –, -sIn, -(y)In / -(y)InIz, -sInlAr   | A2           |
| 4 Voluntativ/Optativ | -(y)AyIm, -(y)AlIm                               |                                       | A2           |

Zusätzlich nötig:

- **Präsens -Iyor**: Stammauslaut-Vokal fällt weg (bekle- → bekliyor, ara- → arıyor), -yor selbst harmonisiert nicht. Verbstamm-Erweichung (git- → gidiyor).
- **Verneinung -mA**: vor -Iyor eingeengt (gelmiyor), im Aorist Sonderformen (gelmem, gelmez).
- **Fragepartikel mI**: getrennt geschrieben, harmonisiert mit dem letzten Vokal, trägt bei Typ 1 die Personalendung (geliyor musun?).
- **Aorist**: -r nach Vokal, -Ir bei mehrsilbigen Stämmen, -Ar bei den meisten einsilbigen, kleine geschlossene Liste einsilbiger Stämme mit -Ir (al-, bil-, gel-, ver- …; git- dagegen regulär: gider) → Vokabel-Flag `aorist: Ir|Ar`.
- **Futur -(y)AcAk**: k → ğ vor vokalischer Personalendung (geleceğim).
- **Präteritum -DI**, **Perfekt -mIş**, Kombination mit idi/imiş (B1).
- **Kopula im Nominalsatz** (Almanım, öğrenciyiz) und **-DIr**; **var/yok** und „haben“ über Possessiv + var.

## 4. Empfohlene Reihenfolge (Phase 2)

1. `proper`, `drops_vowel`, Personalpronomen-Tabelle (A1-03 Orte/Herkunft, A1-06 Familie)
2. Verb-Engine Stufe 1: Kopula Typ 1, Präsens -Iyor, Verneinung -mA, Fragepartikel mI, Verbstamm-Erweichung
3. Unregelmäßigkeiten-Liste (su, ne, de-/ye-: diyor, yiyor)
4. Stufe 2 (A2): -DI mit Typ 2, -(y)AcAk, Aorist mit Lexikon-Flag, -(y)Abil, -mAlI, Imperativ; `C`/`G`; `doubles`, `consonant_final`; -ki, Ableitungen

Jede Regel bekommt Tabellentests nach dem Muster von `src/morphology/inflect.test.ts`; offene
Punkte stehen dort als `it.todo`.
