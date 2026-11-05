import { buildDossier } from '../dossier/build';
import type { DossierContent, Slide } from '../dossier/model';
import { applyOverrides } from '../dossier/overrides';
import type { AppState, DossierRecord } from '../domain/types';

/** Bestätigte Dossiers liefern immer den eingefrorenen Stand – nie eine Neuberechnung. */
export function contentForDossier(s: AppState, d: DossierRecord): DossierContent | null {
  if (d.status === 'bestätigt') return d.frozen;
  const team = s.teams.find((t) => t.id === d.teamId);
  const match = s.matches.find((m) => m.id === d.matchId);
  const prep = s.preparations[d.matchId];
  if (!team || !match || !prep) return null;
  return applyOverrides(buildDossier(team, match, prep), d.overrides);
}

export interface EditableField {
  path: string;
  label: string;
  multiline?: boolean;
}

/** Frei bearbeitbare Texte je Seite. Faktenwerte (Zahlen, Tabellen) sind bewusst nicht dabei. */
export function editableFields(slide: Slide): EditableField[] {
  const k = slide.key;
  const f: EditableField[] = [
    { path: `${k}.title`, label: 'Seitentitel' },
    { path: `${k}.kicker`, label: 'Dachzeile' },
  ];
  switch (slide.key) {
    case 'inhalt':
      slide.items.forEach((it, i) => f.push({ path: `${k}.items.${i}.text`, label: `Beschreibung „${it.title}“` }));
      break;
    case 'soSpieltGegner':
      slide.phases.forEach((p, i) => f.push({ path: `${k}.phases.${i}.value.text`, label: `${p.label} (Trainerbeobachtung)`, multiline: true }));
      break;
    case 'gegnerGefahr':
      slide.players.forEach((p, i) => f.push({ path: `${k}.players.${i}.coachNote`, label: `Trainerhinweis zu ${p.name}`, multiline: true }));
      break;
    case 'kader':
      f.push({ path: `${k}.note`, label: 'Hinweis zum Kader', multiline: true });
      break;
    default:
      break;
  }
  if (slide.key !== 'titel') f.push({ path: `${k}.footnote`, label: 'Fußnote', multiline: true });
  return f;
}
