/**
 * Sprachaufnahme im Browser und Umwandlung in Text auf dem eigenen Server (/api/sprache, Whisper).
 * Gemeinsam genutzt von der Teamzentrale und dem Spieltagsdossier.
 */
export const MAX_SEKUNDEN = 300;

export const diktatMoeglich = () =>
  typeof navigator !== 'undefined' && !!navigator.mediaDevices?.getUserMedia && typeof MediaRecorder !== 'undefined';

export interface Aufnahme {
  /** Zeitpunkt des Starts (ms) für die Anzeige der Dauer. */
  start: number;
  /** Beendet die Aufnahme und liefert die Tondaten. */
  stoppen(): Promise<Blob>;
}

export async function aufnahmeStarten(): Promise<Aufnahme> {
  let stream: MediaStream;
  try { stream = await navigator.mediaDevices.getUserMedia({ audio: true }); }
  catch { throw new Error('Mikrofon nicht erlaubt'); }
  const typ = ['audio/webm;codecs=opus', 'audio/mp4', 'audio/webm', 'audio/ogg;codecs=opus'].find((x) => MediaRecorder.isTypeSupported?.(x));
  const rec = new MediaRecorder(stream, typ ? { mimeType: typ } : undefined);
  const teile: Blob[] = [];
  rec.ondataavailable = (e) => { if (e.data.size) teile.push(e.data); };
  rec.start(1000);
  return {
    start: Date.now(),
    stoppen: () => new Promise<Blob>((fertig) => {
      rec.onstop = () => {
        stream.getTracks().forEach((t) => t.stop());
        fertig(new Blob(teile, { type: rec.mimeType || typ || 'audio/webm' }));
      };
      if (rec.state !== 'inactive') rec.stop(); else rec.onstop(new Event('stop'));
    }),
  };
}

/** Schickt die Aufnahme an den Server und liefert den erkannten Text. */
export async function inText(blob: Blob, hinweis = ''): Promise<string> {
  if (blob.size < 1000) return '';
  const r = await fetch('/api/sprache', {
    method: 'POST', credentials: 'same-origin', body: blob,
    headers: { 'X-CoachAI': '1', 'Content-Type': blob.type || 'application/octet-stream', ...(hinweis ? { 'X-Hinweis': encodeURIComponent(hinweis) } : {}) },
  });
  const b = await r.json().catch(() => ({})) as { text?: string; fehler?: string };
  if (!r.ok) throw new Error(b.fehler || 'Umwandlung fehlgeschlagen');
  return (b.text || '').trim();
}

/** Text an vorhandenen Inhalt anhängen (Satzende → Leerzeichen, sonst Leerzeichen). */
export function anhaengen(alt: string, neu: string): string {
  const v = alt.replace(/\s+$/, '');
  if (!neu) return alt;
  return v ? `${v}${v.endsWith('\n') ? '' : ' '}${neu}` : neu;
}

export const dauer = (ms: number) => { const s = Math.floor(ms / 1000); return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`; };

export const MIC_SVG = '<svg viewBox="0 0 24 24" width="15" height="15" aria-hidden="true" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="9" y="3" width="6" height="11" rx="3"/><path d="M5 11a7 7 0 0 0 14 0M12 18v3"/></svg>';
