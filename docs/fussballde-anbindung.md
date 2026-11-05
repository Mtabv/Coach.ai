# fussball.de-Anbindung (inoffiziell, Übergangslösung)

Coach.AI liest fussball.de nicht selbst aus. Es fragt einen **lokal auf Ihrem Rechner laufenden Dienst** ab:
den quelloffenen Crawler [fussball_de_api](https://github.com/Zetabytes/fussball_de_api) (MIT-Lizenz, Python).
Der Crawler liest die öffentlichen Seiten von fussball.de, entschlüsselt die dort verschleierten Ergebnisse
und Namen und gibt sie als JSON aus.

**Einordnung:** Inoffiziell. fussball.de verweist für automatisierte Daten auf Sportmedia; die Nutzungsbedingungen
sind nicht geprüft. Gedacht als Übergang für die **eigene Mannschaft** mit wenigen Abrufen, bis die Sportmedia-Anfrage
beantwortet ist. Daten werden in Coach.AI als „fussball.de (inoffiziell ausgelesen)“ gekennzeichnet.

## Was geliefert wird – und was nicht

| Liefert | Liefert nicht |
| --- | --- |
| Tabelle der eigenen Liga (Platz, Spiele, S/U/N, Tore, Punkte) | Punktabzüge als eigene Angabe |
| Vergangene Spiele der eigenen Mannschaft und des Gegners (Liga/Pokal/Test) | Spieltagspaarungen der ganzen Liga |
| Kommende Spiele mit Datum, Uhrzeit und Spielort (Abgleich mit Ihrer Spielanlage) | Spieltagnummern |
| Direkte Duelle, soweit in diesen Listen enthalten | Spielerstatistiken, Gegenspieler, Fotos |

Hinweis: Die Spielliste je Mannschaft umfasst vermutlich nur die letzten Spiele (erste Seite). Ist sie kürzer als die
Zahl der Spiele laut Tabelle, übernimmt Coach.AI die Saisonbilanz aus der Tabelle und markiert Heim-/Auswärtsbilanz als
„unvollständig“.

**Live geprüft am 05.11.2026** mit TSG Wilhelmshöhe (Herren, Gruppenliga) gegen TSG Sandershausen: Tabelle, je 10 letzte
Spiele beider Mannschaften, Ansetzung mit Spielort und Anstoßabgleich kamen korrekt an. Der **erste Abruf dauert 1–2 Minuten**
(der Crawler lädt Schriftdateien und Vereinslogos), danach wenige Sekunden aus dem Zwischenspeicher.

Schreibweisen: fussball.de kürzt Namen ab („GSV Eintr.Baunatal“, „SV Türkgücü KS“) und streut unsichtbare Zeichen ein.
Coach.AI gleicht das beim Zuordnen aus; angezeigt wird die Schreibweise von fussball.de.

Team-IDs finden: Der Crawler hat eine Vereinssuche, z. B. `http://127.0.0.1:8000/api/search/clubs?query=Sandershausen`
(Header `X-API-Key`), danach `/api/club/<Vereins-ID>/teams` – dort steht der fussball.de-Link jeder Mannschaft.

## Einrichtung (einmalig, ca. 15 Minuten)

Voraussetzung: **Python 3.11 oder neuer** (python.org) – oder Docker.

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
```

### 2. Crawler starten

```bash
uvicorn fussball_api.main:app --port 8000
```

Fenster offen lassen. Test im Browser: http://127.0.0.1:8000 zeigt eine kurze Begrüßung.

### 3. Coach.AI mit dem Crawler verbinden

Im Ordner von Coach.AI eine Datei `.env.local` anlegen (wird nicht in Git gespeichert):

```
COACHAI_FUSSBALLDE_URL=http://localhost:8000
COACHAI_FUSSBALLDE_KEY=<dasselbe Passwort wie API_KEY oben>
```

Dann Coach.AI wie gewohnt starten: `npm run dev`. Der Schlüssel bleibt im Entwicklungsserver und wird nicht an
den Browser ausgeliefert.

### 4. Links hinterlegen

1. **Mannschaft → Links:** fussball.de-Seite Ihrer Mannschaft einfügen. Der Link muss `team-id/…` enthalten
   (auf fussball.de die Mannschaftsseite öffnen und die Adresse kopieren).
2. **Neue Begegnung bzw. Begegnung bearbeiten:** fussball.de-Link des Gegners einfügen.
   Den Gegnernamen möglichst so schreiben wie auf fussball.de.
3. **Datenbasis prüfen → „Daten von fussball.de laden“.**

## Grenzen

- Funktioniert nur mit `npm run dev` (bzw. `npm run preview`) auf Ihrem Rechner, nicht in der Einzeldatei-Fassung
  und nicht im claude.ai-Link.
- Ändert fussball.de den Seitenaufbau, kann der Crawler ausfallen. Coach.AI meldet das und lässt die Angaben offen.
- Später wird der offizielle Sportmedia-Anbieter vor diesem Anbieter eingereiht (`src/data/registry.ts`).
