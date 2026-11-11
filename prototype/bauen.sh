#!/usr/bin/env bash
# Baut den klickbaren Entwurf mit echten Mannschaftsdaten.
# Aufruf:  prototype/bauen.sh <arbeitsordner>
# Der Arbeitsordner liegt außerhalb des Repositorys (personenbezogene Daten) und enthält:
#   fdkey.txt            Schlüssel des lokalen Datendienstes (tools/fussballde-dienst, Port 8000)
#   seed-state-all.json  Export des App-Zustands (Mannschaftsprofil mit Zeitplan, Spielkleidung, Wappen)
# Ergebnis: <arbeitsordner>/coach-ai-tsg.html
# Mit NUR_BAUEN=1 werden vorhandene Daten (real/data.js) ohne neuen Abruf verwendet.
set -euo pipefail
W="$(cd "$1" && pwd)"; D="$(cd "$(dirname "$0")" && pwd)"
mkdir -p "$W/real"
if [ "${NUR_BAUEN:-0}" != "1" ]; then
  python3 "$D/daten/fetch.py" "$W"     # Spielplan, Tabelle, Spielberichte, Kader von fussball.de und FuPa
  python3 "$D/daten/build.py" "$W"     # Auswertungen, Fakten, Fahrzeiten, Fotos und Wappen -> real/data.js
fi
python3 "$D/patches/r7_real.py" "$D/entwurf/basis.html" "$W/real/data.js" "$W/coach-ai-tsg.html"
for n in 9 10 11 12 13 14 15 16 17 18 19 20 21 22 23 24 25 26 27; do
  python3 "$D/patches/r${n}_patch.py" "$W/coach-ai-tsg.html" > /dev/null
done
echo "Fertig: $W/coach-ai-tsg.html"
