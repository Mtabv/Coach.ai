# Coach.AI – Datenmatrix (Entwurf 1)

Stand: 05.11.2026 · Grundlage: Briefing, aktuelle Vorschau, Referenzdossier „TSG Wilhelmshöhe – Eintracht Baunatal V1“.

Zweck: Für jede Angabe im Dossier festlegen, **woher** sie kommt, **wie aktuell** sie sein muss, **was bei Fehlen** passiert und **was bei Widerspruch** gilt.
Mit **[E…]** markierte Stellen sind Entscheidungen, die nur der Trainer bzw. Produktverantwortliche treffen kann (Liste am Ende).

---

## 1. Befund: Welche Quellen gibt es überhaupt?

| Quelle | Zugang | Was liefert sie (nach heutigem Kenntnisstand) | Risiko |
| --- | --- | --- | --- |
| **fussball.de** (DFB/DFBnet) | Keine offizielle, öffentlich dokumentierte Programmierschnittstelle gefunden. Offiziell nur **Widgets** zum Einbetten (Tabelle, Spielplan, Kader) mit domaingebundenem Schlüssel für Vereinsseiten. | Ansetzungen, Anstoßzeiten, Spielorte, Ergebnisse, Tabelle, Spieltagspaarungen, Kader (je nach Verein), Vereinslogos. Amtliche Quelle für Spielbetrieb. | Automatisches Auslesen der Webseiten: technisch fragil, Nutzungsbedingungen **noch nicht geprüft** (Seite aus der Entwicklungsumgebung nicht erreichbar). Inoffizielle Dienste wie api-fussball.de: Doku-Repository seit 31.03.2026 archiviert. |
| **FuPa** | Keine öffentliche Schnittstelle oder Nutzungsregel für automatisierten Abruf gefunden. | Spielerstatistiken (Einsätze, Tore, Vorlagen), FuPa-MVP-Wert, Spielerfotos, Körpergröße, Transfers, Vereinsnachrichten, Aufstellungen (wenn getickert). | Datenqualität abhängig davon, ob Vereine/Reporter pflegen. Rechte an Fotos und Texten. Zugang nur mit Zustimmung von FuPa sinnvoll. |
| **Vereinswebseiten / Social Media** | Manuell | Trainerwechsel, Neuzugänge, Ausfälle | Unstrukturiert, selten aktuell |
| **Trainer** | Eingabe in Coach.AI | Beobachtungen, Organisation, Kleidung, Kader, Botschaften, Fahrzeit, Korrekturen | Zeitaufwand am Spieltag |
| **Berechnet** (Coach.AI) | Intern | Bilanzen, Serien, Kennzahlen, Zeitplan, „3 Facts“ | Nur so gut wie die Eingangsdaten |
| **Kostenpflichtige Sportdaten-Anbieter** | Vertrag/API | Meist Profi- und höhere Amateurligen | Gruppenliga-Abdeckung unwahrscheinlich, zu prüfen |

**Konsequenz:** Eine vollautomatische, rechtssichere Recherche ist derzeit **nicht gesichert**. Empfohlene Reihenfolge der Klärung:

1. Nutzungsbedingungen fussball.de und FuPa lesen und bei Bedarf **schriftlich anfragen** (DFB/DFBnet-Support, support@fupa.net): Ist ein automatisierter Abruf für ein Trainerwerkzeug erlaubt, ggf. gegen Entgelt?
2. Technischer Test mit 2–3 echten Ligen (z. B. Gruppenliga Kassel 2): Was ist stabil abrufbar?
3. Bis dahin: **Halbautomatik** – Trainer fügt Links oder kopierte Tabellen ein, Coach.AI liest und prüft sie (siehe Abschnitt 4).

---

## 2. Grundregeln (gelten für alle Angaben)

1. **Fachlicher Datenstand vor Abrufzeit.** Ein neuer Abruf macht Daten nicht aktuell. Maßgeblich ist z. B. „nach dem 13. Spieltag“.
2. **Widersprüche bleiben sichtbar**, bis der Trainer eine Quelle wählt. Nie automatisch „glätten“.
3. **Fehlendes wird markiert, nicht erfunden.** Keine Schätzungen, keine Übertragung aus anderen Spielen (z. B. Fahrzeiten).
4. **Amtliche Spielbetriebsdaten** (Ansetzung, Ergebnis, Tabelle, Punktabzug): fussball.de vor FuPa, Trainerkorrektur vor beiden. **[E1]**
5. **Spielerbezogene Daten** (Tore, Vorlagen, Einsätze, MVP, Fotos): FuPa vor fussball.de, Trainerhinweis vor beiden. **[E2]**
6. **Trainerbeobachtungen** und **Mannschaftsbotschaften** stammen ausschließlich vom Trainer und werden getrennt von Statistik ausgegeben.
7. **Pflichtangaben** blockieren nur die *Bestätigung*, nie den Entwurf.

Legende Spalte „Bei Fehlen“: **offen** = im Dossier sichtbar als „offen“ markiert · **nachfragen** = Coach.AI fragt im Fragebogen nach · **weglassen** = Element entfällt still bzw. Folie wird reduziert · **blockiert** = Bestätigung nicht möglich.

---

## 3. Matrix je Folie

### Folie 1 · Titel

| Angabe | Quellen (Rang) | Aktualität | Bei Fehlen | Bei Widerspruch | Pflicht |
| --- | --- | --- | --- | --- | --- |
| Begegnung, Heim/Auswärts | 1 Spielanlage Trainer · 2 fussball.de | einmalig | blockiert | Trainer entscheidet | ja |
| Wettbewerb, Spieltag | 1 fussball.de · 2 Trainer | einmalig | offen | Trainer entscheidet | ja |
| Datum, Anstoßzeit | 1 fussball.de · 2 Trainer | **bis Spieltag prüfen** (Verlegungen) | blockiert | sichtbar, Trainer entscheidet | ja |
| Spielort + Adresse | 1 fussball.de (Spielstätte) · 2 Mannschaftsprofil (Heim) · 3 Trainer | bis Spieltag | offen | sichtbar | ja |
| Vereinslogos | 1 fussball.de · 2 FuPa · 3 Upload Trainer | Saison | weglassen | – | nein **[E3]** |

### Folie 2 · Was euch erwartet
Nur aus Vorlage erzeugt – keine externen Daten.

### Folie 3 · Der Spieltag

| Angabe | Quellen (Rang) | Aktualität | Bei Fehlen | Bei Widerspruch | Pflicht |
| --- | --- | --- | --- | --- | --- |
| Tabelle (Pl., Sp., Tore, Pkt.) | 1 fussball.de · 2 FuPa | Stand nach letztem Spieltag vor dem Spiel | offen (Folie zeigt nur Paarungen) | betroffene Zeile markiert, Trainer wählt Quelle | ja **[E4]** |
| Punktabzug | 1 fussball.de · 2 Verbandsmeldung | wie Tabelle | als „nicht angegeben“ | sichtbar | – |
| Spieltagspaarungen mit Datum/Uhrzeit | 1 fussball.de · 2 FuPa | bis Spieltag | offen | sichtbar | nein |

Hinweis: Tabellenpunkte werden **nie** aus S/U/N abgeleitet; Abweichungen ohne Punktabzug werden als Widerspruch markiert (bereits umgesetzt).

### Folie 4 · Unser Spiel

| Angabe | Quellen (Rang) | Aktualität | Bei Fehlen | Bei Widerspruch | Pflicht |
| --- | --- | --- | --- | --- | --- |
| Spielort, Wettbewerb | s. Folie 1 | | | | |
| Treffpunkt, Zeitplan | **berechnet** aus Zeitmuster + Anstoß; Abweichung nur durch Trainer | Spieltag | Zeitmuster fehlt → offen | Trainer-Abweichung gewinnt, wird markiert | ja |
| Fahrzeit (auswärts) | 1 Trainerangabe · 2 Routendienst für **genau diese Fahrt** **[E5]** | je Fahrt | Abfahrt/Treffpunkt offen, übriger Ablauf wird gezeigt | Trainer gewinnt | ja (auswärts) |
| Spielkleidung | 1 Trainer (Frage 11) · 2 Profil-Vorbelegung | je Spiel | nachfragen | – | nein |
| Kleidungsbilder | Upload im Mannschaftsprofil | Saison | Text statt Bild | – | nein **[E3]** |
| Direkte Duelle mit Saison | 1 fussball.de (Spielhistorie) · 2 FuPa · 3 Trainer | 2 Saisons zurück **[E6]** | „keine Angaben“ | sichtbar | nein |

Abweichung im Referenzdossier: Dort heißt der erste Block „17:20–17:45 Ankommen und akklimatisieren“. Nach den hinterlegten TSG-Standards sind das zwei Blöcke („Puffer“ 17:20–17:30, „Ankommen“ 17:30–17:45). Die Standards gelten; Bezeichnungen sind im Profil änderbar. **[E7]**

### Folie 5 · Der Gegner · Form  /  Folie 9 · Unsere Form

| Angabe | Quellen (Rang) | Aktualität | Bei Fehlen | Bei Widerspruch | Pflicht |
| --- | --- | --- | --- | --- | --- |
| Ergebnisliste Saison (Liga/Pokal/Test getrennt) | 1 fussball.de · 2 FuPa | bis Vortag | offen | sichtbar, Trainer wählt | ja |
| Letzte 5 Ligaspiele (Datum, Gegner, H/A, Ergebnis) | **berechnet** aus Ergebnisliste | – | „nur n Spiele“ | – | ja |
| Saisonbilanz, Heim-/Auswärtsbilanz, Bilanz letzte 5 | **berechnet** | – | – | – | ja |
| Tabellenplatz/Punkte | aus Tabelle (Folie 3) | – | offen | wie Folie 3 | ja |
| Gegnerlogos in der Formleiste | wie Folie 1 | | weglassen | | nein |
| „3 Facts“ (z. B. „in 12 von 13 Spielen mind. zweimal getroffen“) | **berechnet** aus Ergebnissen; Auswahl regelbasiert, Trainer kann tauschen | – | weniger Facts | – | nein |

### Folie 6 · Der Gegner · Gefahr

| Angabe | Quellen (Rang) | Aktualität | Bei Fehlen | Bei Widerspruch | Pflicht |
| --- | --- | --- | --- | --- | --- |
| Spielerliste mit Position | 1 FuPa · 2 fussball.de-Kader | Saison | Folie reduziert | sichtbar | nein |
| Einsätze, Tore, Vorlagen | 1 FuPa · 2 fussball.de (Torschützen aus Spielberichten) | Stand mit Datum angeben | Wert weglassen | **sichtbar**, Trainer wählt | nein |
| FuPa-MVP-Wert | nur FuPa (mit Datum, Definition in Fußnote) | Stand angeben | weglassen | – | nein **[E8]** |
| Körpergröße, Rolle (z. B. Spielertrainer) | 1 FuPa · 2 Trainer | Saison | weglassen | – | nein |
| Spielerfotos | FuPa – **Bildrechte klären** | Saison | Initialen-Platzhalter | – | nein **[E3]** |
| Auswahl der bis zu 4 Spieler | 1 Trainerhinweis · 2 regelbasiert nach Torbeteiligungen | – | keine 4 erzwingen | – | – |
| Gefahrenhinweis-Text | Trainer; optional später KI-Verdichtung **nur aus belegten Zahlen** | – | weglassen | – | nein |

### Folie 7 · Der Gegner · Auffälligkeiten

| Angabe | Quellen (Rang) | Aktualität | Bei Fehlen | Bei Widerspruch | Pflicht |
| --- | --- | --- | --- | --- | --- |
| Tore/Gegentore pro Spiel | **berechnet** | – | offen | – | nein |
| Torjägeranteil (z. B. „16 von 42“) | **berechnet** aus Spielertoren + Mannschaftstoren | – | weglassen | wenn Summen nicht passen: markieren | nein |
| Kaderstatistik (Spieler mit Ligaeinsatz) | 1 FuPa · 2 fussball.de Spielberichte | Stand angeben | weglassen | sichtbar | nein |
| Trainerteam, Zu-/Abgänge | 1 Vereinsmeldung/FuPa-News **mit Quelle und Datum** · 2 Trainer | Saison | weglassen | sichtbar | nein |
| Tabellensituation in Worten | **berechnet** aus Tabelle | – | – | wie Folie 3 | – |
| **Sportliche Einordnung / „Achtung“** | **nur Trainer** | je Spiel | weglassen | – | nein **[E9]** |

### Folie 8 · So spielt der Gegner
Ausschließlich Trainerbeobachtungen (Fragen 1–8). Fehlt eine Beobachtung: „noch keine belastbare Beobachtung“ – keine Ableitung aus Statistik. Der rote Merksatz unten im Referenzdossier ist Trainertext. **[E9]**

### Folie 10 · Unser Kader

| Angabe | Quellen (Rang) | Aktualität | Bei Fehlen | Bei Widerspruch | Pflicht |
| --- | --- | --- | --- | --- | --- |
| Spieltagskader nach Positionen | 1 zuletzt bestätigter Kader + Trainer-Änderungen · später SpielerPlus | je Spiel | Ersteingabe | – | ja |
| Trainer/Staff | Mannschaftsprofil | Saison | weglassen | – | nein **[E10]** |
| Spielerfotos | Upload/Profil | Saison | Platzhalter | – | nein **[E3]** |
| Kader-Facts (z. B. „Tom kommt zur 2. HZ“) | Trainer | je Spiel | weglassen | – | nein |

Keine Nominierung aus Online-Vereinskadern.

### Folie 11 · Unser Auftrag
Ausschließlich Trainer: 3 Botschaften (Überschrift + Begleittext), Leitmotiv, Merksätze oder ausdrücklich „entfallen“. Pflicht für die Bestätigung.

---

## 4. Vorgeschlagene Ausbaustufen der Datenbeschaffung

| Stufe | Beschreibung | Aufwand | Abhängigkeit |
| --- | --- | --- | --- |
| **A – Manuell geführt** (heute) | Trainer erfasst bzw. ergänzt; Coach.AI prüft und berechnet | gering | keine |
| **B – Halbautomatisch** | Trainer fügt Tabelle/Ergebnisliste per Kopieren ein oder lädt Screenshot; Coach.AI liest strukturiert aus, zeigt Quelle und Stand, Trainer bestätigt | mittel | keine Rechtefrage, da Trainer die Daten selbst bereitstellt |
| **C – Automatisch mit Erlaubnis** | Serverseitiger Abruf aus fussball.de/FuPa mit Zwischenspeicher | hoch | schriftliche Zustimmung bzw. Vertrag **[E11]** |

Empfehlung: **B als nächster Schritt**, parallel Anfragen für C stellen.

---

## 5. Offene Entscheidungen

| Nr. | Frage | Vorschlag |
| --- | --- | --- |
| E1 | Amtliche Daten: fussball.de vor FuPa? | Ja |
| E2 | Spielerdaten: FuPa vor fussball.de? | Ja |
| E3 | Logos, Spieler- und Kleidungsfotos: übernehmen (Rechte?) oder nur eigene Uploads? | Vorerst nur eigene Uploads, Gegner mit Platzhalter |
| E4 | Darf ein Dossier ohne Tabelle bestätigt werden? | Ja, mit Markierung „offen“ |
| E5 | Fahrzeit automatisch über Routendienst (z. B. OpenStreetMap-basiert) oder nur Trainerangabe? | Vorschlag anzeigen, Trainer bestätigt |
| E6 | Wie weit zurück reichen direkte Duelle? | 2 Saisons, Pokal getrennt gekennzeichnet |
| E7 | Ablauf-Bezeichnungen wie im Referenzdossier oder wie im Briefing? | Briefing-Zeiten, Bezeichnungen frei wählbar |
| E8 | FuPa-MVP-Wert verwenden? | Ja, mit Datum und Definition |
| E9 | Neue Trainerfelder „Sportliche Einordnung“ und „Merksatz zur Spielweise“ aufnehmen? | Ja (fehlen in der Vorschau) |
| E10 | Trainer/Staff auf der Kaderfolie? | Ja, aus Profil |
| E11 | Für welche Ligen/Regionen und Altersklassen soll Stufe C zuerst funktionieren? | Hessen, Herren, Gruppen-/Kreisoberliga |

Quellenhinweise zur Recherche: DFBnet-Widget-Anleitungen, Doku von api-fussball.de (Repository archiviert), Open-Source-Crawler „fussball_de_api“, FuPa-App-Beschreibung. Nutzungsbedingungen von fussball.de und FuPa sind **noch nicht gelesen** und müssen vor Stufe C geprüft werden.
