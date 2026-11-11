import { useEffect, useMemo, useRef, useState, type FormEvent, type ReactNode } from 'react';
import type { AppState } from '../../domain/types';
import { StoreProvider, useStore } from '../../state/store';
import { localStorageAdapter, migrate } from '../../storage/storage';
import { initialState } from '../../data/seed';
import '../design.css';
import { api, ApiError, loadServerState, serverPersistence, serverStatus, type ServerState, type SessionUser } from '../../storage/server';

/**
 * Zugang zur App. Ohne Server (Vorschau) geht es direkt los, Daten bleiben im Browser.
 * Mit Server: erstes Konto einrichten, anmelden oder Einladung annehmen; danach gemeinsamer Stand.
 */
type Phase =
  | { p: 'laden' }
  | { p: 'lokal' }
  | { p: 'einrichten' }
  | { p: 'anmelden' }
  | { p: 'einladung'; token: string }
  | { p: 'bereit'; nutzer: SessionUser; start: ServerState; zustand: AppState };

export interface Sitzung { nutzer: SessionUser; abmelden: () => void }

const einladungsToken = () => (window.location.hash.match(/^#einladung\/([A-Za-z0-9_-]+)/) || [])[1];

export function Zugang({ children }: { children: (sitzung: Sitzung | null) => ReactNode }) {
  const [phase, setPhase] = useState<Phase>({ p: 'laden' });

  const pruefen = async () => {
    const st = await serverStatus();
    if (st.mode === 'lokal') return setPhase({ p: 'lokal' });
    const token = einladungsToken();
    if (!st.eingerichtet) return setPhase({ p: 'einrichten' });
    if (!st.nutzer) return setPhase(token ? { p: 'einladung', token } : { p: 'anmelden' });
    const start = await loadServerState();
    // Leerer Server: vorhandene Daten aus diesem Browser übernehmen, sonst neu beginnen.
    const lokal = localStorageAdapter.load();
    const zustand = start.zustand ? migrate(start.zustand) : lokal ? migrate(lokal) : initialState();
    if (token) window.location.hash = '#/';
    setPhase({ p: 'bereit', nutzer: st.nutzer, start, zustand });
  };
  useEffect(() => { void pruefen().catch(() => setPhase({ p: 'anmelden' })); }, []);

  if (phase.p === 'laden') return <Rahmen titel="11Plan wird geladen …" />;
  if (phase.p === 'lokal') return <StoreProvider>{children(null)}</StoreProvider>;
  if (phase.p === 'einrichten') return <Einrichten fertig={pruefen} />;
  if (phase.p === 'anmelden') return <Anmelden fertig={pruefen} />;
  if (phase.p === 'einladung') return <Einladung token={phase.token} fertig={pruefen} />;
  const abmelden = () => { void api('/api/abmelden', { method: 'POST' }).finally(() => { window.location.hash = '#/'; setPhase({ p: 'anmelden' }); }); };
  return <ServerApp key={phase.nutzer.id} start={phase.start} zustand={phase.zustand} sitzung={{ nutzer: phase.nutzer, abmelden }}>{children}</ServerApp>;
}

function ServerApp({ start, zustand, sitzung, children }: { start: ServerState; zustand: AppState; sitzung: Sitzung; children: (s: Sitzung) => ReactNode }) {
  const [konflikt, setKonflikt] = useState(false);
  const persistence = useMemo(() => serverPersistence(start, zustand, () => setKonflikt(true)), [start, zustand]);
  return (
    <StoreProvider persistence={persistence}>
      <Abgleich persistence={persistence} konflikt={konflikt} setKonflikt={setKonflikt} />
      {children(sitzung)}
    </StoreProvider>
  );
}

/** Holt regelmäßig den Stand des anderen Kontos, solange hier nichts ungespeichert ist. */
function Abgleich({ persistence, konflikt, setKonflikt }: { persistence: { version: number }; konflikt: boolean; setKonflikt: (b: boolean) => void }) {
  const { replace, saveStatus } = useStore();
  const [von, setVon] = useState<string | null>(null);
  const status = useRef(saveStatus);
  status.current = saveStatus;
  const holen = async (erzwingen = false) => {
    if (!erzwingen && status.current !== 'gespeichert') return;
    const s = await loadServerState();
    if (!s.zustand || (s.version <= persistence.version && !erzwingen)) return;
    persistence.version = s.version;
    replace(migrate(s.zustand));
    setVon(s.geaendertVon ?? null);
    setKonflikt(false);
  };
  useEffect(() => {
    const t = window.setInterval(() => { void holen().catch(() => undefined); }, 30_000);
    const sichtbar = () => { if (document.visibilityState === 'visible') void holen().catch(() => undefined); };
    document.addEventListener('visibilitychange', sichtbar);
    return () => { window.clearInterval(t); document.removeEventListener('visibilitychange', sichtbar); };
  });
  if (konflikt)
    return (
      <div className="entwurf sync-hinweis warn" role="alert">
        Im Trainerteam hat gerade jemand anderes gespeichert. Deine letzte Änderung ist deshalb noch nicht gespeichert.
        <button className="btn small" onClick={() => void holen(true)}>Neuesten Stand laden</button>
      </div>
    );
  if (von)
    return (
      <div className="entwurf sync-hinweis" role="status">
        Neuer Stand von {von} geladen. <button className="btn small ghost" onClick={() => setVon(null)}>Ausblenden</button>
      </div>
    );
  return null;
}

function Rahmen({ titel, text, children }: { titel: string; text?: string; children?: ReactNode }) {
  return (
    <div className="entwurf zugang">
      <div className="card zugang-karte">
        <div className="zugang-marke">11<span>Plan</span></div>
        <h1>{titel}</h1>
        {text && <p className="note">{text}</p>}
        {children}
      </div>
    </div>
  );
}

function useFormular(senden: () => Promise<void>) {
  const [fehler, setFehler] = useState('');
  const [laeuft, setLaeuft] = useState(false);
  const onSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setFehler('');
    setLaeuft(true);
    try { await senden(); } catch (err) { setFehler(err instanceof ApiError ? err.message : 'Server nicht erreichbar'); } finally { setLaeuft(false); }
  };
  return { fehler, laeuft, onSubmit };
}

function Feld({ label, ...rest }: { label: string } & React.InputHTMLAttributes<HTMLInputElement>) {
  return (
    <label className="fl">
      {label}
      <input required {...rest} />
    </label>
  );
}

function Anmelden({ fertig }: { fertig: () => Promise<void> }) {
  const [email, setEmail] = useState('');
  const [passwort, setPasswort] = useState('');
  const f = useFormular(async () => { await api('/api/anmelden', { method: 'POST', body: { email, passwort } }); await fertig(); });
  return (
    <Rahmen titel="Anmelden" text="Zugang für das Trainerteam.">
      <form className="zugang-form" onSubmit={f.onSubmit}>
        <Feld label="E-Mail" type="email" autoComplete="username" value={email} onChange={(e) => setEmail(e.target.value)} />
        <Feld label="Passwort" type="password" autoComplete="current-password" value={passwort} onChange={(e) => setPasswort(e.target.value)} />
        {f.fehler && <p className="form-fehler" role="alert">{f.fehler}</p>}
        <button className="btn" disabled={f.laeuft}>Anmelden</button>
      </form>
    </Rahmen>
  );
}

function KontoFelder({ v, set }: { v: { name: string; email: string; passwort: string }; set: (v: { name: string; email: string; passwort: string }) => void }) {
  return (
    <>
      <Feld label="Name" autoComplete="name" value={v.name} onChange={(e) => set({ ...v, name: e.target.value })} />
      <Feld label="E-Mail" type="email" autoComplete="username" value={v.email} onChange={(e) => set({ ...v, email: e.target.value })} />
      <Feld label="Passwort (mindestens 10 Zeichen)" type="password" autoComplete="new-password" minLength={10} value={v.passwort} onChange={(e) => set({ ...v, passwort: e.target.value })} />
    </>
  );
}

function Einrichten({ fertig }: { fertig: () => Promise<void> }) {
  const [v, set] = useState({ name: '', email: '', passwort: '' });
  const [schluessel, setSchluessel] = useState('');
  const f = useFormular(async () => { await api('/api/einrichten', { method: 'POST', body: { ...v, einrichtungsschluessel: schluessel } }); await fertig(); });
  return (
    <Rahmen titel="11Plan einrichten" text="Einmalig: das erste Trainerkonto anlegen. Den Einrichtungsschlüssel findest du in der Datei .env auf dem Server.">
      <form className="zugang-form" onSubmit={f.onSubmit}>
        <Feld label="Einrichtungsschlüssel" autoComplete="off" value={schluessel} onChange={(e) => setSchluessel(e.target.value)} />
        <KontoFelder v={v} set={set} />
        {f.fehler && <p className="form-fehler" role="alert">{f.fehler}</p>}
        <button className="btn" disabled={f.laeuft}>Konto anlegen</button>
      </form>
    </Rahmen>
  );
}

function Einladung({ token, fertig }: { token: string; fertig: () => Promise<void> }) {
  const [gueltig, setGueltig] = useState<boolean | null>(null);
  const [v, set] = useState({ name: '', email: '', passwort: '' });
  useEffect(() => { api<{ gueltig: boolean }>(`/api/einladungen/${token}`).then((r) => setGueltig(r.gueltig), () => setGueltig(false)); }, [token]);
  const f = useFormular(async () => { await api(`/api/einladungen/${token}/annehmen`, { method: 'POST', body: v }); await fertig(); });
  if (gueltig === null) return <Rahmen titel="Einladung wird geprüft …" />;
  if (!gueltig)
    return (
      <Rahmen titel="Einladung nicht mehr gültig" text="Der Link wurde schon benutzt oder ist älter als 7 Tage. Bitte im Trainerteam um einen neuen Link.">
        <a className="btn ghost" href="#/" onClick={() => window.setTimeout(() => window.location.reload(), 0)}>Zur Anmeldung</a>
      </Rahmen>
    );
  return (
    <Rahmen titel="Willkommen im Trainerteam" text="Lege dein eigenes Konto an. Danach arbeitest du auf denselben Daten wie das übrige Trainerteam.">
      <form className="zugang-form" onSubmit={f.onSubmit}>
        <KontoFelder v={v} set={set} />
        {f.fehler && <p className="form-fehler" role="alert">{f.fehler}</p>}
        <button className="btn" disabled={f.laeuft}>Konto anlegen</button>
      </form>
    </Rahmen>
  );
}

/** Kleines Menü oben rechts: wer ist angemeldet, Trainer einladen, abmelden. */
export function KontoMenue({ sitzung }: { sitzung: Sitzung }) {
  const [offen, setOffen] = useState(false);
  const [link, setLink] = useState('');
  const [fehler, setFehler] = useState('');
  const einladen = async () => {
    setFehler('');
    try { setLink((await api<{ link: string }>('/api/einladungen', { method: 'POST' })).link); } catch (e) { setFehler(e instanceof ApiError ? e.message : 'Server nicht erreichbar'); }
  };
  return (
    <div className="entwurf konto">
      <button className="konto-knopf" aria-expanded={offen} onClick={() => setOffen(!offen)} title={sitzung.nutzer.email}>
        {sitzung.nutzer.name.split(' ').map((w) => w[0]).join('').slice(0, 2).toUpperCase()}
      </button>
      {offen && (
        <div className="konto-menue card">
          <strong>{sitzung.nutzer.name}</strong>
          <span className="note">Trainer · {sitzung.nutzer.email}</span>
          <>
              <button className="btn small" onClick={() => void einladen()}>Trainer einladen</button>
              {link && (
                <div className="einladung-link">
                  <input readOnly value={link} onFocus={(e) => e.target.select()} aria-label="Einladungslink" />
                  <button className="btn small" onClick={() => void navigator.clipboard?.writeText(link)}>Kopieren</button>
                  <span className="note">Gilt 7 Tage und nur einmal. Per WhatsApp oder E-Mail weitergeben.</span>
                </div>
              )}
              {fehler && <p className="form-fehler">{fehler}</p>}
          </>
          <button className="btn small ghost" onClick={sitzung.abmelden}>Abmelden</button>
        </div>
      )}
    </div>
  );
}
