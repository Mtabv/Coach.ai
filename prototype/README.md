# Klickbarer Entwurf: 11Plan Teamzentrale

Die Teamzentrale zeigt alle Bereiche als eine einzige HTML-Seite. Auf dem 11Plan-Server wird sie alle 6 Stunden mit aktuellen Daten neu gebaut und nach der Anmeldung ausgeliefert; Eingaben speichert dort `src/teamzentrale/sync.ts` (siehe `docs/server-betrieb.md`). Als einzelne Datei im Browser geöffnet, speichert sie nichts.

## Aufbau

| Ordner | Inhalt |
|---|---|
| `entwurf/basis.html` | Grundgerüst mit erfundenen Beispieldaten (Runden 1 bis 6 der Abstimmung) |
| `daten/fetch.py` | Lädt Spielplan, Tabelle, Spielberichte und Kader über den lokalen Datendienst (`tools/fussballde-dienst`) |
| `daten/build.py` | Rechnet daraus Statistik, feste Fakten, KI-Erkenntnisse, Fahrzeiten (OpenStreetMap), Fotos und Wappen (`real/data.js`) |
| `patches/r7_real.py` | Setzt die echten Daten in das Grundgerüst ein |
| `patches/r9…r28` | Alle späteren Ausbaustufen, in dieser Reihenfolge anzuwenden (r26: Zu- und Absagen, Formularelemente; r27: aktuelles Datum statt 11.11.2026; r28: Spielerprofil, Verletzungen und Abwesenheiten mit Zeitraum, Dossier als PDF; r29: Gastspieler im Training, hellere Links; r30: feste Spielerkennungen, Sprachaufnahme je Abschnitt) |
| `bauen.sh` | Führt alles nacheinander aus |

## Mit aktuellen Daten neu bauen

```bash
prototype/bauen.sh /pfad/zum/arbeitsordner
```

Der Arbeitsordner liegt bewusst **außerhalb des Repositorys**, weil er personenbezogene Daten enthält: Spielernamen, Fotos und die Eingaben des Trainerteams. Er braucht:

- `fdkey.txt`: den Schlüssel des lokalen Datendienstes, der auf Port 8000 laufen muss;
- `seed-state-all.json`: einen Export des App-Zustands mit dem Mannschaftsprofil (Zeitplan am Spieltag, Spielkleidung, Wappen).

Mit `NUR_BAUEN=1` wird ohne neuen Abruf aus vorhandenen Daten gebaut. Ergebnis ist `coach-ai-tsg.html` im Arbeitsordner. Die Datei lässt sich direkt im Browser öffnen oder als Seite veröffentlichen.

## Grenzen

- Alles, was man im Entwurf einträgt, ist nach dem Neuladen weg.
- Übungen, Einheiten, Periodisierung und Prinzipien sind Beispiele.
- Ins Repository gehört nur dieser Bauweg, nie die gebaute Datei mit echten Daten.
