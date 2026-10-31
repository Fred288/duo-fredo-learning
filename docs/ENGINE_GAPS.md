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
| Assimilation c→ç, g→k (Suffixe -ci, -ce, -gen …)                                                             | ◐      | Archiphonem `C` umgesetzt (kitapçı, gazeteci); `G` offen bis -gen/-gil gebraucht werden                                              | B1                                   |
| Erweichung p/ç/t/k → b/c/d/ğ vor Vokal                                                                       | ✅     | lexikalisch über `softens` (nicht jedes Wort erweicht: at → atı)                                                                     | –                                    |
| nk → ng                                                                                                      | ✅     | in `soften()`                                                                                                                        | –                                    |
| Erweichung bei Verbstämmen (et-, git-, tat- → ed-, gid-, tad-)                                               | ✅     | `softens` am Verb (gidiyor, ediyor)                                                                                                  | A1 (Präsens: gidiyorum)              |
| Vokalausfall bei Suffix mit Vokal (ağız → ağzı, burun → burnu, oğul → oğlu, isim → ismi)                     | ✅     | Vokabel-Flag `drops_vowel` (Phase 2, Schritt 1)                                                                                      | **A1** (Familie: oğlum; Name: ismim) |
| Konsonantenverdopplung (hak → hakkı, his → hissi, sır → sırrı)                                               | ✅     | Vokabel-Flag `doubles`, kombinierbar mit Erweichung (ret → reddi)                                                                    | –                                    |
| Stumme Endung arabischer Lehnwörter (cami → camii)                                                           | ✅     | Vokabel-Flag `poss_no_s`: nur Possessiv 3. Sg. ohne Puffer-s (camii, camiinde), sonst regulär (camiyi, camiye); Nebenform camisi über `inflectVariants` und `alt_targets` | –                                    |
| Komposita mit Possessivendung (atasözü → atasözleri, atasözünde; trafik ışığı → trafik ışıkları) | ✅ | Vokabel-Flag `compound_stem` = Stamm ohne -(s)I; Build prüft Stamm + -(s)I = `tr`; auch für Mehrwort-Nomen | **A1** (yatak odası, hafta sonu) |
| Eigennamen mit Apostroph (Berlin'de, Frankfurt'ta), keine geschriebene Erweichung (Mehmet'e, nicht *Mehmede) | ✅     | Vokabel-Flag `proper`; Nationalitäten ohne Apostroph über `capitalized` (Türkler, Almanım)                                           | **A1** (Herkunft, Orte)              |
| Zirkumflex (kâr, hala vs. hâlâ)                                                                              | ✅     | â î û zählen als Vokale (harmonisch wie a i u); Antwortprüfung faltet sie wie Sonderzeichen (Hinweis statt Fehler)                    | –                                    |
| Betonung (meist letzte Silbe; Ausnahmen bei Ortsnamen, -mA-Verneinung, Fragepartikel)                        | ❌     | kein Engine-Thema; Audio und Erklärkarten                                                                                            | später                               |
| Unregelmäßige Stämme (su → suyun/suyu, ne → neyi)                                                            | ✅     | Vokabel-Flag `y_stem`: y vor Genitiv und Possessiv (suyun, suyum, neyin); ne + Poss. 3. Sg. = nesi                            | –                                    |

## 2. Nominalmorphologie

| Bereich                                                                        | Status | Lücke                                                                                       | Priorität |
| ------------------------------------------------------------------------------ | ------ | ------------------------------------------------------------------------------------------- | --------- |
| Plural, Possessiv 1.–3. Person Sg./Pl., sechs Kasus                            | ✅     | –                                                                                           | –         |
| Pronominales n nach Possessiv 3. Person                                        | ✅     | –                                                                                           | –         |
| Possessiv-Kompositum (Genitiv-Possessiv-Verbindung: okul müdürü, Türk kahvesi) | ❌     | zwei Wörter, das zweite mit POSS_3SG; als eigener Übungsfall, keine neue Engine-Regel nötig | A1/A2     |
| Zugehörigkeitssuffix -ki (evdeki, benimki)                                     | ✅     | Tag `KI` (bugünkü, dünkü); danach Plural/Kasus mit pronominalem n; benimki nur als Text     | –         |
| Ableitungen -lI, -sIz, -lIk, -CI                                               | ✅     | Tags `LI`, `SIZ`, `LIK`, `CI` (Slot 0, stapelbar, ohne Apostroph: Ankaralı)                 | –         |
| Personalpronomen mit Kasus (bana, sana, beni, benim)                           | ✅     | Tabelle `pronouns.ts` (inkl. bu, şu)                                                        | **A1**    |
| Kein Plural nach Zahlen und çok/birkaç                                         | –      | keine Engine-Regel; in Inhalten und Erklärkarte (A1-02 erledigt)                            | –         |

## 3. Verbmorphologie

**Stufe 1 umgesetzt** (`src/morphology/verb.ts`): Präsens -Iyor mit Stammvokal-Ausfall und Verbstamm-Erweichung, de-/ye- unregelmäßig, Verneinung mit Verengung, Personalendungen Typ 1, Fragepartikel mI (getrennt, mit Personalendung; 3. Pl. am Verb), Kopula im Nominalsatz inkl. değil und -DIr. Übungstyp `conjugation`.

**Stufe 2 umgesetzt**: Präteritum -DI mit Personalendungen Typ 2 (Frage: geldin mi?), Futur -(y)AcAk mit k → ğ vor vokalischer Endung und ye-/de- → yiyecek/diyecek, Aorist (-r / -Ar / -Ir mit der Liste der 13 Einsilber, Override `aorist: ar|ir`, Verneinung gelmem/gelmez/gelmeyiz). `tense` in `conjugation` und `paradigm`.

**Stufe 3 umgesetzt**: Perfekt/Evidential -mIş, Notwendigkeit -mAlI, Imperativ (gel, gelsin, gelin/geliniz, gelsinler; verneint gelme, gelmeyin; git → gidin, ye → yiyin), „können“ -(y)Abil als Option `ability` in allen Zeiten (gelebilirim, gelebildim; verneint gelemem, gelemiyorum, gidemem, yiyemem), Kopula-Vergangenheit -(y)DI mit Typ 2 (öğrenciydim, Türktüm, değildim, öğretmen miydin?) und -(y)mIş. 

**Stufe 4a umgesetzt (B1)**: Konditional -sA mit Typ 2 (gelsem, gelmesem, gelsem mi), Optativ 1sg/1pl -(y)AyIm/-(y)AlIm (geleyim, gelelim, gideyim, yiyelim), Kopula an der Zeitform über `compound` (idi: geliyordum, gelecektim, gelirdim/gelmezdim, gelmiştim, gelmeliydim, gelseydim; imiş: geliyormuşum, gelmişmiş; ise: geliyorsam, gelirse, geldiysem), Frage vor der Kopula (geliyor muydum), Kopula ise im Nominalsatz (öğrenciysem, değilse). 

**Stufe 4b umgesetzt (B1)**: infinite Formen in `nonfinite.ts`: Partizipien -(y)An (gelen, gelenlere, yapılan), -DIk und -(y)AcAk mit Possessiv (okuduğum, geldiğini, geleceğimi, geldikten), Verbalnomen -mA (gelmesi, gelmesini), -mAk (gelmekte, gelmekten), -(y)Iş (gidiş), Konverbien -(y)Ip, -(y)ArAk, -(y)IncA, -(y)AlI, -mAdAn; de/ye nach TDK (yiyip, diyerek, aber deyip, deyince). 

**Stufe 5 umgesetzt (B2)**: Kausativ als Option `causative` (-DIr nach Konsonant, -t nach Vokal und mehrsilbig auf r/l, Vokabel-Flag `causative: ir|ar|it` für die geschlossene Liste; yedir-, dedirt-), Reziprok `reciprocal` (-(I)ş), beide in finiten und infiniten Formen, vor Passiv und „können“ (yaptırılabilir). Tense `mekte` (gelmekteyim), Option `dir` am Verb nur 3. Person (gelmiştir, gelmektedir, gelmişlerdir). Lexikalisierte Kausative (öğretmek, göstermek) sind eigene Vokabeln; im Nachschlagen führen Kausativformen nur auf ein Verb zurück, wenn der Kausativ selbst als Vokabel im Kurs steht.

**Stufe 5b umgesetzt (B2)**: -DIkçA, -(y)IncAyA, -mAksIzIn, -mAktAnsA, Partizip -mIş, -(y)As + Possessiv (gidesim, gelesi); -(y)An mit Possessiv (sevenlerim), -(y)AcAk ohne Possessiv mit Endungen (gelecekler, geleceğe).

**Passiv umgesetzt** (Option `passive` in `conjugate()`, `conjugation` und `paradigm`): -Il nach Konsonant, -In nach l, -n nach Vokal (yapılıyor, bilinir, okunur, yenir), Aorist immer -Ir, kombinierbar mit `ability` (yapılabilir). Reflexiv ist lexikalisch (yıkanmak, giyinmek) und über das Pronomen kendi (kendim, kendine).

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

1. ✅ `proper`, `drops_vowel`, Personalpronomen-Tabelle
2. ✅ Verb-Engine Stufe 1: Kopula Typ 1, Präsens -Iyor, Verneinung -mA, Fragepartikel mI, Verbstamm-Erweichung
3. ✅ Unregelmäßigkeiten (su, ne über `y_stem`; de-/ye-: diyor, yiyor, yiyecek)
4. ✅ Stufe 2: -DI mit Typ 2, -(y)AcAk, Aorist mit Lexikon-Flag
5. ✅ Stufe 3: -(y)Abil, -mAlI, Imperativ, -mIş, idi/imiş
6. ✅ -ki, Ableitungen -lI/-sIz/-lIk/-CI mit `C`, Passiv
7. 🟡 Stufe 4: ✅ Optativ, idi/imiş/ise, -sA (4a); ✅ Partizipien, Verbalnomen, Konverbien (4b); ✅ `doubles`, `poss_no_s`, Zirkumflex; ✅ Kausativ, Reziprok, -mAktA, -DIr am Verb; offen `G`

Jede Regel bekommt Tabellentests nach dem Muster von `src/morphology/inflect.test.ts`; offene
Punkte stehen dort als `it.todo`.
