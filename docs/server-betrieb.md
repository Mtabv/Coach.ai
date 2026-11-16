# Server-Betrieb, Version 1 (Trainerteam)

11Plan läuft auf einem eigenen Hetzner-Server, getrennt vom Server mit dem digitalen Assistenten. Die Schritt-für-Schritt-Anleitung zum Einrichten steht in `docs/hetzner-anleitung.html`.

## Servergröße

Hetzner Cloud **CPX22** (2 vCPU, 4 GB RAM). Der Server baut bei jedem Update die App selbst; mit 2 GB (CPX12) kann das knapp werden. Hochstufen geht später in der Cloud Console unter „Rescale“ mit einem Neustart.

## Bausteine

| Container | Aufgabe | Von außen erreichbar |
|---|---|---|
| `caddy` | HTTPS mit automatischem Zertifikat für die eigene Domain | ja, Port 80 und 443 |
| `app` | Oberfläche, Login, gemeinsamer Datenstand (SQLite), Weiterleitung zum Datendienst | nein, nur über Caddy |
| `datendienst` | Abruf von fussball.de und FuPa mit Zwischenspeicher | nein |
| `teamzentrale` | baut die Teamzentrale mit den aktuellen Daten | nein |
| `sprachdienst` | Diktieren: Sprachaufnahme in Text (Whisper, läuft auf dem eigenen Server) | nein |

Alle Dateien liegen in `deploy/`. Die Einstellungen stehen in `deploy/.env`, die nur auf dem Server existiert (Vorlage: `deploy/.env.beispiel`).

## Teamzentrale

Nach der Anmeldung zeigt 11Plan die Teamzentrale mit den echten Daten der Mannschaft. Der Container `teamzentrale` baut sie **alle 6 Stunden selbst neu** (`deploy/teamzentrale-bauen.sh` mit `prototype/bauen.sh`):

1. Spielplan, Ergebnisse, Tabelle, Spielberichte und Kader über den internen Datendienst (fussball.de, FuPa).
2. Auswertungen, Fahrzeiten (OpenStreetMap), Fotos und Wappen.
3. Fertige Seite nach `/daten/teamzentrale.html` im Daten-Volume der App. Schlägt ein Lauf fehl, bleibt die bisherige Seite.

**Nur Neues laden:** Jeder Lauf holt Tabelle, Spielplan und FuPa-Kader neu (je ein Abruf) und nur die Spielberichte von Spielen, die seit dem letzten Lauf gespielt wurden, dazu die noch offenen Spieltage. Alte Spielberichte, Fotos, Wappen, Vereinssuche und Fahrzeiten liegen im Zwischenspeicher (`/arbeit/real/raw.json`, `/arbeit/real/cache.json`). Ein normaler Lauf dauert damit Sekunden statt Minuten; ein Lauf ohne Zwischenspeicher liefert nachweislich dieselben Daten.

**Nach dem Abpfiff:** Zwei Stunden nach Anstoß gilt ein Spiel als gespielt (Nachbereitung statt Vorbereitung), auch wenn fussball.de noch nichts hat. Solange Ergebnis oder Spielbericht fehlen oder unvollständig sind (Abpfiff, beide Aufstellungen, alle Torschützen), fragt der Server alle 15 Minuten nach statt alle 6 Stunden. Der Knopf „Daten aktualisieren“ legt `/daten/neu-bauen` ab; der Bau-Container startet dann sofort, die Seite lädt danach von selbst neu.

**Selbstkontrolle:** Der Datendienst prüft sich jede Minute selbst (`deploy/datendienst-start.sh`). Antwortet er dreimal nicht, beendet er sich und Docker startet ihn neu. `docker compose ps` zeigt für `app` und `datendienst` „healthy“ oder „unhealthy“.

**Datenstand:** Unten in der Seitenleiste steht „Daten von fussball.de und FuPa: heute 13:04“. Ist der letzte erfolgreiche Lauf älter als einen Tag, erscheint dort ein Hinweis.

Die Seite enthält Namen und Fotos und liegt deshalb **nur auf dem Server**, nie im Repository. Datum, Woche, nächstes Spiel und nächstes Training richten sich nach dem aktuellen Tag.

**Einmalig** braucht der Container das Mannschaftsprofil (Zeitplan am Spieltag, Spielkleidung, Wappen):

```bash
# Auf dem Laptop
scp ~/Downloads/seed-state-all.json root@116.203.28.104:/root/
# Auf dem Server
cd /opt/coachai/deploy && docker compose cp /root/seed-state-all.json teamzentrale:/arbeit/seed-state-all.json
```

Nützlich:

```bash
docker compose logs -f teamzentrale     # Was macht der Bau gerade?
docker compose restart teamzentrale     # Sofort neu bauen, z. B. direkt nach einem Spiel
```

Der Server passt die Seite beim Ausliefern an: dunkler Modus, Schriften vom eigenen Server, Kontomenü mit „Trainer einladen“ und „Abmelden“. Solange noch keine Seite gebaut ist, erscheint die ältere Oberfläche.

### Spieltagsdossier als Reiter der Spielvorbereitung

Die Spielvorbereitung hat die Reiter „Gegnervorbereitung“, „Aufstellung“ und „Dossier“. Der Reiter „Dossier“ zeigt das Spieltagsdossier (`/?dossier=1&tz=<Spiel>`) eingebettet, ohne eigenes Fenster und ohne eigene Kopfzeile, in drei Schritten: Daten von fussball.de laden, Folien ansehen und anpassen, abschließen und exportieren (PDF über die Druckansicht, PowerPoint).

- Das Dossier übernimmt bei jedem Öffnen, was in der Gegnervorbereitung steht (`src/ui/zugang/vorbereitung.ts`): Gegnerbeobachtung und Plan nach Spielphasen (gleiche Frage-Kennungen), drei Botschaften (je Zeile eine), Leitmotiv, Merksätze (leer = keine), Kleidung und Kader. Leere Felder ändern im Dossier nichts. Den eigenen Fragebogen des Dossiers gibt es eingebettet nicht mehr.
- „Spieltagsdossier abschließen“ am Ende der Gegnervorbereitung springt direkt zum Abschluss. Der Abschluss friert die Version ein und meldet ihn an die Teamzentrale (`postMessage`, nur gleiche Adresse); dort steht dann „Dossier ✓“ und das Spiel gilt als vorbereitet.
- Damit das Einbetten klappt, erlaubt Caddy Rahmen nur von der eigenen Adresse (`X-Frame-Options SAMEORIGIN`).
- Daten je Spiel: Hinter dem Spieltitel steht „✓ Daten geladen · Stand“ mit „aktualisieren“ oder „Daten noch nicht geladen – jetzt laden“. Geladen wird über das Dossier (unsichtbar im Hintergrund, `&laden=1`); es meldet den Stand erst, wenn er auf dem Server gespeichert ist. Beim ersten Öffnen lädt das Dossier die Daten selbst.
- Wappen: Die Teamzentrale ordnet die FuPa-Wappen über den Vereinsnamen zu (Abkürzungen wie „KS“, „Eintr.“), nicht über den Tabellenplatz – FuPa und fussball.de sind oft unterschiedlich weit.
- Den Startstand (Mannschaftsprofil) legt der Container `teamzentrale` als `/daten/dossier-start.json` ab, solange auf dem Server noch kein Dossier-Stand gespeichert ist.

### Speichern in der Teamzentrale

`src/teamzentrale/sync.ts` wird in die Seite eingebunden und speichert die Eingaben als Dokument `teamzentrale` auf dem Server (`/api/dokumente/teamzentrale`, die letzten 50 Stände bleiben erhalten):

- Etwa 1,5 Sekunden nach einer Änderung wird gespeichert; der Stand steht unten in der Seitenleiste.
- Alle 15 Sekunden und beim Zurückkehren in den Tab werden Änderungen der anderen Trainer geholt. Während jemand tippt, wartet der neue Stand, bis das Feld verlassen wird.
- Haben zwei Trainer gleichzeitig gespeichert, werden beide Änderungen zusammengeführt (`src/teamzentrale/merge.ts`). Nur wenn beide genau dieselbe Angabe unterschiedlich geändert haben, gilt die zuletzt gespeicherte.
- Kommt eine neue Datei mit neueren Daten von fussball.de und FuPa, bleiben die Eingaben erhalten und werden über die neuen Daten gelegt.

### Wer hat was geändert?

`src/teamzentrale/autoren.ts` merkt sich bei jedem Speichern, welche Einträge **der angemeldete Trainer** seit dem letzten Abgleich geändert hat (Texte, Noten, Bewertungen, Trainingseinheiten, Übungen, Kader je Spiel …), und legt Name und Zeit in `state.autoren` ab. Änderungen des anderen Trainers kommen mit dessen Stempel herein. Anzeige: farbiger Rand am Feld und „✎ Name · Zeit“ darunter, „Zuletzt bearbeitet von … am … um …“ in Training und Übung, Name mit Farbpunkt an den Trainingskarten in Kalender und Dashboard, Farb-Legende in der Seitenleiste. Vorbelegungen der Seite (z. B. Kleidung, Gesprächsanlass) zählen nicht als Änderung.

### Neue Daten nach einem Spiel

Gesprächsimpulse und KI-Erkenntnisse werden aus den Daten des letzten Baus berechnet. Die Seite fragt alle 5 Minuten nach, ob der Server neu gebaut hat; dann erscheint „Neue Daten … – Jetzt neu laden“, und beim nächsten Zurückkehren zur Seite lädt sie selbst neu, wenn alles gespeichert ist. Noten aus den Nachbereitungen zählen für die Impulse „zuletzt schwächere/starke Noten“. Die KI-Erkenntnisse gehören zum nächsten Spiel: Beim nächsten Gegner wird neu ausgewählt, Handänderungen verfallen. „Gespräch nicht nötig“ blendet einen Impuls für drei Wochen aus.

### Diktieren

Pro Eingabemaske gibt es **ein** Mikrofon („Diktieren“, oben rechts auf der Seite bzw. im Kopf eines offenen Dialogs): antippen, alles für diese Seite am Stück erzählen, „Fertig“. Whisper macht Text daraus, die KI (siehe unten) verteilt ihn auf alle Textfelder der Maske; Textfelder bekommen den Text angehängt, einzeilige Felder werden nur gefüllt, wenn sie leer sind. Ohne KI-Schlüssel landet der Text im zuletzt benutzten Feld. In „Übung erfassen“ heißt der Knopf „Ganze Übung diktieren“ und kennt die Felder genauer. Karten mit Auswahlfeldern bekommen einen eigenen Knopf, zuerst „Noten diktieren“ in der Nachbereitung (Note 1–6 und Begründung je Spieler, z. B. „Max Muster eine Zwei, sicher im Aufbau“). Gemeinsamer Code: `src/sprache/aufnahme.ts`, `src/sprache/maskenKi.ts`; Teamzentrale `src/teamzentrale/maskenDiktat.ts`, Dossier `src/ui/sprache/MaskenDiktatKnopf.tsx`.

- Die Aufnahme geht über `/api/sprache` (nur angemeldet) an den Container `sprachdienst` (`tools/sprachdienst/`, faster-whisper). Sie verlässt den Server nicht und wird nicht gespeichert; es gibt kein Protokoll mit Inhalten.
- Modell: `small` (etwa 460 MB, einmal beim ersten Start geladen und im Volume `sprach-modelle` abgelegt). Anderes Modell über `WHISPER_MODELL` in `deploy/.env`: `base` ist schneller, `medium` genauer, braucht aber deutlich mehr Speicher.
- Speichergrenze des Containers 2 GB. Das Modell wird mit einer eigenen Sperre geladen (früher konnte es beim Start doppelt geladen werden, dann beendete Docker den Container wegen Speichermangels und die App meldete „Sprachdienst nicht erreichbar“).
- Das Modell belegt im Betrieb etwa 0,8 GB Arbeitsspeicher und wird nach 20 Minuten ohne Diktat wieder freigegeben. 30 Sekunden Sprache brauchen je nach Serverauslastung etwa 10 bis 20 Sekunden.
- Damit Namen richtig geschrieben werden, schickt die Seite die Spielernamen aus dem Kader als Hinweis mit.
- Der Browser fragt beim ersten Mal nach dem Mikrofon. Das geht nur über HTTPS (also auf der echten Adresse).

### KI-Verteilung („Ganze Übung diktieren“)

In „Übung erfassen“ (Übungspool und eigene Seite) steht „Ganze Übung diktieren“: frei erzählen, „Fertig“ antippen. Whisper macht daraus Text (eigener Server), Claude Sonnet 5.5 verteilt ihn auf Name, Art, Prinzip, Spieler, Feld, Dauer, Aufbau, Ablauf, Ziel, Coaching und Variationen. Die Felder werden nur vorausgefüllt und grün markiert; gespeichert wird erst mit „Übung speichern“. Steht in einem Textfeld schon etwas, wird angehängt.

- Einschalten: `ANTHROPIC_API_KEY=…` in `deploy/.env`, dann `docker compose up -d`. Ohne Schlüssel meldet der Knopf „KI noch nicht eingerichtet“; alles andere läuft normal.
- Server: `server/src/ki.ts` (offizielle Anthropic-Bibliothek, Antwort als festes JSON-Schema mit genau den Feldern der Maske, Auswahlfelder nur mit erlaubten Werten), Endpunkte `GET /api/ki/status` und `POST /api/ki/verteilen` (nur angemeldet, höchstens 60 je Trainer und Stunde).
- Fällt die KI aus (Guthaben leer, Limit erreicht, Schlüssel falsch), steht der erkannte Text im Feld „Ablauf“ und eine verständliche Meldung erscheint.
- Datenschutz und Kosten: `docs/datenschutz/avv-anthropic.md`, `docs/kosten.md`.

## Login

Es gibt keinen fremden Anmeldedienst. 11Plan verwaltet die Konten selbst. Alle im Trainerteam heißen „Trainer“ und haben dieselben Rechte.

1. **Erstes Konto:** Beim ersten Aufruf der Adresse fragt 11Plan nach dem Einrichtungsschlüssel aus `deploy/.env`. Nur wer Zugang zum Server hat, kennt ihn. Danach ist diese Maske für immer zu.
2. **Weitere Trainer:** Ein angemeldeter Trainer klickt oben rechts auf den Kreis mit seinen Initialen, dann auf „Trainer einladen“, und schickt den Link weiter. Der Link gilt 7 Tage und nur einmal. Der Eingeladene legt darüber sein eigenes Konto mit eigenem Passwort an.
3. **Anmelden:** E-Mail und Passwort. Die Anmeldung gilt 30 Tage auf diesem Gerät. Nach 8 falschen Versuchen in 15 Minuten wird gebremst.

Technisch:

- Passwörter werden nur als scrypt-Hash gespeichert.
- Das Sitzungs-Cookie ist `HttpOnly`, `Secure` und `SameSite=Strict`.
- Ändernde Anfragen brauchen zusätzlich einen eigenen Kopf (`X-CoachAI`), damit fremde Seiten nichts auslösen können.

## Gemeinsamer Datenstand

- Beide Konten arbeiten auf demselben Stand. Gespeichert wird automatisch etwa eine Sekunde nach der letzten Änderung.
- Jeder Speichervorgang trägt die Version, auf der er beruht. Hat ein anderer Trainer inzwischen gespeichert, wird nichts überschrieben. 11Plan zeigt dann einen Hinweis mit „Neuesten Stand laden“.
- Neue Stände der anderen Trainer werden alle 30 Sekunden und beim Zurückkehren in den Tab geholt.
- Die letzten 50 Stände bleiben in der Datenbank erhalten.
- Ist der Server beim ersten Anmelden noch leer, übernimmt 11Plan die vorhandenen Daten aus diesem Browser.

## Sicherungen

- **Hetzner-Backups:** täglich, ganzer Server, 7 Stände (in der Cloud Console einschalten).
- **11Plan selbst:** alle 6 Stunden, eine Datei je Tag, 14 Tage. Ort im Container `app`: `/daten/sicherungen/`.

Eine Sicherung auf den Laptop holen:

```bash
docker compose cp app:/daten/sicherungen ./sicherungen
```

## Aktualisieren

Freigabe heißt: Änderungen werden in den Zweig `main` übernommen. Dann prüft GitHub Actions (`.github/workflows/deploy.yml`) Typen und Tests und spielt per SSH auf den Server:

```bash
git reset --hard origin/main
docker compose up -d --build
```

Dafür braucht es die Repository-Secrets `DEPLOY_HOST`, `DEPLOY_USER` und `DEPLOY_SSH_KEY`. `DEPLOY_KNOWN_HOSTS` ist optional und enthält den Fingerabdruck des Servers. Ohne `DEPLOY_HOST` wird nur geprüft, nicht aufgespielt.

Von Hand auf dem Server:

```bash
cd /opt/coachai && git pull && cd deploy && docker compose up -d --build
```

## Nachsehen, wenn etwas hakt

```bash
cd /opt/coachai/deploy
docker compose ps            # laufen alle drei?
docker compose logs -f app   # Meldungen der App
docker compose logs caddy    # Zertifikat und Domain
```

## Lokal entwickeln

- `npm run dev`: Oberfläche ohne Server. Speichert im Browser, wie bisher.
- `npm run build && npm run build:server`, dann `COACHAI_HTTPS=0 COACHAI_FRONTEND=dist COACHAI_EINRICHTUNGSSCHLUESSEL=test npm run server`: App mit Login auf Port 3000.

## Absicherung

Angriffsversuche lassen sich bei einem Server im Internet nicht verhindern: Jede öffentliche Adresse wird innerhalb von Minuten automatisch abgetastet. Ziel ist, dass diese Versuche ins Leere laufen.

| Ebene | Maßnahme |
|---|---|
| Netz | Hetzner-Firewall vor dem Server: eingehend nur 22, 80, 443 (TCP) und 443 (UDP). Docker kann diese Firewall nicht umgehen, weil sie außerhalb des Servers liegt. Nur Caddy hat Ports nach außen; App und Datendienst sind nur intern erreichbar. |
| Zugang zum Server | Nur mit SSH-Schlüssel, Passwort-Login aus. Rateversuche gegen Port 22 sind damit aussichtslos und stehen nur im Protokoll. |
| Updates | Sicherheitsupdates automatisch, Neustart bei Bedarf nachts um 4 Uhr. |
| Konten | Zwei-Faktor-Anmeldung bei Hetzner und GitHub. |
| 11Plan | HTTPS mit HSTS, Passwörter als scrypt-Hash, Bremse nach 8 Fehlversuchen, Cookies `HttpOnly`/`Secure`/`SameSite=Strict`, Schutzkopf gegen fremde Seiten, erstes Konto nur mit Einrichtungsschlüssel. |
| Ernstfall | Hetzner-Backups (7 Tage) und eigene Datenbanksicherung (14 Tage). |

Bewusst nicht gemacht:
- **SSH nur von der eigenen IP:** Die Adresse zu Hause wechselt, und GitHub braucht für das Aufspielen ebenfalls Port 22.
- **fail2ban:** Bei reinem Schlüssel-Login bringt es kaum zusätzlichen Schutz.
