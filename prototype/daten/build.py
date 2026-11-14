import json, os, sys, re, unicodedata, urllib.request, urllib.parse, base64, subprocess
from datetime import datetime
from zoneinfo import ZoneInfo
S = sys.argv[1]; KEY = open(f'{S}/fdkey.txt').read().strip()
r = json.load(open(f'{S}/real/raw.json'))
seed = json.load(open(f'{S}/seed-state-all.json')); st = seed.get('state', seed)
team = st['teams'][0]; prep = st['preparations']['spiel-mw5kxr4r-d2df03cd']
TID = '011MIDPSO0000000VTVG0001VTR8C1K7'; OWN = 'TSG Wilhelmshöhe'; TODAY = datetime.now(ZoneInfo('Europe/Berlin')).strftime('%Y-%m-%d')
BER = ZoneInfo('Europe/Berlin')
def local(dt):
    d = datetime.fromisoformat(dt.replace('Z', '+00:00')).astimezone(BER); return d.strftime('%Y-%m-%d'), d.strftime('%H:%M')
def fold(s): return re.sub(r'\s+', ' ', unicodedata.normalize('NFKD', (s or '').lower().replace('ä','ae').replace('ö','oe').replace('ü','ue').replace('ß','ss')).encode('ascii', 'ignore').decode()).strip()
def get(path, **q):
    url = os.environ.get('FD_URL', 'http://127.0.0.1:8000') + path + ('?' + urllib.parse.urlencode(q) if q else '')
    with urllib.request.urlopen(urllib.request.Request(url, headers={'X-API-Key': KEY}), timeout=600) as x: return json.load(x)
isnum = lambda v: str(v or '').isdigit()

# ---------- Zwischenspeicher zwischen den Läufen: nur Neues laden ----------
# Spielberichte vergangener Ligaspiele, Fotos, Wappen, Vereinssuche und Fahrzeiten ändern sich nicht mehr.
CACHE_DATEI = f'{S}/real/cache.json'
try: CACHE = json.load(open(CACHE_DATEI))
except Exception: CACHE = {}
if CACHE.get('saison') != '2026-27': CACHE = {'saison': '2026-27'}
for _k in ('berichte', 'bilder', 'teams', 'geo', 'routen'): CACHE.setdefault(_k, {})
def cache_sichern(): json.dump(CACHE, open(CACHE_DATEI, 'w'), ensure_ascii=False)

# ---------- Liga: alle Spiele und Spielberichte ----------
lg = {}; mdOf = {}
for md in r['spieltage']:
    for g in md['games']:
        mdOf[g['game_id']] = md['matchday']
        if isnum(g['home_score']) and isnum(g['away_score']) and local(g['datetime_utc'])[0] < TODAY: lg[g['game_id']] = g
details = {d['game_id']: d for d in r['details']}
for _gid, _d in CACHE['berichte'].items():
    if _gid in lg and _gid not in details: details[_gid] = _d
need = [i for i in lg if i not in details]
for k in range(0, len(need), 17): 
    for d in get('/api/coachai/spiele/aufstellungen', ids=','.join(need[k:k+17])): details[d['game_id']] = d; CACHE['berichte'][d['game_id']] = d
print('Ligaberichte neu geladen:', len(need))
def minute(t):
    m = re.match(r'(\d+)', (t or '').replace('’', '').replace("'", '')); return int(m.group(1)) if m else None
def bin_of(m, half):
    if half == 1 and m > 45: return 2
    if half == 2 and m <= 45: return 3
    return min(5, max(0, (m - 1) // 15))
def goals(gid, hs, as_):
    d = details.get(gid); 
    if not d: return None
    out = [(minute(e['time']), e.get('half'), e.get('team'), (e.get('description') or '').strip()) for e in d.get('events') or [] if e.get('type') == 'goal']
    if any(m is None or not t for m, _, t, _ in out) or len(out) != hs + as_: return None
    return out
league_bins = [0]*6; league_full = 0
for gid, g in lg.items():
    gl = goals(gid, int(g['home_score']), int(g['away_score']))
    if gl is None: continue
    league_full += 1
    for m, h, t, _ in gl: league_bins[bin_of(m, h)] += 1
L = r['liga']; table = L['table']
tot_games = sum(x['games'] for x in table); tot_gf = sum(x['goals_for'] for x in table); tot_pts = sum(x['points'] for x in table)

# ---------- eigene Spiele ----------
games = []
for g in r['saison']:
    d, t = local(g['datetime_utc']); home = g['home_team_id'] == TID or fold(g['home_team']) == fold(OWN)
    comp = g.get('competition') or ''
    played = isnum(g['home_score']) and isnum(g['away_score'])
    if not played and d < TODAY: continue  # ausgefallen oder verlegt
    kind = 'liga' if comp.startswith('Gruppenliga') else 'pokal' if 'pokal' in comp.lower() else 'test'
    label = f"Gruppenliga, {mdOf[g['id']]}. Spieltag" if kind == 'liga' and g['id'] in mdOf else 'Kreispokal' if kind == 'pokal' else 'Freundschaftsspiel'
    opp = g['away_team'] if home else g['home_team']
    res = None; gf = ga = None
    if played:
        hs, as_ = int(g['home_score']), int(g['away_score']); gf, ga = (hs, as_) if home else (as_, hs); res = f"{gf}:{ga}"
    venue = g.get('location') or ''
    games.append(dict(id='g'+g['id'], fid=g['id'], date=d, time=t, opp=opp, home=home, res=res, gf=gf, ga=ga, comp=label, kind=kind, venue=venue))
games.sort(key=lambda x: x['date'])

# ---------- Fahrzeit zu Auswärtsspielen (OpenStreetMap: Nominatim + OSRM) ----------
import time
def geocode(q):
    if q in CACHE['geo']: return tuple(CACHE['geo'][q]) if CACHE['geo'][q] else None
    time.sleep(1.1)
    url = 'https://nominatim.openstreetmap.org/search?' + urllib.parse.urlencode(dict(q=q, format='json', limit=1, countrycodes='de'))
    try:
        with urllib.request.urlopen(urllib.request.Request(url, headers={'User-Agent': '11Plan/1.0 (Trainerteam-App)'}), timeout=20) as x: j = json.load(x)
        pt = (float(j[0]['lon']), float(j[0]['lat'])) if j else None
        if pt: CACHE['geo'][q] = pt
        return pt
    except Exception: return None
def route(a, b):
    key = f'{a[0]:.5f},{a[1]:.5f};{b[0]:.5f},{b[1]:.5f}'
    if key in CACHE['routen']: return tuple(CACHE['routen'][key])
    url = f'https://router.project-osrm.org/route/v1/driving/{a[0]},{a[1]};{b[0]},{b[1]}?overview=false'
    try:
        with urllib.request.urlopen(urllib.request.Request(url, headers={'User-Agent': '11Plan/1.0 (Trainerteam-App)'}), timeout=20) as x: j = json.load(x)
        r0 = j['routes'][0]; res = (round(r0['duration'] / 60), round(r0['distance'] / 1000, 1)); CACHE['routen'][key] = res; return res
    except Exception: return None
dep_name = team['schedule']['away'].get('departurePoint') or 'Stockwiesen'
dep = geocode(f'{dep_name}, Kassel')
cache = {}
# Fahrzeiten des letzten Laufs als Rückfall, falls OpenStreetMap gerade nicht antwortet
try:
    _alt = open(f'{S}/real/data.js').read(); _alt = json.loads(_alt[_alt.index('=')+1:_alt.rstrip().rindex(';')])
    alt_fahrt = {g.get('address'): g['travel'] for g in _alt.get('games', []) if g.get('travel') and g.get('address')}
except Exception: alt_fahrt = {}
for x in games:
    x['address'] = ', '.join(x['venue'].split(', ')[1:]) if ', ' in x['venue'] else x['venue']
    x['travel'] = None
    if x['home'] or not x['venue'] or x['date'] < TODAY: continue
    if not dep and x['address'] not in alt_fahrt: continue
    if x['address'] not in cache:
        pt = (geocode(x['address']) or geocode(x['address'].split(', ')[-1])) if dep else None
        cache[x['address']] = (route(dep, pt) if pt else None) or ((alt_fahrt[x['address']]['min'], alt_fahrt[x['address']]['km']) if x['address'] in alt_fahrt else None)
    if cache[x['address']]: x['travel'] = dict(min=cache[x['address']][0], km=cache[x['address']][1], src=f'OpenStreetMap (OSRM), ab {dep_name}, ohne Verkehr')

# ---------- Kader (FuPa) mit Statistik aus den Spielberichten ----------
POS = {'Torwart': 'TW', 'Abwehr': 'ABW', 'Mittelfeld': 'MF', 'Angriff': 'ST'}
squad = r['kader']['players']
def match(name):
    t = fold(name); parts = t.split(' ')
    ex = [p for p in squad if fold(f"{p['first_name']} {p['last_name']}") == t]
    if ex: return ex[0]
    fl = [p for p in squad if p['last_name'] and t.endswith(' ' + fold(p['last_name'])) and fold(p['first_name']).split(' ')[0] == parts[0]]
    if len(fl) == 1: return fl[0]
    lo = [p for p in squad if p['last_name'] and t.endswith(' ' + fold(p['last_name']))]
    if len(lo) == 1: return lo[0]
    toks = set(parts)
    sub = [p for p in squad if set(fold(f"{p['first_name']} {p['last_name']}").split(' ')) <= toks]
    return sub[0] if len(sub) == 1 else None
stats = {p['slug']: dict(kader=0, starts=0, goals=0, apps=0, mins=0) for p in squad}
pflicht = [x for x in games if x['res'] and x['kind'] != 'test']
lineups = {}
for x in pflicht:
    d = details.get(x['fid']); side = 'home' if x['home'] else 'away'
    lu = (d or {}).get('lineup') or {}; s = lu.get(side) or {}
    xi = [p['name'] for p in s.get('starting') or []]; bench = [p['name'] for p in s.get('substitutes') or []]
    subs = []
    for e in (d or {}).get('events') or []:
        if e.get('type') == 'substitution' and e.get('team') == side:
            m = re.match(r'^(.*?)\s*\(\d+\)\s*für\s*(.*?)\s*\(\d+\)\s*$', e.get('description') or '')
            if m: subs.append(dict(min=minute(e['time']) or 0, inn=m.group(1).strip(), out=m.group(2).strip()))
    lineups[x['id']] = dict(xi=xi, bench=bench, subs=subs)
    outs = {fold(sb['out']): sb['min'] for sb in subs}
    for n in xi:
        mm = match(n)
        if mm: stats[mm['slug']]['apps'] += 1; stats[mm['slug']]['mins'] += min(90, outs.get(fold(n), 90))
    for sb in subs:
        mm = match(sb['inn'])
        if mm: stats[mm['slug']]['apps'] += 1; stats[mm['slug']]['mins'] += max(0, 90 - min(90, sb['min']))
    for n in xi:
        m = match(n); 
        if m: stats[m['slug']]['kader'] += 1; stats[m['slug']]['starts'] += 1
    for n in bench:
        m = match(n)
        if m: stats[m['slug']]['kader'] += 1
    for e in (d or {}).get('events') or []:
        if e.get('type') == 'goal' and e.get('team') == side:
            m = match(e.get('description') or '')
            if m: stats[m['slug']]['goals'] += 1
def photo(url):
    if not url: return None
    if url in CACHE['bilder']: return CACHE['bilder'][url]
    try:
        b = subprocess.run(['curl', '-s', '-m', '20', url], capture_output=True).stdout
        res = 'data:image/jpeg;base64,' + base64.b64encode(b).decode() if len(b) > 500 else None
        if res: CACHE['bilder'][url] = res
        return res
    except Exception: return None
players = []
order = {'Torwart': 0, 'Abwehr': 1, 'Mittelfeld': 2, 'Angriff': 3, None: 4}
for p in sorted(squad, key=lambda p: (order.get(p['position'], 4), -stats[p['slug']]['starts'], p['last_name'] or '')):
    s = stats[p['slug']]
    players.append(dict(slug=p['slug'], nr=p['number'] or '', name=f"{p['first_name']} {p['last_name']}".strip(), pos=POS.get(p['position'], '–'),
        captain=p.get('captain'), assists=p.get('assists') or 0, apps=s['apps'], mins=s['mins'], kader=s['kader'], starts=s['starts'], goals=s['goals'], photo=photo(p.get('photo_url'))))
coaches = [dict(name=c['name'], role=c['role']) for c in r['kader']['coaches']]

# ---------- Auswertung eigene Mannschaft ----------
own_row = next(x for x in table if x['team_id'] == TID)
ligag = [x for x in games if x['res'] and x['kind'] == 'liga']
own_for = [0]*6; own_against = [0]*6; full = 0; wa = [0, 0]; wc = [0, 0]
for x in ligag:
    gl = goals(x['fid'], *( (x['gf'], x['ga']) if x['home'] else (x['ga'], x['gf']) ))
    if gl is None: continue
    full += 1; side = 'home' if x['home'] else 'away'
    for m, h, t, _ in gl:
        (own_for if t == side else own_against)[bin_of(m, h)] += 1
        (wa if t == side else wc)[0 if (h == 1 or (h is None and m <= 45)) else 1] += 1
lb_scaled = [round(b / (2 * league_full) * full, 1) for b in league_bins]
pick = lambda rows: next((x for x in rows if x['team_id'] == TID), None)
hr, ar = pick(L['home_table']), pick(L['away_table'])
def form(team_id, n=5):
    gs = sorted([g for g in lg.values() if team_id in (g['home_team_id'], g['away_team_id'])], key=lambda g: g['datetime_utc'])[-n:]
    out = []
    for g in gs:
        h = g['home_team_id'] == team_id; a, b = int(g['home_score']), int(g['away_score']); f, c = (a, b) if h else (b, a)
        out.append('S' if f > c else 'U' if f == c else 'N')
    return out
def de(x, d=1): return f"{x:.{d}f}".replace('.', ',')

# ---------- nächster Gegner: Fakten ----------
nxt = next(x for x in games if not x['res'] and x['date'] >= TODAY)
opp_row = next(x for x in table if fold(x['team']) == fold(nxt['opp']))
OID = opp_row['team_id']
og = sorted([g for g in lg.values() if OID in (g['home_team_id'], g['away_team_id'])], key=lambda g: g['datetime_utc'])
late_c = late_s = tot_c = 0; first_for = first_wins = 0; scorers = {}; full_o = 0; last_res = []
for g in og:
    h = g['home_team_id'] == OID; side = 'home' if h else 'away'; a, b = int(g['home_score']), int(g['away_score']); f, c = (a, b) if h else (b, a)
    last_res.append((local(g['datetime_utc'])[0], g['away_team'] if h else g['home_team'], h, f, c))
    gl = goals(g['game_id'], a, b)
    if gl is None: continue
    full_o += 1
    for m, hh, t, n in gl:
        if t == side: scorers[n] = scorers.get(n, 0) + 1
        else:
            tot_c += 1
            if bin_of(m, hh) == 5: late_c += 1
    if gl:
        if gl[0][2] == side:
            first_for += 1
            if f > c: first_wins += 1
ohr = next((x for x in L['home_table'] if x['team_id'] == OID), None)
top = sorted(scorers.items(), key=lambda kv: -kv[1])[:1]
h2h = [x for x in games if fold(x['opp']) == fold(nxt['opp']) and x['res']]
lc_share = late_c / tot_c if tot_c else 0
league_late_share = league_bins[5] / sum(league_bins) if sum(league_bins) else 0
fo = form(OID)
facts_opp = [
    [f"{nxt['opp']} steht auf Platz {opp_row['place']} mit {opp_row['points']} Punkten aus {opp_row['games']} Spielen ({opp_row['goals_for']}:{opp_row['goals_against']} Tore).", 'fussball.de, Tabelle'],
    [f"Zu Hause: {ohr['points']} Punkte aus {ohr['games']} Spielen ({ohr['won']} Siege, {ohr['draw']} Unentschieden, {ohr['lost']} Niederlagen)." if ohr else None, 'fussball.de, Heimtabelle'],
    [f"Die letzten fünf Ligaspiele: {' '.join(fo)} ({fo.count('S')} Siege, {fo.count('U')} Unentschieden, {fo.count('N')} Niederlagen).", 'fussball.de, Ergebnisse'],
]
facts_opp = [f for f in facts_opp if f[0]]
# KI-Erkenntnisse aus dem Zahlenwerk (änderbar), feste Fakten bleiben fest
def halves(team_id):
    a = [0, 0]; c = [0, 0]; first_conc = first_conc_pts = 0; n = 0
    for g in lg.values():
        if team_id not in (g['home_team_id'], g['away_team_id']): continue
        h = g['home_team_id'] == team_id; side = 'home' if h else 'away'; hs, as_ = int(g['home_score']), int(g['away_score'])
        gl = goals(g['game_id'], hs, as_)
        if gl is None: continue
        n += 1
        for m, hh, t, _ in gl:
            i = 0 if (hh == 1 or (hh is None and m <= 45)) else 1
            (a if t == side else c)[i] += 1
        if gl and gl[0][2] != side:
            first_conc += 1; f, cc = (hs, as_) if h else (as_, hs); first_conc_pts += 3 if f > cc else 1 if f == cc else 0
    return a, c, first_conc, first_conc_pts, n
oa, oc, ofc, ofcp, on = halves(OID)
ins_opp = []
if tot_c: ins_opp.append([f"{nxt['opp']} kassiert {round(lc_share*100)} % der Gegentore ab der 76. Minute, im Ligaschnitt sind es {round(league_late_share*100)} %. Nutzen wir die Schlussphase gezielt, etwa mit frischen Kräften?", f'Analytics, {full_o} Spielberichte'])
if first_for: ins_opp.append([f"Wenn {nxt['opp']} zuerst trifft, gewinnt das Team {first_wins} von {first_for} Spielen.", f'Analytics, {full_o} Spielberichte'])
if top: ins_opp.append([f"{top[0][0]} erzielte {top[0][1]} der {sum(scorers.values())} Tore ({round(top[0][1]/max(1,sum(scorers.values()))*100)} %). Wer kümmert sich um ihn?", f'Analytics, {full_o} Spielberichte'])
if sum(oc): ins_opp.append([f"{nxt['opp']} kassiert {oc[1]} von {sum(oc)} Gegentoren in der zweiten Halbzeit.", f'Analytics, {full_o} Spielberichte'])
if sum(oa): ins_opp.append([f"{nxt['opp']} trifft {oa[0]} Mal vor und {oa[1]} Mal nach der Pause.", f'Analytics, {full_o} Spielberichte'])
if ohr: ins_opp.append([f"Zu Hause holt {nxt['opp']} {de(ohr['points']/ohr['games'],2)} Punkte pro Spiel, im Ligaschnitt sind es {de(tot_pts/tot_games,2)}.", 'Analytics, Heimtabelle'])
ofo = form(TID)
own_late = own_against[5]; own_ct = sum(own_against)
facts_own = [
    [f"Hinspiel am {h2h[0]['date'][8:]}.{h2h[0]['date'][5:7]}.: {OWN} – {nxt['opp']} {h2h[0]['res']}." if h2h and h2h[0]['home'] else (f"Hinspiel: {nxt['opp']} – {OWN} {h2h[0]['ga']}:{h2h[0]['gf']}." if h2h else None), 'fussball.de, Ergebnisse'],
    [f"Die letzten fünf Ligaspiele: {' '.join(ofo)}.", 'fussball.de, Ergebnisse'],
    [f"{own_row['goals_against']} Gegentore in {own_row['games']} Ligaspielen, das sind {de(own_row['goals_against']/own_row['games'])} pro Spiel (Ligaschnitt {de(tot_gf/tot_games)}).", 'fussball.de, Tabelle'],
    [f"Auswärts: {ar['points']} Punkte aus {ar['games']} Spielen ({ar['goals_for']}:{ar['goals_against']} Tore)." if ar else None, 'fussball.de, Auswärtstabelle'],
]
facts_own = [f for f in facts_own if f[0]]
_, _, wfc, wfcp, wn = halves(TID)
ratio = [own_against[i] / lb_scaled[i] if lb_scaled[i] else 0 for i in range(6)]; bi = ratio.index(max(ratio))
BL = ['1.–15.', '16.–30.', '31.–45.', '46.–60.', '61.–75.', '76.–90.']
ins_own = [
    [f"Die meisten Gegentore im Verhältnis zum Ligaschnitt fallen in der {BL[bi]} Minute: {own_against[bi]} statt {de(lb_scaled[bi])}.", f'Analytics, {full} Spielberichte'],
    [f"Nach eigenem Rückstand ({wfc} Spiele) holten wir {wfcp} {'Punkt' if wfcp==1 else 'Punkte'}." if wfc else None, f'Analytics, {full} Spielberichte'],
    [f"Wir treffen {wa[0]} Mal vor und {wa[1]} Mal nach der Pause.", f'Analytics, {full} Spielberichte'],
    [f"{own_for[5]} unserer {sum(own_for)} Tore fielen ab der 76. Minute. " if own_for[5] else None, f'Analytics, {full} Spielberichte'],
    [f"Gegentore je Halbzeit: {wc[0]} vor und {wc[1]} nach der Pause.", f'Analytics, {full} Spielberichte'],
]
ins_own = [f for f in ins_own if f[0]]
top_own = sorted(players, key=lambda p: -p['goals'])[:3]
facts_own.append([f"Torschützen in Pflichtspielen: " + ', '.join(f"{p['name']} {p['goals']}" for p in top_own if p['goals']) + '.', 'fussball.de, Spielberichte'])

# ---------- Spielverlauf je gespieltem Spiel ----------
timeline = {}
for x in [g for g in games if g['res']]:
    d = details.get(x['fid']); side = 'home' if x['home'] else 'away'
    timeline[x['id']] = [dict(min=e['time'], half=e.get('half'), score=e.get('score'), own=e.get('team') == side, who=(e.get('description') or '').strip()) for e in (d or {}).get('events') or [] if e.get('type') == 'goal']

# ---------- Vereinswappen (FuPa) ----------
def img64(url):
    if not url: return None
    if 'w64:' + url in CACHE['bilder']: return CACHE['bilder']['w64:' + url]
    b = subprocess.run(['curl', '-s', '-m', '20', url.replace('200x200', '64x64')], capture_output=True).stdout
    res = 'data:image/png;base64,' + base64.b64encode(b).decode() if len(b) > 200 else None
    if res: CACHE['bilder']['w64:' + url] = res
    return res
crests = {}
try:
    ft = get('/api/coachai/fupa/tabelle', wettbewerb='kassel-gruppenliga-2', saison='2026-27')['rows']
    byrank = {x['rank']: x for x in ft}
    for x in table:
        f = byrank.get(x['place'])
        if f: crests[x['team']] = img64(f.get('team_image'))
except Exception as e: print('Wappen Liga:', e)
for name in sorted({g['opp'] for g in games} - set(crests)):
    base = re.sub(r'\s+(II|2)$', '', name); nr = 2 if re.search(r'\s(II|2)$', name) else 1
    variants = [base, base.replace(' KS', ' Kassel'), base.replace('KS', 'Kassel')]
    try:
        if name in CACHE['teams']: t = CACHE['teams'][name]
        else:
            t = get('/api/coachai/fupa/finde-team', namen='|'.join(dict.fromkeys(variants)), saison='2026-27', nummer=nr)
            if t: CACHE['teams'][name] = t
        crests[name] = img64(t and t.get('image_url'))
    except Exception: crests[name] = None
# Eigenes Wappen in guter Auflösung aus dem Mannschaftsprofil (TSG II, gleicher Verein), sonst FuPa
try:
    from PIL import Image
    import io
    src = next((t.get('crest') for t in st['teams'] if (t.get('club') or t.get('name','')).startswith('TSG Wilhelmsh') and t.get('crest')), None)
    if src:
        im = Image.open(io.BytesIO(base64.b64decode(src.split(',', 1)[1]))).convert('RGBA')
        im.thumbnail((112, 144), Image.LANCZOS)
        buf = io.BytesIO(); im.save(buf, 'PNG', optimize=True)
        crests[OWN] = 'data:image/png;base64,' + base64.b64encode(buf.getvalue()).decode()
except Exception as e: print('Eigenes Wappen:', e)
own_crest = crests.get(OWN)
print('Wappen:', sum(1 for v in crests.values() if v), 'von', len(crests), [k for k, v in crests.items() if not v])

out = dict(
    crests=crests,
    league_bins_raw=league_bins, departure=dep_name,
    team=dict(name=OWN, league=L['staffel_name'], short='Gruppenliga Kassel 2', venue=team['homeVenue'], coaches=coaches, zones=team.get('leagueZones'),
              deduction=L.get('deduction_note')),
    games=games, players=players, lineups=lineups, timeline=timeline,
    table=[dict(pl=x['place'], team=x['team'], own=x['team_id'] == TID, opp=x['team_id'] == OID, form=' '.join(form(x['team_id'])), sp=x['games'], s=x['won'], u=x['draw'], n=x['lost'], gf=x['goals_for'], ga=x['goals_against'], pts=x['points']) for x in table],
    tiles=dict(ppg=own_row['points']/own_row['games'], lppg=tot_pts/tot_games, gpg=own_row['goals_for']/own_row['games'], lgpg=tot_gf/tot_games, gapg=own_row['goals_against']/own_row['games'],
               place=own_row['place'], teams=len(table), home=hr and hr['points'], homeG=hr and hr['games'], away=ar and ar['points'], awayG=ar and ar['games'], games=own_row['games'], points=own_row['points']),
    bins=dict(own_for=own_for, own_against=own_against, league=lb_scaled, full=full, league_full=league_full, league_games=len(lg)),
    facts=dict(opp=facts_opp, own=facts_own), insights=dict(opp=ins_opp, own=ins_own), next=nxt['id'],
    schedule=team['schedule'], kit=dict(home={k: team['kits']['home'][k] for k in ('shirt', 'shorts', 'socks')}, images=team['kits']['home'].get('images') or {}),
    asks=[q for q in [
        (f"{nxt['opp']} hat {late_c} von {tot_c} Gegentoren ab der 76. Minute kassiert ({round(lc_share*100)} %, Ligaschnitt {round(league_late_share*100)} %). Soll die Schlussphase in „Unser Plan“, etwa mit frischen Kräften von der Bank?" if tot_c else None),
        (f"Wenn {nxt['opp']} zuerst trifft, gewinnt das Team {first_wins} von {first_for} Spielen. Wie wollen wir in die ersten 15 Minuten gehen?" if first_for else None),
        (f"{top[0][0]} erzielte {top[0][1]} der {sum(scorers.values())} Tore von {nxt['opp']}. Wer kümmert sich um ihn, und wie?" if top else None),
        (f"{nxt['opp']} trifft {oa[1]} Mal nach der Pause und {oa[0]} Mal davor. Was ändern wir in der Halbzeit, wenn es knapp steht?" if sum(oa) else None),
        (f"Im Hinspiel habt ihr {h2h[0]['res']} gewonnen. Was hat damals funktioniert, und gilt das noch?" if h2h and h2h[0]['gf'] > h2h[0]['ga'] else None),
        (f"Wir kassieren {de(own_row['goals_against']/own_row['games'])} Gegentore pro Spiel, die meisten im Verhältnis in der {BL[bi]} Minute. Worauf achten wir gegen den Ball besonders?"),
    ] if q],
    ask=(f"{nxt['opp']} hat {late_c} von {tot_c} Gegentoren ab der 76. Minute kassiert ({round(lc_share*100)} %, Ligaschnitt {round(league_late_share*100)} %). Soll die Schlussphase in „Unser Plan“, etwa mit frischen Kräften von der Bank?" if tot_c else ''),
    prep_answers={k: v.get('text') for k, v in prep['answers'].items() if isinstance(v, dict) and v.get('text')},
    mission=prep.get('mission'),
)
cache_sichern()
open(f'{S}/real/data.js', 'w').write('const REAL = ' + json.dumps(out, ensure_ascii=False) + ';\n')
print('Spiele', len(games), '| nächstes', nxt['date'], nxt['time'], nxt['opp'], '| Kader', len(players), 'Fotos', sum(1 for p in players if p['photo']))
print('Liga-Berichte', league_full, '/', len(lg), '| eigene vollst.', full, '| bins', own_for, own_against, lb_scaled)
print(json.dumps(out['tiles'], ensure_ascii=False))
for f in facts_opp + facts_own: print('-', f[0])
print([(p['name'], p['kader'], p['starts'], p['goals']) for p in players[:8]])
