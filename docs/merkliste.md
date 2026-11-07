# Merkliste – Ideen für später

Gesammelte Wünsche aus den Abstimmungen. Noch nicht umgesetzt, sofern nicht anders vermerkt.

## Spielnachbereitung

Siehe `docs/spielnachbereitung.md`. Dort stehen Spielerbewertung (mit Abfrage, ob sie veröffentlicht wird) und Trainingsschwerpunkte (Vorschlag und Trainerangabe).

## Regelmäßige Abfragen und Trainingsschwerpunkte

- **Regelmäßige Abfragen:** Coach.AI startet in festen Abständen eine kurze Abfrage beim Trainer, z. B. wöchentlich oder nach jedem Spiel.
- **Trainingsschwerpunkt setzen:** Der Trainer legt einen Schwerpunkt für einen Zeitraum fest, z. B. Fitness für die nächsten drei Wochen.
  - Coach.AI kann einen Schwerpunkt vorschlagen, wenn sich in den Daten ein Muster zeigt.
  - Beispiel: Gegentore häufen sich regelmäßig in der Schlussphase → Vorschlag „Fitness“.
- **Vorher prüfen, ob es wirklich ein Muster ist:**
  - Mindestanzahl Spiele mit vollständigem Spielbericht.
  - Vergleich mit der Gleichverteilung und mit dem Ligaschnitt.
  - Anzeige immer als Anzahl („12 von 64 Gegentoren“), nicht nur als Prozent.
  - Ein auffälliger Abschnitt allein reicht nicht.
- **Trainingseinheiten pro Woche und Trainingstage:** im Mannschaftsprofil umgesetzt (Stammdaten). Grundlage für Vorschläge, wie viel in einen Schwerpunkt passt.

## Analytics-Bereich

**Erste Version umgesetzt (07.11.2026):** Saison-Zwischenreport mit sieben Seiten, Navigation „Analytics“, inklusive Ligavergleich der Torminuten (alle Spielberichte der Staffel).

Später verfeinern, nach Wünschen der Trainer:
- Verbindung mit Nachbereitungen (Bewertung der Spielphasen, Spielerbewertungen, Trainingsschwerpunkte)
- PowerPoint-Export
- Hin- und Rückrunde getrennt

Auswertungen über mehrere Spiele. Daten und Grenzen siehe Abstimmung vom 07.11.2026. Kurz:

- **Aus Ergebnissen und Spielberichten:**
  - Tore und Gegentore je 15 Minuten
  - Halbzeit gegen Endstand (Führung gehalten oder verspielt, Rückstand aufgeholt)
  - Heim und Auswärts
  - Ergebnisse gegen die obere und untere Tabellenhälfte
  - Form im Verlauf
  - Torschützen und Abhängigkeit von einzelnen Spielern
  - Jokertore
  - Startelf-Einsätze und Wechsel in der Startelf
- **Aus Trainerangaben:**
  - Bewertung der Spielphasen je Spiel im Zeitverlauf (welche Phase klappt dauerhaft nicht)
  - Spielerbewertungen
  - gesetzte Trainingsschwerpunkte und ob sich danach etwas verändert
- **Grenzen:**
  - keine Schüsse, kein Ballbesitz, keine Laufdaten
  - Karten ohne Spielernamen
  - ausgewechselte Spieler unbekannt, daher keine genauen Einsatzminuten
  - kleine Stichproben (15 Ligaspiele je Halbserie)

## Produktideen aus „eigener Feder“ (Abstimmung 07.11.2026)

Hintergrund: Externe Spielberichte sind Kostentreiber (Sportmedia) und rechtlich heikel. Der Kern soll aus dem Wissen des Trainers entstehen; von außen nur Tabelle, Spielplan und Ergebnisse.

- **Zeit sparen**
  - Sprachnachricht → Dossier
  - Mannschaftsnachricht (WhatsApp-Text mit Treffpunkt, Ablauf, Kleidung, Kader) auf Knopfdruck
  - Nachbereitung per Sprachnachricht, inklusive Aufstellung, Torschützen und Minuten
- **Gedächtnis**
  - Gegner-Akte: Beobachtungen werden beim nächsten Duell vorgeschlagen, über Spielzeiten hinweg
  - Spielerakte: Noten, Einsätze, Minuten aus den Nachbereitungen
  - Blatt für Spielergespräche zur Halbserie
- **Vom Spiel zum Training**
  - **Spielidee („Trainer-Ich“):** dauerhaftes Profil mit Prinzipien je Spielphase. Die Dossierfolie „So spielen wir“ und die Bewertung in der Nachbereitung messen sich daran.
  - **Trainingsschwerpunkte:** Vorschlag aus der Nachbereitung, Trainer bestätigt.
  - **Wochenstruktur:** nach Trainingseinheiten pro Woche.
  - **Übungen:** Die KI erfindet keine Übungen. Sie wählt aus einer geprüften Bibliothek: eigene Übungen des Trainers, Übungen geteilt unter den Pilottrainern, lizenzierte oder verlinkte Quellen wie DFB-Trainingsinhalte (Nutzungsrechte klären). Die Übungen sind verschlagwortet nach Spielphase, Prinzip und Form. Die KI passt nur Spielerzahl und Feldgröße innerhalb fester Regeln an.
- **Verein und Vorstand**
  - Halbserien- und Saisonbericht als Präsentation
  - Trainerteam: Co-Trainer liefert Beobachtungen zu
- **Übungsaustausch unter Trainern:** Jeder Trainer erfasst seine bewährten Übungen per Sprachnachricht und Skizzenfoto als Übungskarte (Organisation, Ablauf, Coachingpunkte, Varianten, Schlagworte). Die Karten lassen sich mit anderen Trainern teilen. Eine gemeinsame, praxisgeprüfte Bibliothek ist zugleich ein Grund mitzumachen.
  - Offen: Wer darf was sehen (nur eigener Verein / alle Teilnehmer)? Namensnennung des Urhebers. Missbrauch melden.
- **Kommerzielle Übungsdatenbanken (Stand Recherche 07.11.2026):** easy2coach, fussballtraining.com, Advance Football, TacticTrain, Planet Training, Philippka „fussballtraining“. Das sind Endkunden-Abos zwischen etwa 5 und 15 € im Monat. Eine Einbindung in Coach.AI ginge nur über eine Lizenz- oder Kooperationsvereinbarung, die öffentlich nicht angeboten wird. Ansprechen, sobald es Pilottrainer gibt.
