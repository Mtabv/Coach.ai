"""
Holt die Rohdaten der Mannschaft über den Datendienst (fussball.de, FuPa).

Lädt nur, was sich ändern kann:
- immer: Tabelle, Spielplan der Saison, FuPa-Kader (je ein Abruf)
- Spielberichte nur für Spiele, die seit dem letzten Lauf gespielt wurden
- Spieltage nur, solange sie noch nicht komplett gespielt sind
Alles andere kommt aus dem letzten Lauf (real/raw.json).
"""
import json, os, sys, urllib.request, urllib.parse
from datetime import datetime
from zoneinfo import ZoneInfo

S = sys.argv[1]; KEY = open(f'{S}/fdkey.txt').read().strip()
B = os.environ.get('FD_URL', 'http://127.0.0.1:8000')
TID = '011MIDPSO0000000VTVG0001VTR8C1K7'
SAISON_VON, SAISON_BIS = '2026-07-01', '2027-06-30'
abrufe = 0

def get(path, **q):
    global abrufe
    abrufe += 1
    url = B + path + ('?' + urllib.parse.urlencode(q) if q else '')
    req = urllib.request.Request(url, headers={'X-API-Key': KEY})
    with urllib.request.urlopen(req, timeout=300) as r: return json.load(r)

try: alt = json.load(open(f'{S}/real/raw.json'))
except Exception: alt = {}
if alt.get('saison_von') != SAISON_VON: alt = {}   # neue Saison: alles neu

isnum = lambda v: str(v or '').isdigit()
out = {'saison_von': SAISON_VON}
out['liga'] = get(f'/api/coachai/team/{TID}/liga')
out['saison'] = get(f'/api/coachai/team/{TID}/saison', von=SAISON_VON, bis=SAISON_BIS)
out['kader'] = get('/api/coachai/fupa/kader/tsg-wilhelmshoehe-m1-2026-27')

# Spielberichte: vorhandene behalten, nur neu gespielte Spiele abrufen
played = [g for g in out['saison'] if isnum(g.get('home_score'))]
bekannt = {d['game_id']: d for d in alt.get('details', []) if d.get('game_id')}
neu = [g['id'] for g in played if g['id'] not in bekannt]
for i in range(0, len(neu), 17):
    for d in get('/api/coachai/spiele/aufstellungen', ids=','.join(neu[i:i+17])): bekannt[d['game_id']] = d
out['details'] = [bekannt[g['id']] for g in played if g['id'] in bekannt]

# Spieltage: komplett gespielte aus dem letzten Lauf, offene neu
heute = datetime.now(ZoneInfo('Europe/Berlin')).strftime('%Y-%m-%d')
st = out['liga']['staffel_id']
alte_tage = {md['matchday']: md for md in alt.get('spieltage', []) if alt.get('liga', {}).get('staffel_id') == st}
def komplett(md): return md.get('games') and all(isnum(g.get('home_score')) and isnum(g.get('away_score')) for g in md['games'])
mds = []
for n in range(1, 31):
    if n in alte_tage and komplett(alte_tage[n]): mds.append(alte_tage[n]); continue
    try: md = get(f'/api/coachai/staffel/{st}/spieltag/{n}')
    except Exception: break
    if not md.get('games'): break
    mds.append(md)
out['spieltage'] = mds

os.makedirs(f'{S}/real', exist_ok=True)
json.dump(out, open(f'{S}/real/raw.json', 'w'), ensure_ascii=False)
print(len(out['saison']), 'Spiele im Plan,', len(played), 'gespielt,', len(neu), 'neue Spielberichte,',
      len(out['kader'].get('players', [])), 'Kaderspieler,', len(mds), 'Spieltage,', abrufe, 'Abrufe')
