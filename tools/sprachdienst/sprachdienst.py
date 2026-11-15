"""11Plan-Sprachdienst: wandelt kurze Sprachaufnahmen in Text um (Whisper, läuft komplett auf dem eigenen Server).

Nur intern erreichbar (Docker-Netz), der 11Plan-Server leitet angemeldete Anfragen weiter.
  POST /text     Rohdaten der Aufnahme (webm/opus, mp4/aac, wav ...) -> {"text": "..."}
  GET  /status   {"bereit": true/false, "modell": "..."}
Einstellungen über Umgebungsvariablen:
  WHISPER_MODELL   Modellgröße (Standard „small“; „base“ ist schneller, „medium“ genauer, braucht mehr Speicher)
  WHISPER_THREADS  Rechenkerne (Standard 2)
  MODELL_ORDNER    Ablage der Modelldateien (Standard /modelle, als Volume, damit sie nur einmal geladen werden)
  LEERLAUF_MIN     Nach so vielen Minuten ohne Anfrage wird das Modell aus dem Speicher genommen (Standard 20)
Es wird nichts gespeichert: Die Aufnahme liegt nur während der Umwandlung als temporäre Datei vor.
"""
import json
import os
import tempfile
import threading
import time
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer

MODELL = os.environ.get('WHISPER_MODELL', 'small')
THREADS = int(os.environ.get('WHISPER_THREADS', '2'))
ORDNER = os.environ.get('MODELL_ORDNER', '/modelle')
LEERLAUF = float(os.environ.get('LEERLAUF_MIN', '20')) * 60
MAX_BYTES = 25 * 1024 * 1024  # etwa 20 Minuten Sprache

# Fußball-Wortschatz hilft Whisper bei Fachbegriffen und Schreibweisen.
HINWEIS = ('Fußballtraining, Übung, Spielform, Pressing, Gegenpressing, Umschalten, Ballbesitz, Viererkette, '
           'Sechser, Zehner, Halbraum, Flügel, Abschluss, Torwart, Strafraum, Sechzehner, Hütchen, Leibchen, '
           'Minitore, Coaching, Variationen.')

_modell = None
_zuletzt = time.time()
_sperre = threading.Lock()
# Eigene Sperre fürs Laden: Vorladen beim Start und eine gleichzeitige Aufnahme dürfen das Modell nicht
# doppelt laden – das sprengt sonst die Speichergrenze des Containers und Docker beendet ihn.
_lade = threading.Lock()


def modell():
    global _modell
    with _lade:
        if _modell is None:
            from faster_whisper import WhisperModel
            _modell = WhisperModel(MODELL, device='cpu', compute_type='int8', cpu_threads=THREADS, download_root=ORDNER)
        return _modell


def umwandeln(daten: bytes, hinweis: str = '') -> str:
    global _zuletzt
    with tempfile.NamedTemporaryFile(suffix='.audio') as f:
        f.write(daten)
        f.flush()
        with _sperre:  # eine Aufnahme nach der anderen, damit der kleine Server nicht überlastet
            _zuletzt = time.time()
            segmente, _ = modell().transcribe(
                f.name, language='de', beam_size=5, vad_filter=True,
                initial_prompt=(HINWEIS + ' ' + hinweis).strip()[:600], condition_on_previous_text=False)
            text = ' '.join(s.text.strip() for s in segmente).strip()
            _zuletzt = time.time()
    return text


def aufraeumen():
    """Gibt den Speicher frei, wenn länger niemand diktiert hat."""
    global _modell
    while True:
        time.sleep(60)
        with _sperre, _lade:
            if _modell is not None and time.time() - _zuletzt > LEERLAUF:
                _modell = None


class Handler(BaseHTTPRequestHandler):
    def antwort(self, status: int, inhalt: dict):
        b = json.dumps(inhalt, ensure_ascii=False).encode()
        self.send_response(status)
        self.send_header('Content-Type', 'application/json; charset=utf-8')
        self.send_header('Content-Length', str(len(b)))
        self.end_headers()
        self.wfile.write(b)

    def do_GET(self):
        if self.path == '/status':
            return self.antwort(200, {'bereit': True, 'geladen': _modell is not None, 'modell': MODELL})
        self.antwort(404, {'fehler': 'Nicht gefunden.'})

    def do_POST(self):
        if not self.path.startswith('/text'):
            return self.antwort(404, {'fehler': 'Nicht gefunden.'})
        n = int(self.headers.get('Content-Length') or 0)
        if n <= 0:
            return self.antwort(400, {'fehler': 'Keine Aufnahme.'})
        if n > MAX_BYTES:
            return self.antwort(413, {'fehler': 'Die Aufnahme ist zu lang.'})
        daten = self.rfile.read(n)
        hinweis = (self.headers.get('X-Hinweis') or '')
        try:
            from urllib.parse import unquote
            hinweis = unquote(hinweis)
        except Exception:
            hinweis = ''
        try:
            t0 = time.time()
            text = umwandeln(daten, hinweis)
            print(f'umgewandelt: {len(daten)//1024} KB in {time.time()-t0:.1f} s', flush=True)
            self.antwort(200, {'text': text})
        except Exception as e:  # z. B. unlesbares Format
            print('Fehler:', repr(e), flush=True)
            self.antwort(422, {'fehler': 'Die Aufnahme konnte nicht gelesen werden.'})

    def log_message(self, *a):  # keine Zugriffsprotokolle mit Inhalten
        pass


def vorladen():
    """Lädt die Modelldateien beim ersten Start herunter, damit die erste Aufnahme nicht warten muss."""
    try:
        modell()
        print(f'Whisper-Modell „{MODELL}“ bereit.', flush=True)
    except Exception as e:
        print('Modell konnte noch nicht geladen werden:', repr(e), flush=True)


if __name__ == '__main__':
    threading.Thread(target=vorladen, daemon=True).start()
    threading.Thread(target=aufraeumen, daemon=True).start()
    port = int(os.environ.get('PORT', '8100'))
    print(f'Sprachdienst auf Port {port} (Modell {MODELL}).', flush=True)
    ThreadingHTTPServer(('0.0.0.0', port), Handler).serve_forever()
