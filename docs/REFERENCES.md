# Referenzen und Umgang mit Quellen

## Grundsatz

Siehe `SPEC.md` 7.1: Aus kommerziellen oder anderweitig geschützten Werken werden **keine Texte,
Beispielsätze, Übersetzungen, Übungen oder Wörterbucheinträge** übernommen. Sie dienen nur als
didaktische Orientierung (Reihenfolge, Themen) und als Nachschlagewerk zum Prüfen von
Grammatikregeln. Regeln selbst sind Fakten über die Sprache; sie werden in eigenen Worten
formuliert und mit eigenen Beispielen umgesetzt. Die Werke und Auszüge daraus liegen nicht im Repository.

## Genutzte Werke (nur Orientierung)

| Werk                                                                                                                 | Rechte                                                            | Wofür genutzt                                                                                                                                                                                                          |
| -------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Margarete I. Ersen-Rasch: _Türkische Grammatik für Anfänger und Fortgeschrittene_, Hueber, 2. Aufl. 2004 (Leseprobe) | © Max Hueber Verlag, alle Rechte vorbehalten                      | Gliederung (Reihenfolge der Grammatikthemen) für `docs/CURRICULUM.md`; Abgleich der Lautregeln (Harmonie-Abweichungen, Vokalausfall, Verdopplung, Erweichung, Assimilation, Suffix-Notation) für `docs/ENGINE_GAPS.md` |
| Erkan Gürsoy: _Sprachbeschreibung Türkisch_, 2010                                                                    | © Erkan Gürsoy; nur die enthaltene Karte steht unter CC BY-SA 3.0 | Kontrastive Punkte Deutsch–Türkisch (Agglutination, Pro-Drop, genusloses o, SOV, Fragepartikel, Verwandtschaftsbezeichnungen, Zahlbildung) für Erklärkarten und Curriculum                                             |
| _PONS Bildwörterbuch Deutsch-Türkisch_, Wortverzeichnis, 2015                                                        | © PONS GmbH (Urheber- und Datenbankrecht)                         | Nur die Kapitelstruktur als Liste von Wortfeldern (`docs/CURRICULUM.md`, Themenliste). Keine Wortpaare übernommen.                                                                                                     |

## Offene Quellen (Datenbasis, Lizenz pro Datensatz im Feld `source`/`license`)

Siehe `SPEC.md` 7.2: Wikibooks Türkisch/Turkish, Tatoeba (CC BY 2.0 FR), Wiktionary/kaikki.org
(CC BY-SA), FrequencyWords (CC BY-SA 4.0). Noch nicht importiert; geplant über
`tools/build_vocab.ts` und `tools/import_tatoeba.ts` (SPEC 9).

## Weiterführend (Referenzgrammatik zum Nachschlagen)

Göksel/Kerslake: _Turkish. A Comprehensive Grammar_ (Routledge) als englischsprachige
Referenzgrammatik zum Prüfen von Zweifelsfällen, ebenfalls ohne Textübernahme.
