# Coach.AI – Vorschau

Anwendung für Fußballtrainer im Amateurbereich. Erster Anwendungsfall: **individuelles Spieltagsdossier**
(11 Seiten) aus Spiel- und Gegnerdaten, Mannschaftsstandards, Trainerbeobachtungen und Trainerbotschaften.

Die Vorschau läuft vollständig im Browser: keine Anmeldung, keine API-Schlüssel, keine Online-Recherche.
Alle Daten werden lokal im Browser (localStorage) gespeichert.

## Starten

```bash
npm install
npm run dev          # http://localhost:5173
```

Prüfungen:

```bash
npm test             # Fachlogik + PPTX-Export (Vitest)
npm run typecheck
npm run e2e          # End-to-End mit Playwright, Vorschau muss laufen (BASE_URL optional)
```

## Ablauf

1. **Mannschaft** einrichten (Stammdaten, Links, Heimspielort, Zeitmuster, Kleidung, Vorlage, Kader).
2. **Spieltag**: Begegnung auswählen oder neu anlegen. Der historische Referenzfall
   TSG Wilhelmshöhe – GSV Eintracht Baunatal (23.10.2026) ist fest hinterlegt und gekennzeichnet.
3. **Datenbasis prüfen**: Quelle, fachlicher Datenstand, Abrufzeitpunkt und Prüfstatus je Block
   (vorhanden / fehlend / veraltet / widersprüchlich / bestätigt). Widersprüche löst nur der Trainer auf.
4. **Trainerfragebogen** (15 Fragen, A–D), adaptiv, automatisch gespeichert, „Nicht bekannt“ zulässig,
   Diktat nur bei vorhandener Browser-Spracherkennung.
5. **Dossier** prüfen und bearbeiten (11 Seiten, markierte Lücken und Konflikte).
6. **Bestätigen & exportieren**: Prüfungen, Bestätigung (eingefroren), PPTX-Download, Druckansicht → „Als PDF speichern“, Archiv.

## Architektur

| Ordner | Inhalt |
| --- | --- |
| `src/domain` | Datenmodell (`types.ts`), deterministische Berechnungen: Zeitplan, Bilanzen, Kennzahlen, Datenprüfung, Fragebogen-Logik, Bestätigungsprüfungen |
| `src/data` | Datenanbieter-Schnittstelle (`provider.ts`), Demo-Anbieter mit **fiktiven** Beispieldaten, Startzustand |
| `src/ai` | Schnittstelle für spätere KI-Funktionen; in der Vorschau nur regelbasierte Textübernahme (ausdrücklich keine KI) |
| `src/dossier` | Darstellungsunabhängiges Dossiermodell, Aufbau aus den Daten, Textüberschreibungen |
| `src/export` | PPTX-Export (PptxGenJS, native Textfelder und Tabellen) |
| `src/state`, `src/storage` | Zustandsänderungen (rein, testbar) und lokale Speicherung |
| `src/ui` | Oberfläche (React) |

Erweiterungen (Spielnachbereitung, Trainingsableitung, Halbserienanalyse, SpielerPlus, Veo …) sind
über `extensions` an Mannschaft, Spiel und Vorbereitung sowie über die Anbieter-Schnittstellen vorgesehen.
Echte Datenanbieter und KI gehören auf einen Server – keine Schlüssel im Frontend.

## Bekannte Grenzen der Vorschau

- Keine Live-Recherche (fussball.de/FuPa); nur der Referenzfall hat Beispieldaten, sonst manuelle Ergänzung als Freitext.
- PDF entsteht über den Druckdialog des Browsers.
- PPTX: Schrift Calibri, Layout an die HTML-Vorschau angelehnt; sehr lange Texte können in PowerPoint überlaufen.
- Layoutwünsche (Frage 13) werden festgehalten; umgesetzt wird nur das Ein-/Ausblenden von Seiten in der Vorlage.
- Daten liegen nur in diesem Browser; kein Abgleich zwischen Geräten.
