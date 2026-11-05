import { useEffect, useRef, useState, type ReactNode } from 'react';
import type { DataStatus } from '../domain/types';
import { FLAG_LABEL, type FV } from '../dossier/model';

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
// Diktat – nur, wenn der Browser Spracherkennung anbietet
// ---------------------------------------------------------------------------

type SpeechRecognitionLike = {
  lang: string;
  continuous: boolean;
  interimResults: boolean;
  start: () => void;
  stop: () => void;
  onresult: ((e: { resultIndex: number; results: ArrayLike<ArrayLike<{ transcript: string }> & { isFinal: boolean }> }) => void) | null;
  onend: (() => void) | null;
  onerror: ((e: { error: string }) => void) | null;
};

function speechCtor(): (new () => SpeechRecognitionLike) | null {
  if (typeof window === 'undefined') return null;
  const w = window as unknown as Record<string, unknown>;
  return (w.SpeechRecognition || w.webkitSpeechRecognition || null) as (new () => SpeechRecognitionLike) | null;
}

export const speechSupported = () => speechCtor() !== null;

export function TextArea({ label, value, onChange, hint, placeholder, rows = 3, dictation = false, id: givenId }: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  hint?: ReactNode;
  placeholder?: string;
  rows?: number;
  dictation?: boolean;
  id?: string;
}) {
  const autoId = useId('ta');
  const id = givenId ?? autoId;
  const [listening, setListening] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const recRef = useRef<SpeechRecognitionLike | null>(null);
  const valueRef = useRef(value);
  valueRef.current = value;
  const Ctor = dictation ? speechCtor() : null;

  useEffect(() => () => recRef.current?.stop(), []);

  const toggle = () => {
    if (!Ctor) return;
    if (listening) {
      recRef.current?.stop();
      return;
    }
    const rec = new Ctor();
    rec.lang = 'de-DE';
    rec.continuous = true;
    rec.interimResults = false;
    rec.onresult = (e) => {
      let add = '';
      for (let i = e.resultIndex; i < e.results.length; i++) if (e.results[i].isFinal) add += e.results[i][0].transcript;
      if (add.trim()) onChange((valueRef.current ? valueRef.current.trimEnd() + ' ' : '') + add.trim());
    };
    rec.onerror = (e) => setErr(e.error === 'not-allowed' ? 'Mikrofon nicht freigegeben – bitte Texteingabe nutzen.' : 'Diktat nicht verfügbar – bitte Texteingabe nutzen.');
    rec.onend = () => setListening(false);
    recRef.current = rec;
    setErr(null);
    try {
      rec.start();
      setListening(true);
    } catch {
      setErr('Diktat konnte nicht gestartet werden.');
    }
  };

  return (
    <Field label={label} hint={hint} htmlFor={id}>
      <div className="textarea-wrap">
        <textarea id={id} className="input textarea" rows={rows} value={value} placeholder={placeholder} onChange={(e) => onChange(e.target.value)} />
        {Ctor && (
          <button type="button" className={`btn btn-icon dictate ${listening ? 'is-on' : ''}`} onClick={toggle} aria-pressed={listening} aria-label={listening ? 'Diktat beenden' : 'Diktieren'} title={listening ? 'Diktat beenden' : 'Diktieren (Spracherkennung des Browsers)'}>
            {listening ? '■' : '🎙'}
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
