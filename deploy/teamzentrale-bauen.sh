#!/usr/bin/env bash
# Läuft dauerhaft im Container „teamzentrale“: baut die Seite alle INTERVALL Sekunden (Standard 6 Stunden) neu.
# Arbeitsordner /arbeit (eigenes Volume): Schlüssel, Rohdaten, Mannschaftsprofil seed-state-all.json.
# Ergebnis: /ausgabe/teamzentrale.html (Daten-Volume der App). Schlägt ein Lauf fehl, bleibt die alte Seite.
set -u
W="${ARBEIT:-/arbeit}"; A="${AUSGABE:-/ausgabe}"; P="${PROTOTYP:-/app/prototype}"
mkdir -p "$W/real"
printf '%s' "${COACHAI_DATENDIENST_KEY:?fehlt}" > "$W/fdkey.txt"
# Vor dem ersten Lauf warten, bis der Datendienst antwortet (startet gleichzeitig mit uns).
for i in $(seq 1 60); do
  python3 -c "import urllib.request,os; urllib.request.urlopen(os.environ.get('FD_URL','http://datendienst:8000') + '/docs', timeout=5)" 2>/dev/null && break
  [ "$i" = 1 ] && echo "$(date '+%F %T') Warte auf den Datendienst …"
  sleep 5
done
# Warten bis zum nächsten Lauf; „Jetzt aktualisieren“ in 11Plan (Datei neu-bauen) verkürzt die Wartezeit.
warten() {
  local bis=$(( $(date +%s) + $1 ))
  while [ "$(date +%s)" -lt "$bis" ]; do
    if [ -f "$A/neu-bauen" ]; then rm -f "$A/neu-bauen"; echo "$(date '+%F %T') Aktualisierung in 11Plan angefordert."; return; fi
    sleep 10
  done
}
while true; do
  if [ ! -f "$W/seed-state-all.json" ]; then
    echo "$(date '+%F %T') Warte auf das Mannschaftsprofil $W/seed-state-all.json (einmalig hochladen, siehe docs/server-betrieb.md)."
    sleep 60; continue
  fi
  echo "$(date '+%F %T') Teamzentrale wird mit aktuellen Daten gebaut …"
  if bash "$P/bauen.sh" "$W" > "$W/letzter-lauf.log" 2>&1; then
    cp "$W/coach-ai-tsg.html" "$A/teamzentrale.html.neu" && mv "$A/teamzentrale.html.neu" "$A/teamzentrale.html"
    # Mannschaftsprofil als Startstand für das Spieltagsdossier
    cp "$W/seed-state-all.json" "$A/dossier-start.json"
    if grep -q '"nachholen": true' "$W/real/status.json" 2>/dev/null; then
      echo "$(date '+%F %T') Fertig. Ergebnis oder Spielbericht fehlen noch – nächster Versuch in 15 Minuten."
      warten 900
    else
      echo "$(date '+%F %T') Fertig. Nächster Lauf in $(( ${INTERVALL:-21600} / 3600 )) Stunden."
      warten "${INTERVALL:-21600}"
    fi
  else
    echo "$(date '+%F %T') Lauf fehlgeschlagen, die bisherige Seite bleibt. Letzte Meldungen:"
    tail -15 "$W/letzter-lauf.log"
    warten 300
  fi
done
