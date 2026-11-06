# fussball.de- und FuPa-Anbindung (inoffiziell, Übergangslösung)

Coach.AI liest fussball.de nicht selbst aus. Es fragt einen **lokal auf Ihrem Rechner laufenden Dienst** ab:
den quelloffenen Crawler [fussball_de_api](https://github.com/Zetabytes/fussball_de_api) (MIT-Lizenz, Python),
ergänzt um die **Coach.AI-Erweiterung** aus diesem Repository (`tools/fussballde-dienst/coachai_dienst.py`).
Der Dienst liest die öffentlichen Seiten von fussball.de, entschlüsselt die dort verschleierten Ergebnisse und Namen
und gibt sie als JSON aus. Zusätzlich liest er die öffentliche JSON-Schnittstelle der FuPa-Webseite (`api.fupa.net`)
für Spielerdaten und Fotos (`tools/fussballde-dienst/fupa_dienst.py`).

**Einordnung:** Inoffiziell. fussball.de verweist für automatisierte Daten auf Sportmedia; die Nutzungsbedingungen
sind nicht geprüft. Gedacht für die **eigene Mannschaft** mit wenigen Abrufen (nur auf Klick, mit Zwischenspeicher).
Daten werden in Coach.AI als „fussball.de (inoffiziell ausgelesen)“ gekennzeichnet. Entscheidung vom 05.11.2026:
vorerst dieser kostenfreie Weg statt Sportmedia.

## Was geliefert wird

Ein Klick auf **„Daten von fussball.de und FuPa laden“** füllt alle Datenblöcke außer der Fahrzeit:

| Datenblock | Quelle auf fussball.de | Hinweise |
| --- | --- | --- |
| Begegnung (Abgleich) | Spieltag und Spielplan | Datum, Anstoß, Spieltag, Spielort, Wettbewerb. Abweichungen werden markiert, „Angaben von fussball.de übernehmen“ gleicht an. |
| Tabelle | Tabelle der eigenen Staffel | Mit Team-IDs. Weist fussball.de auf Punktabzüge hin, wird die Höhe aus Bilanz und Punkten errechnet und so gekennzeichnet. |
| Spieltagspaarungen | Spieltagsübersicht der Staffel | Spieltag wird automatisch gesucht (ausgehend von Ihrer Angabe bzw. den Spielen laut Tabelle). |
| Ergebnisse eigene Mannschaft / Gegner | Spielplan der ganzen Saison | Liga, Pokal, Test; abgesagte/verlegte Spiele werden ausgelassen und gezählt. |
| Direkte Duelle | Spielpläne der laufenden und fünf früheren Saisons | Spiele gegen zweite Mannschaften zählen nicht. |
| Gegenspieler (Kandidaten) | **FuPa:** Kader mit Position, Einsätzen, Toren, Vorlagen, Kapitän, Foto; MVP-Wert mit Stand und Größe für die torgefährlichsten 8 Spieler. **fussball.de:** Torjägerliste und Spielberichte der letzten 5 Ligaspiele | FuPa vor fussball.de (Datenmodell E2). Weichen Torzahlen ab, steht das beim Spieler. Spieler, die nur fussball.de kennt, bleiben erhalten. |
| Tabelle (Abgleich) | FuPa-Tabelle derselben Liga | Zweite Quelle; Abweichungen zu fussball.de werden zeilenweise markiert. |
| Gegnerbezogene Fakten | Heim-/Auswärtstabelle, Torjägerliste, Spielbericht; Trainerteam laut FuPa | Z. B. „Auswärtstabelle: Platz 1 …“, bester Torschütze, Trainer. |
| Fahrzeit | – | Liefert fussball.de nicht; bitte selbst eintragen. |

**Gegner finden:** Ein Gegner-Link ist nicht mehr nötig. Coach.AI sucht den Gegner in der Tabelle der eigenen Liga,
sonst (z. B. im Pokal) über die Vereinssuche von fussball.de – jeweils die erste Mannschaft derselben Mannschaftsart
(z. B. Herren). Ein eingetragener Gegner-Link hat Vorrang.

**FuPa finden:** Die eigene Mannschaft über einen FuPa-Link im Mannschaftsprofil (Mannschaft → Links, Art „FuPa“)
oder automatisch über den Vereinsnamen (die abgeleitete Kennung wird bei FuPa geprüft, nicht geraten). Den Gegner
über die FuPa-Tabelle der eigenen Liga, sonst über den Vereinsnamen; ein FuPa-Link in der Begegnung hat Vorrang.

**Fotos:** Die Folie zeigt die Fotos direkt von FuPa mit Bildnachweis; ohne Foto erscheinen Initialen. Für den
PowerPoint-Export holt Coach.AI die Fotos über den lokalen Dienst und bettet sie ein. Bildrechte liegen bei FuPa bzw.
den Fotografen (Entscheidung des Trainers, Fotos zu verwenden: 06.11.2026).

**Ladezeit:** Der erste Abruf einer Begegnung dauert etwa **5–15 Sekunden** (eine Spielplanseite pro Saison,
dazu Tabelle, Spieltag und bis zu 5 Spielberichte). Danach kommen die Daten für einige Stunden in rund 1,5 Sekunden
aus dem Zwischenspeicher. Der Fortschritt wird beim Laden angezeigt.

**Live geprüft am 05.11.2026** mit TSG Wilhelmshöhe (Herren, Gruppenliga Kassel Gr. 2) gegen TSG Sandershausen.

## Einrichtung (einmalig, ca. 15 Minuten)

Voraussetzung: **Python 3.11 oder neuer** (python.org).

### 1. Crawler holen und einrichten

```bash
git clone https://github.com/Zetabytes/fussball_de_api.git
cd fussball_de_api
python -m venv venv
# Windows:      .\venv\Scripts\activate
# macOS/Linux:  source venv/bin/activate
pip install -r requirements.txt
cp .env.example .env        # Windows: copy .env.example .env
```

In der Datei `.env` des Crawlers einstellen:

```
API_KEY=<ein langes, selbst ausgedachtes Passwort>
# Kein Vorabladen im Hintergrund – nur Abrufe auf Klick:
PREWARM_CLUB_ID=
# Zwischenspeicher großzügig, damit fussball.de selten abgefragt wird:
CACHE_TTL_GAMES=21600
CACHE_TTL_TABLE=21600
CACHE_TTL_TEAMS=86400
CACHE_TTL_FONT=86400
CACHE_DIR=./cache
LOGOS_DIR=./logos
LOGO_BASE_URL=
```

### 2. Dienst mit Coach.AI-Erweiterung starten

Im Ordner `fussball_de_api` (venv aktiv), `<Pfad>` durch den Ordner von Coach.AI ersetzen:

```bash
# macOS/Linux
PYTHONPATH=<Pfad>/Coach.ai/tools/fussballde-dienst uvicorn coachai_dienst:app --port 8000
```

```powershell
# Windows (PowerShell)
$env:PYTHONPATH="<Pfad>\Coach.ai\tools\fussballde-dienst"; uvicorn coachai_dienst:app --port 8000
```

Fenster offen lassen. Test im Browser: http://127.0.0.1:8000/docs zeigt unter „Coach.AI“ die zusätzlichen Endpunkte.

### 3. Coach.AI mit dem Dienst verbinden

Im Ordner von Coach.AI eine Datei `.env.local` anlegen (wird nicht in Git gespeichert):

```
COACHAI_FUSSBALLDE_URL=http://127.0.0.1:8000
COACHAI_FUSSBALLDE_KEY=<dasselbe Passwort wie API_KEY oben>
```

Dann Coach.AI wie gewohnt starten: `npm run dev`. Der Schlüssel bleibt im Entwicklungsserver und wird nicht an
den Browser ausgeliefert.

### 4. Mannschaft verknüpfen und laden

1. **Mannschaft → Links:** fussball.de-Seite Ihrer Mannschaft einfügen. Der Link muss `team-id/…` enthalten
   (auf fussball.de die Mannschaftsseite öffnen und die Adresse kopieren).
2. **Neue Begegnung:** Gegnername eintragen (so ähnlich wie auf fussball.de genügt, Abkürzungen wie „KS“ oder
   „Eintr.“ werden erkannt). Datum hilft bei der Zuordnung; Spieltag und Anstoß können von fussball.de übernommen werden.
3. **Datenbasis prüfen → „Daten von fussball.de laden“**, danach ggf. „Angaben von fussball.de übernehmen“.

## Endpunkte der Coach.AI-Erweiterung

| Endpunkt | Inhalt |
| --- | --- |
| `GET /api/coachai/team/{team_id}/liga` | Staffel, Tabelle mit Team-IDs, Heim-/Auswärtstabelle, Hinweis auf Punktabzüge, Torjägerliste |
| `GET /api/coachai/team/{team_id}/saison?von=JJJJ-MM-TT&bis=JJJJ-MM-TT` | Alle Spiele im Zeitraum (höchstens 100) |
| `GET /api/coachai/staffel/{staffel}/spieltag/{n}` | Paarungen eines Spieltags mit Datum, Anstoß, Team-IDs, ggf. Ergebnis |
| `GET /api/coachai/spiele/aufstellungen?ids=a,b,…` | Aufstellungen, Trainer und Spielereignisse (höchstens 8 Spiele) |
| `GET /api/coachai/fupa/finde-team?namen=a\|b&saison=2026-27` | FuPa-Mannschaft über Vereinsnamen finden |
| `GET /api/coachai/fupa/team/{slug}` · `/fupa/tabelle?wettbewerb=&saison=` | FuPa-Mannschaft bzw. Tabelle |
| `GET /api/coachai/fupa/kader/{slug}` | Kader, Trainerteam, Kapitän, Fotoadressen |
| `GET /api/coachai/fupa/spieler?slugs=a,b&team=…` | MVP-Wert mit Stand, Größe, starker Fuß (höchstens 10) |
| `GET /api/coachai/fupa/foto?url=…` | Spielerfoto für den PowerPoint-Export (nur image.fupa.net) |

Alle Endpunkte verlangen den Header `X-API-Key`. Vereinslogos werden von der Erweiterung nicht heruntergeladen.

## Grenzen

- Funktioniert nur mit `npm run dev` (bzw. `npm run preview`) auf Ihrem Rechner, nicht in der Einzeldatei-Fassung
  und nicht im claude.ai-Link.
- Ändert fussball.de den Seitenaufbau, kann der Dienst ausfallen. Coach.AI meldet das und lässt die Angaben offen.
- Spieltagnummern einzelner Ergebnisse und Fahrzeiten liefert keine der beiden Quellen. Vorlagen, Positionen, MVP-Wert und Fotos kommen nur von FuPa – nur so gut, wie Verein bzw. Reporter sie dort pflegen.
- Später kann ein offizieller Sportmedia-Anbieter vor diesem Anbieter eingereiht werden (`src/data/registry.ts`).
