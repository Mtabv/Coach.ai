import type { DataSourceChoice, SourcePriority, TeamProfile } from './types';

/** Festgelegt mit dem Trainer am 06.11.2026: amtliche Zahlen von fussball.de, Kaderangaben von FuPa. */
export const DEFAULT_SOURCE_PRIORITY: SourcePriority = {
  tabelle: 'fussball.de',
  saisontore: 'fussball.de',
  rueckennummer: 'FuPa',
  kapitaen: 'FuPa',
  trainer: 'FuPa',
};

export const SOURCE_PRIORITY_FIELDS: { key: keyof SourcePriority; label: string; hint: string }[] = [
  { key: 'tabelle', label: 'Tabelle', hint: 'Platz, Spiele, Bilanz, Tore, Punkte, Punktabzug' },
  { key: 'saisontore', label: 'Saisontore je Spieler', hint: 'fussball.de: Torjägerliste (nur Liga) · FuPa: Kaderstatistik' },
  { key: 'rueckennummer', label: 'Rückennummer', hint: 'fussball.de: aus Spielberichten · FuPa: Kader' },
  { key: 'kapitaen', label: 'Kapitän', hint: 'fussball.de: aus Spielberichten · FuPa: Kader' },
  { key: 'trainer', label: 'Trainer des Gegners', hint: 'fussball.de: letzter Spielbericht · FuPa: Trainerteam' },
];

export function sourcePriorityOf(team: Pick<TeamProfile, 'sourcePriority'>): SourcePriority {
  return { ...DEFAULT_SOURCE_PRIORITY, ...(team.sourcePriority ?? {}) };
}

/** Wählt den Wert der bevorzugten Quelle; die andere nur, wenn die bevorzugte keinen Wert hat. */
export function pick<T>(choice: DataSourceChoice, fd: T | null | undefined, fupa: T | null | undefined): { value: T | null; from: DataSourceChoice | null } {
  const [first, second, a, b] = choice === 'FuPa' ? (['FuPa', 'fussball.de', fupa, fd] as const) : (['fussball.de', 'FuPa', fd, fupa] as const);
  if (a !== null && a !== undefined) return { value: a, from: first };
  if (b !== null && b !== undefined) return { value: b, from: second };
  return { value: null, from: null };
}
