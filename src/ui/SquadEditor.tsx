import { useState } from 'react';
import { uid } from '../domain/factory';
import type { Player } from '../domain/types';

const POSITIONS = ['Tor', 'Abwehr', 'Mittelfeld', 'Angriff'];

/** Editierbare Kaderliste. Änderungen erfolgen nur durch ausdrückliche Aktionen des Trainers. */
export function SquadEditor({ players, onChange }: { players: Player[]; onChange: (p: Player[]) => void }) {
  const [bulk, setBulk] = useState('');
  const set = (i: number, patch: Partial<Player>) => onChange(players.map((p, j) => (j === i ? { ...p, ...patch } : p)));
  const remove = (i: number) => onChange(players.filter((_, j) => j !== i));
  const move = (i: number, d: -1 | 1) => {
    const j = i + d;
    if (j < 0 || j >= players.length) return;
    const next = [...players];
    [next[i], next[j]] = [next[j], next[i]];
    onChange(next);
  };
  const addBulk = () => {
    const lines = bulk.split('\n').map((l) => l.trim()).filter(Boolean);
    const add = lines.map((l) => {
      const m = /^(\d{1,2})\s+(.+?)(?:\s*[,;]\s*(.+))?$/.exec(l);
      return m ? { id: uid('sp'), number: m[1], name: m[2], position: m[3] ?? '' } : { id: uid('sp'), name: l, number: '', position: '' };
    });
    onChange([...players, ...add]);
    setBulk('');
  };

  return (
    <div className="squad-editor">
      {players.length === 0 && <p className="muted">Noch keine Spieler erfasst.</p>}
      <ol className="squad-list">
        {players.map((p, i) => (
          <li key={p.id} className="squad-row">
            <input className="input input-num" aria-label={`Rückennummer Spieler ${i + 1}`} value={p.number ?? ''} inputMode="numeric" placeholder="Nr." onChange={(e) => set(i, { number: e.target.value })} />
            <input className="input" aria-label={`Name Spieler ${i + 1}`} value={p.name} placeholder="Name" onChange={(e) => set(i, { name: e.target.value })} />
            <select className="input input-pos" aria-label={`Position Spieler ${i + 1}`} value={p.position ?? ''} onChange={(e) => set(i, { position: e.target.value })}>
              <option value="">Position</option>
              {POSITIONS.map((x) => (
                <option key={x}>{x}</option>
              ))}
              {p.position && !POSITIONS.includes(p.position) && <option>{p.position}</option>}
            </select>
            <div className="squad-btns">
              <button type="button" className="btn btn-icon" aria-label="Nach oben" onClick={() => move(i, -1)}>
                ↑
              </button>
              <button type="button" className="btn btn-icon" aria-label="Nach unten" onClick={() => move(i, 1)}>
                ↓
              </button>
              <button type="button" className="btn btn-icon btn-danger-ghost" aria-label={`${p.name || 'Spieler'} entfernen`} onClick={() => remove(i)}>
                ✕
              </button>
            </div>
          </li>
        ))}
      </ol>
      <div className="row wrap gap">
        <button type="button" className="btn" onClick={() => onChange([...players, { id: uid('sp'), name: '', number: '', position: '' }])}>
          + Spieler hinzufügen
        </button>
      </div>
      <details className="details">
        <summary>Mehrere Spieler auf einmal einfügen</summary>
        <textarea className="input textarea" rows={4} value={bulk} onChange={(e) => setBulk(e.target.value)} placeholder={'Eine Zeile je Spieler, z. B.\n7 Max Mustermann, Angriff'} aria-label="Spielerliste einfügen" />
        <button type="button" className="btn" onClick={addBulk} disabled={!bulk.trim()}>
          Übernehmen
        </button>
      </details>
    </div>
  );
}
