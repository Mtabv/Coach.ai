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

Alle Dateien liegen in `deploy/`. Die Einstellungen stehen in `deploy/.env`, die nur auf dem Server existiert (Vorlage: `deploy/.env.beispiel`).

## Teamzentrale

Nach der Anmeldung zeigt 11Plan die Teamzentrale mit den echten Daten der Mannschaft. Der Container `teamzentrale` baut sie **alle 6 Stunden selbst neu** (`deploy/teamzentrale-bauen.sh` mit `prototype/bauen.sh`):

1. Spielplan, Ergebnisse, Tabelle, Spielberichte und Kader über den internen Datendienst (fussball.de, FuPa).
2. Auswertungen, Fahrzeiten (OpenStreetMap), Fotos und Wappen.
3. Fertige Seite nach `/daten/teamzentrale.html` im Daten-Volume der App. Schlägt ein Lauf fehl, bleibt die bisherige Seite.

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

### Dossier als PDF

„Dossier als PDF“ in der Spielvorbereitung öffnet das Spieltagsdossier (`/?dossier=1`) mit dem Spiel aus der Teamzentrale: Datenbasis von fussball.de und FuPa laden, Trainerfragebogen, Dossier prüfen, bestätigen, dann PDF oder PowerPoint mit den Folien aus `docs/dossier-sollbild.md`. Den Startstand (Mannschaftsprofil) legt der Container `teamzentrale` als `/daten/dossier-start.json` ab, solange auf dem Server noch kein Dossier-Stand gespeichert ist.

### Speichern in der Teamzentrale

`src/teamzentrale/sync.ts` wird in die Seite eingebunden und speichert die Eingaben als Dokument `teamzentrale` auf dem Server (`/api/dokumente/teamzentrale`, die letzten 50 Stände bleiben erhalten):

- Etwa 1,5 Sekunden nach einer Änderung wird gespeichert; der Stand steht unten in der Seitenleiste.
- Alle 15 Sekunden und beim Zurückkehren in den Tab werden Änderungen der anderen Trainer geholt. Während jemand tippt, wartet der neue Stand, bis das Feld verlassen wird.
- Haben zwei Trainer gleichzeitig gespeichert, werden beide Änderungen zusammengeführt (`src/teamzentrale/merge.ts`). Nur wenn beide genau dieselbe Angabe unterschiedlich geändert haben, gilt die zuletzt gespeicherte.
- Kommt eine neue Datei mit neueren Daten von fussball.de und FuPa, bleiben die Eingaben erhalten und werden über die neuen Daten gelegt.

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
