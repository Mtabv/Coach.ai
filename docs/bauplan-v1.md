# Bauplan Coach.AI, Version 1: Trainerteam

Stand 11.11.2026. Grundlage ist der klickbare Entwurf in `prototype/`. Version 1 ist nur für das Trainerteam (zwei Logins: Trainer und Co-Trainer). Spieler, Push-Nachrichten und KI-Texte kommen in Version 2.

## Ziel

Trainer und Co-Trainer planen, bereiten vor und nach, gemeinsam und mit denselben Daten, über eine eigene Adresse auf einem eigenen Hetzner-Server. Daten von fussball.de und FuPa werden auf dem Server abgerufen und zwischengespeichert.

## Bereiche in Version 1

| Bereich | Inhalt | Quelle der Daten |
|---|---|---|
| Dashboard | Wochenleiste (anklickbar, Plus je Tag), Spiel, Training, Kommunikation (Gesprächsimpulse, Lob), Erkenntnisse aus den Zahlen, Schnelleinstieg, Administratives, Trainerteam | alle Bereiche |
| Training | Schwerpunkt der Woche, aktuelle und kommende Trainingswoche, Einzeltraining mit Ablauf, Teilnahme, Skizzen; Einheiten, Übungspool (Karten), Periodisierung; Masken „Übung erfassen“ und „Einheit zusammenstellen“; Training nachbereiten mit Erfahrungswerten | Trainereingaben |
| Kalender | Woche und Monat, Plus je Tag für Training und Termine (Hallenturnier, Abteilungsveranstaltung …), Gespräche, Dienste, Abwesenheiten | Rhythmus aus Einstellungen, Spielplan von fussball.de |
| Spieltag | Kommende Spiele (nächstes hervorgehoben, Rest aufklappbar), gespielte Spiele, Pokal farbig | fussball.de |
| Spielvorbereitung | Spiel und Treffpunkt (errechnet, Fahrzeit per OpenStreetMap), Tabelle und Form, Zeitplan und Kleidung, feste Fakten, KI-Erkenntnisse (änderbar), Trainerfragebogen, Auftrag, Kader, Aufstellung (optional), Dossier als PDF | fussball.de, Einstellungen, Trainer |
| Nachbereitung | Spielverlauf mit Kommentaren je Tor, Fragen mit „neu generieren“, Prinzipien bewerten, Noten für Startelf und Eingewechselte | fussball.de, Trainer |
| Kader | sortierbar: Im Kader, Einsätze, Minuten, Startelf, Tore, Vorlagen, Ø Note | FuPa, fussball.de, Nachbereitungen |
| Kommunikation | Übersicht, Spielergespräche (vorbereiten, planen, abhaken, Historie, wiederkehrende Runden), Trainerteam-Notizen | Trainer, Regeln auf den Daten |
| Analytics | Mannschaft (Wettbewerbe wählbar, Torminuten gegen Ligaschnitt, Tabelle), Spieler (Minuten, Ø pro Einsatz), Spielervergleich | fussball.de, FuPa |
| Spielphilosophie | Leitfragen, Prinzipien je Spielphase, Ausprägung aus den Nachbereitungen | Trainer |
| Einstellungen | Training (Rhythmus, Grenzen), Spieltag und Dossier (Ablauf mit Dauer, Kleidung), Mannschaft, Rollen und Rechte, Spielergespräche (Runden), Datenquellen | Trainer |

Nicht in Version 1: Spielersicht, persönliche Links, Zu- und Absagen durch Spieler, Push und E-Mail, Mannschaftsnachricht versenden, KI-Texte über die Claude API.

## Technik

- **Oberfläche:** die bestehende React-App aus diesem Repository, um die Bereiche des Entwurfs erweitert.
- **Server:** ein kleiner Node-Server (TypeScript) mit Login für zwei Konten und einer SQLite-Datenbank (eine Datei, einfache Sicherung).
- **Datendienst:** `tools/fussballde-dienst` als eigener Container, nur intern erreichbar, mit Zwischenspeicher.
- **Fahrzeiten:** OpenStreetMap (Nominatim und OSRM), Ergebnis wird gespeichert.
- **Betrieb:**
  - Docker Compose, Caddy für HTTPS, eigene Domain.
  - Eigener Server bei Hetzner, getrennt vom bestehenden Server mit dem digitalen Assistenten.
  - Tägliche Sicherung der Datenbank zusätzlich zu den Hetzner-Backups.
- **Aktualisieren:** GitHub Actions spielt nach Freigabe auf dem Hauptzweig automatisch auf. Der Schlüssel liegt nur als GitHub-Secret vor.

## Reihenfolge

1. Grundgerüst: Login, Datenbank, Datendienst, Einstellungen, Kader. Login, Datenbank, Container und automatisches Aufspielen stehen (siehe `docs/server-betrieb.md`).
2. Kalender und Training.
3. Spieltag: Vorbereitung (Dossier aus der bestehenden App), Nachbereitung.
4. Analytics, Kommunikation, Spielphilosophie.

Jede Stufe geht nach Freigabe sofort auf den Server, damit Trainer und Co-Trainer früh testen können.

## Entschieden

- Verantwortlich im Sinne des Datenschutzes ist der Trainer persönlich (Variante A, siehe `docs/datenschutz/avv-hetzner.md`).
- Server: Hetzner Cloud CPX22 (2 vCPU, 4 GB RAM), eigenes Projekt, getrennt vom Server mit dem digitalen Assistenten.

## Offene Entscheidungen

- Domainname.
- Trainingsdauer (angenommen 90 Minuten), Auswärts- und Aufwärmkleidung.
