import json, urllib.request, urllib.parse, sys
S = sys.argv[1]; KEY = open(f'{S}/fdkey.txt').read().strip()
import os
B = os.environ.get('FD_URL', 'http://127.0.0.1:8000')
def get(path, **q):
    url = B + path + ('?' + urllib.parse.urlencode(q) if q else '')
    req = urllib.request.Request(url, headers={'X-API-Key': KEY})
    with urllib.request.urlopen(req, timeout=300) as r: return json.load(r)
TID = '011MIDPSO0000000VTVG0001VTR8C1K7'
out = {}
out['liga'] = get(f'/api/coachai/team/{TID}/liga')
out['saison'] = get(f'/api/coachai/team/{TID}/saison', von='2026-07-01', bis='2027-06-30')
played = [g for g in out['saison'] if str(g.get('home_score') or '').isdigit()]
ids = [g['id'] for g in played]
det = []
for i in range(0, len(ids), 17): det += get('/api/coachai/spiele/aufstellungen', ids=','.join(ids[i:i+17]))
out['details'] = det
out['kader'] = get('/api/coachai/fupa/kader/tsg-wilhelmshoehe-m1-2026-27')
# Spieltage der Liga (für Gegnerfakten)
st = out['liga']['staffel_id']; mds = []
for n in range(1, 31):
    try: md = get(f'/api/coachai/staffel/{st}/spieltag/{n}')
    except Exception as e: break
    if not md.get('games'): break
    mds.append(md)
out['spieltage'] = mds
json.dump(out, open(f'{S}/real/raw.json','w'), ensure_ascii=False)
print(len(out['saison']), 'Spiele im Plan,', len(played), 'gespielt,', len(det), 'Berichte,', len(out['kader'].get('players',[])), 'Kaderspieler,', len(mds), 'Spieltage')
