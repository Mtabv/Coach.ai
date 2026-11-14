#!/usr/bin/env bash
# Startet den Datendienst und prüft ihn jede Minute. Antwortet er dreimal hintereinander nicht
# (hängt statt abzustürzen), beendet sich der Container; Docker startet ihn dann neu.
uvicorn coachai_dienst:app --host 0.0.0.0 --port 8000 &
PID=$!
fehler=0
while sleep 60; do
  kill -0 "$PID" 2>/dev/null || exit 1
  if python -c "import urllib.request; urllib.request.urlopen('http://127.0.0.1:8000/docs', timeout=20)" 2>/dev/null; then
    fehler=0
  else
    fehler=$((fehler + 1))
    echo "Selbstprüfung: keine Antwort ($fehler/3)"
  fi
  if [ "$fehler" -ge 3 ]; then echo "Datendienst hängt, Neustart."; kill "$PID"; exit 1; fi
done
