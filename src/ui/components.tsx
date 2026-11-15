import { useEffect, useRef, useState, type ReactNode } from 'react';
import type { DataStatus } from '../domain/types';
import { FLAG_LABEL, type FV } from '../dossier/model';
import { isEmbeddedHost } from '../export/hostBridge';
import { MAX_SEKUNDEN, MIC_SVG, anhaengen, aufnahmeStarten, dauer, diktatMoeglich, inText, type Aufnahme } from '../sprache/aufnahme';

export function Badge({ tone = 'neutral', children, title }: { tone?: 'neutral' | 'ok' | 'warn' | 'danger' | 'info' | 'demo' | 'dark' | 'lime'; children: ReactNode; title?: string }) {
  return (
    <span className={`badge badge-${tone}`} title={title}>
      {children}
    </span>
  );
}

const STATUS_TONE: Record<DataStatus, 'ok' | 'warn' | 'danger' | 'info' | 'neutral'> = {
  vorhanden: 'info',
  fehlend: 'warn',
  veraltet: 'warn',
  widersprüchlich: 'danger',
  bestätigt: 'ok',
};

const STATUS_ICON: Record<DataStatus, string> = {
  vorhanden: '●',
  fehlend: '○',
  veraltet: '◷',
  widersprüchlich: '⚠',
  bestätigt: '✓',
};

export function StatusBadge({ status }: { status: DataStatus }) {
  return (
    <Badge tone={STATUS_TONE[status]}>
      <span aria-hidden>{STATUS_ICON[status]}</span> {status}
    </Badge>
  );
}

export function DemoBadge({ children = 'Beispieldaten' }: { children?: ReactNode }) {
  return <Badge tone="demo">{children}</Badge>;
}

/** Wert mit Kennzeichnung; ungesicherte Werte sind nie unmarkiert. */
export function Flagged({ v }: { v: FV }) {
  if (v.flag === 'ok') return <>{v.text}</>;
  return (
    <span className={`flag flag-${v.flag}`} title={v.note}>
      {v.text}
      {v.flag !== 'trainer' && <small className="flag-label">{FLAG_LABEL[v.flag]}</small>}
    </span>
  );
}

export function Card({ title, actions, children, className = '', id }: { title?: ReactNode; actions?: ReactNode; children: ReactNode; className?: string; id?: string }) {
  return (
    <section className={`card ${className}`} id={id}>
      {(title || actions) && (
        <header className="card-head">
          {title && <h2 className="card-title">{title}</h2>}
          {actions && <div className="card-actions">{actions}</div>}
        </header>
      )}
      {children}
    </section>
  );
}

export function Notice({ tone = 'info', children, title }: { tone?: 'info' | 'warn' | 'danger' | 'ok' | 'demo'; children: ReactNode; title?: string }) {
  return (
    <div className={`notice notice-${tone}`} role={tone === 'danger' ? 'alert' : undefined}>
      {title && <strong className="notice-title">{title}</strong>}
      <div>{children}</div>
    </div>
  );
}

export function Field({ label, hint, children, htmlFor }: { label: string; hint?: ReactNode; children: ReactNode; htmlFor?: string }) {
  return (
    <div className="field">
      <label className="field-label" htmlFor={htmlFor}>
        {label}
      </label>
      {children}
      {hint && <div className="field-hint">{hint}</div>}
    </div>
  );
}

let idCounter = 0;
export function useId(prefix = 'f'): string {
  const ref = useRef<string>('');
  if (!ref.current) ref.current = `${prefix}-${++idCounter}`;
  return ref.current;
}

export function TextInput({ label, value, onChange, hint, type = 'text', placeholder, inputMode, required }: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  hint?: ReactNode;
  type?: string;
  placeholder?: string;
  inputMode?: 'text' | 'numeric' | 'url';
  required?: boolean;
}) {
  const id = useId('in');
  return (
    <Field label={label + (required ? ' *' : '')} hint={hint} htmlFor={id}>
      <input id={id} className="input" type={type} value={value} placeholder={placeholder} inputMode={inputMode} onChange={(e) => onChange(e.target.value)} />
    </Field>
  );
}

// ---------------------------------------------------------------------------
// Diktat – Aufnahme im Browser, Umwandlung auf dem eigenen Server (Whisper)
// ---------------------------------------------------------------------------

/** Diktieren geht, wenn der Browser aufnehmen kann und die App auf dem 11Plan-Server läuft. */
const diktatHier = () => diktatMoeglich() && !isEmbeddedHost() && /^https?:$/.test(window.location.protocol);
export const speechSupported = () => diktatHier();

export function TextArea({ label, value, onChange, hint, placeholder, rows = 3, dictation = true, id: givenId }: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  hint?: ReactNode;
  placeholder?: string;
  rows?: number;
  /** Mikrofon am Feld (Standard: an). */
  dictation?: boolean;
  id?: string;
}) {
  const autoId = useId('ta');
  const id = givenId ?? autoId;
  const [zustand, setZustand] = useState<'bereit' | 'rec' | 'arbeit'>('bereit');
  const [sek, setSek] = useState(0);
  const [err, setErr] = useState<string | null>(null);
  const aufnahme = useRef<Aufnahme | null>(null);
  const valueRef = useRef(value);
  valueRef.current = value;
  const an = dictation && diktatHier();

  useEffect(() => {
    if (zustand !== 'rec') return;
    const t = window.setInterval(() => {
      const ms = Date.now() - (aufnahme.current?.start ?? Date.now());
      setSek(Math.floor(ms / 1000));
      if (ms > MAX_SEKUNDEN * 1000) void toggle();
    }, 500);
    return () => window.clearInterval(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [zustand]);
  useEffect(() => () => { void aufnahme.current?.stoppen(); }, []);

  const toggle = async () => {
    if (zustand === 'arbeit') return;
    setErr(null);
    if (zustand === 'rec' && aufnahme.current) {
      const a = aufnahme.current;
      aufnahme.current = null;
      setZustand('arbeit');
      try {
        const text = await inText(await a.stoppen());
        if (text) onChange(anhaengen(valueRef.current, text));
        else setErr('Nichts verstanden – bitte nochmal.');
      } catch (e) {
        setErr(`Diktat: ${(e as Error).message}`);
      } finally {
        setZustand('bereit');
      }
      return;
    }
    try {
      aufnahme.current = await aufnahmeStarten();
      setSek(0);
      setZustand('rec');
    } catch (e) {
      setErr(`${(e as Error).message} – bitte Texteingabe nutzen.`);
    }
  };

  return (
    <Field label={label} hint={hint} htmlFor={id}>
      <div className="textarea-wrap">
        <textarea id={id} className="input textarea" rows={rows} value={value} placeholder={placeholder} onChange={(e) => onChange(e.target.value)} />
        {an && (
          <button type="button" className={`btn btn-icon dictate ${zustand === 'rec' ? 'is-on' : ''}`} onClick={() => void toggle()} disabled={zustand === 'arbeit'} aria-pressed={zustand === 'rec'}
            aria-label={zustand === 'rec' ? 'Aufnahme beenden' : zustand === 'arbeit' ? 'wird umgewandelt' : 'In dieses Feld diktieren'}
            title={zustand === 'rec' ? 'Aufnahme beenden' : zustand === 'arbeit' ? 'wird in Text umgewandelt …' : 'In dieses Feld diktieren'}>
            {zustand === 'rec' ? <span className="dictate-zeit">● {dauer(sek * 1000)}</span> : zustand === 'arbeit' ? <span className="dictate-kreis" /> : <span dangerouslySetInnerHTML={{ __html: MIC_SVG }} />}
          </button>
        )}
      </div>
      {err && <div className="field-hint warn">{err}</div>}
    </Field>
  );
}

export function Segmented<T extends string>({ value, options, onChange, label }: { value: T; options: { value: T; label: string }[]; onChange: (v: T) => void; label: string }) {
  return (
    <div className="segmented" role="radiogroup" aria-label={label}>
      {options.map((o) => (
        <button key={o.value} type="button" role="radio" aria-checked={value === o.value} className={value === o.value ? 'is-active' : ''} onClick={() => onChange(o.value)}>
          {o.label}
        </button>
      ))}
    </div>
  );
}

export function Toast({ message, onDone }: { message: string | null; onDone: () => void }) {
  useEffect(() => {
    if (!message) return;
    const t = window.setTimeout(onDone, 2600);
    return () => window.clearTimeout(t);
  }, [message, onDone]);
  if (!message) return null;
  return (
    <div className="toast" role="status">
      {message}
    </div>
  );
}

export function ProgressBar({ value, total, label }: { value: number; total: number; label: string }) {
  const pct = total ? Math.round((value / total) * 100) : 0;
  return (
    <div className="progress" aria-label={label}>
      <div className="progress-top">
        <span>{label}</span>
        <span className="num">
          {value}/{total}
        </span>
      </div>
      <div className="progress-track">
        <div className="progress-fill" style={{ width: `${pct}%` }} />
      </div>
    </div>
  );
}

/**
 * Zweistufige Bestätigung ohne Browser-Dialog: erster Klick fragt nach,
 * zweiter Klick führt aus. Funktioniert auch in eingebetteten Ansichten.
 */
export function ConfirmAction({ label, confirmLabel, onConfirm, className = 'btn btn-danger-ghost', skip = false }: {
  label: string;
  confirmLabel: string;
  onConfirm: () => void;
  className?: string;
  skip?: boolean;
}) {
  const [armed, setArmed] = useState(false);
  useEffect(() => {
    if (!armed) return;
    const t = window.setTimeout(() => setArmed(false), 6000);
    return () => window.clearTimeout(t);
  }, [armed]);
  return (
    <span className="row gap wrap">
      <button
        type="button"
        className={`${className} ${armed ? 'is-armed' : ''}`}
        onClick={() => {
          if (skip || armed) {
            setArmed(false);
            onConfirm();
          } else setArmed(true);
        }}
      >
        {armed ? confirmLabel : label}
      </button>
      {armed && (
        <button type="button" className="btn btn-small btn-ghost" onClick={() => setArmed(false)}>
          Abbrechen
        </button>
      )}
    </span>
  );
}
