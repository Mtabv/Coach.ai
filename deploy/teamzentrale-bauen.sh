#!/usr/bin/env bash
# Läuft dauerhaft im Container „teamzentrale“: baut die Seite alle INTERVALL Sekunden (Standard 6 Stunden) neu.
# Arbeitsordner /arbeit (eigenes Volume): Schlüssel, Rohdaten, Mannschaftsprofil seed-state-all.json.
# Ergebnis: /ausgabe/teamzentrale.html (Daten-Volume der App). Schlägt ein Lauf fehl, bleibt die alte Seite.
set -u
W="${ARBEIT:-/arbeit}"; A="${AUSGABE:-/ausgabe}"; P="${PROTOTYP:-/app/prototype}"
mkdir -p "$W/real"
printf '%s' "${COACHAI_DATENDIENST_KEY:?fehlt}" > "$W/fdkey.txt"
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
    echo "$(date '+%F %T') Fertig. Nächster Lauf in $(( ${INTERVALL:-21600} / 3600 )) Stunden."
    sleep "${INTERVALL:-21600}"
  else
    echo "$(date '+%F %T') Lauf fehlgeschlagen, die bisherige Seite bleibt. Letzte Meldungen:"
    tail -15 "$W/letzter-lauf.log"
    sleep 900
  fi
done
