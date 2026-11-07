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
