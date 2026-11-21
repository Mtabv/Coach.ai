import type { AppState } from '../../domain/types';
import { href } from '../../router';
import { eingebettet } from '../zugang/vorbereitung';

/**
 * „Als PDF speichern“: Eingebettet in die Teamzentrale druckt der Browser sonst nur den Rahmen (mit Rändern,
 * abgeschnittenen Inhalten). Deshalb dort ein eigenes Fenster mit der Druckansicht im Querformat; der aktuelle
 * Stand wird direkt übergeben, der Druckdialog startet von selbst, sobald alle Bilder geladen sind.
 */
export function PdfKnopf({ state, dossierId, label }: { state: AppState; dossierId: string; label: string }) {
  if (!eingebettet) return <a className="btn" href={href({ name: 'druck', dossierId })}>{label}</a>;
  return (
    <button
      type="button"
      className="btn"
      onClick={() => {
        (window as unknown as { __11planDruckStand?: AppState }).__11planDruckStand = state;
        const w = window.open(`/?dossier=1&drucken=1${href({ name: 'druck', dossierId })}`, '_blank');
        if (!w) window.alert('Das Fenster für die PDF wurde blockiert. Bitte Pop-ups für 11plan.de erlauben und noch einmal tippen.');
      }}
    >
      {label}
    </button>
  );
}
