import { samePerson } from '../data/fupa/mapping';
import { analyzeTable } from '../domain/dataQuality';
import { formFacts, goalPhases, keyStats } from '../domain/insights';
import { selectKeyPlayers, type SelectedPlayer } from '../domain/players';
import { kitLabel } from '../domain/questionnaire';
import { normalizeName, opponentKpis, seasonSummary, teamResults, type TeamResult } from '../domain/stats';
import { computeAwaySchedule, computeHomeSchedule, formatDate, isValidDate, isValidTime } from '../domain/time';
import type { Answer, KitCombination, Match, Preparation, QuestionId, SourceRef, TeamProfile } from '../domain/types';
import { fv, type DossierContent, type FV, type FormSlide, type KitView, type RecordLine, type Slide, type SquadCard } from './model';

/**
 * Baut den Dossierinhalt deterministisch aus Profil, Spiel und Vorbereitung.
 * Es werden keine Zahlen, taktischen Eigenschaften oder Botschaften erfunden:
 * Fehlendes wird als „offen“, Widersprüchliches als „widersprüchlich“ markiert.
 */

const SLIDE_TITLES = {
  titel: 'Spieltagsdossier',
  inhalt: 'Was euch erwartet',
  spieltag: 'Der Spieltag',
  unserSpiel: 'Unser Spiel',
  gegnerForm: 'Der Gegner · Form',
  gegnerGefahr: 'Der Gegner · Gefahr',
  gegnerAuffaelligkeiten: 'Der Gegner · Auffälligkeiten',
  soSpieltGegner: 'So spielt der Gegner',
  unsereForm: '· Unsere Form',
  kader: 'Unser Kader',
  auftrag: 'Unser Auftrag',
} as const;

function srcLabel(s: SourceRef): string {
  return s.asOf ? `${s.label}, Stand ${s.asOf}` : s.label;
}

/** Kurze Quellenangabe für die Fußzeile: nur der Name der Quelle („fussball.de“, „FuPa“). */
function srcShort(s: SourceRef): string {
  if (s.kind === 'demo') return 'Beispieldaten';
  if (/fussball\.de/i.test(s.label)) return 'fussball.de';
  if (/fupa/i.test(s.label)) return 'FuPa';
  return s.label.replace(/\s*\(.*?\)/g, '').replace(/,.*$/, '').trim();
}

const WEEKDAY_SHORT = ['So', 'Mo', 'Di', 'Mi', 'Do', 'Fr', 'Sa'];
function dayLabel(d: string | undefined): string {
  if (!d || !isValidDate(d)) return '';
  const [y, m, day] = d.split('-').map(Number);
  return `${WEEKDAY_SHORT[new Date(Date.UTC(y, m - 1, day)).getUTCDay()]} ${String(day).padStart(2, '0')}.${String(m).padStart(2, '0')}.`;
}

/**
 * Gefahr-Folie: neben dem Trainerhinweis nur herausragende Saisonzahlen (Tore, Vorlagen). Nicht gezeigt werden
 * Tore „in den letzten 5 Spielen“, Startelf-Einsätze, der Platz in der Torjägerliste und Nullwerte.
 */
export function standoutReasons(reasons: string[]): string[] {
  return reasons
    .filter((r) => !/^FuPa-MVP-Wert/.test(r) && !/in den letzten \d+ Ligaspiel/.test(r) && !/^In der Startelf/.test(r) && !/^\d+ Einsätze/.test(r))
    .map((r) => r.replace(/\s*\(Platz \d+ der Torjägerliste\)/, '').replace(/ in der Liga$/, ''))
    .slice(0, 3);
}

function crestFor(crests: Record<string, string> | undefined, team: string): string | undefined {
  if (!crests) return undefined;
  const key = Object.keys(crests).find((k) => normalizeName(k) === normalizeName(team));
  return key ? crests[key] : undefined;
}

function kitView(kit: KitCombination | null, team: TeamProfile): KitView {
  if (!kit || !(kit.shirt || kit.shorts || kit.socks)) return { label: fv('Spielkleidung offen', 'offen'), images: [] };
  const same = (k: KitCombination | null) => k && k.shirt === kit.shirt && k.shorts === kit.shorts && k.socks === kit.socks;
  const imgs = kit.images ?? (same(team.kits.home) ? team.kits.home?.images : same(team.kits.away) ? team.kits.away?.images : undefined) ?? {};
  const images: KitView['images'] = [];
  if (imgs.shirt) images.push({ part: 'Trikot', src: imgs.shirt, text: kit.shirt });
  if (imgs.shorts) images.push({ part: 'Hose', src: imgs.shorts, text: kit.shorts });
  if (imgs.socks) images.push({ part: 'Stutzen', src: imgs.socks, text: kit.socks });
  return { label: fv(kitLabel(kit), /Beispiel/i.test(kitLabel(kit)) ? 'beispiel' : 'ok'), images };
}

function sourceById(prep: Preparation, id: string): SourceRef | undefined {
  for (const b of Object.values(prep.dataBlocks)) {
    const s = b.provenance.sources.find((x: SourceRef) => x.id === id);
    if (s) return s;
  }
  return undefined;
}

function shortDate(d: string): string {
  if (!isValidDate(d)) return d;
  const [, m, day] = d.split('-');
  return `${day}.${m}.`;
}

function answerFV(a: Answer | undefined, emptyText = 'Keine Beobachtung erfasst'): FV {
  if (!a || a.state === 'offen' || (a.state === 'beantwortet' && !a.text.trim())) return fv(emptyText, 'offen');
  if (a.state === 'nicht_bekannt') return fv('Nicht bekannt', 'trainer');
  if (a.state === 'keine_abweichung') return fv('Keine Abweichung', 'trainer');
  return fv(a.text.trim(), a.origin === 'beispiel' ? 'beispiel' : 'trainer');
}

function last5Rows(rs: TeamResult[]) {
  return rs.map((r) => ({
    date: shortDate(r.date),
    opponent: r.opponent,
    ha: (r.isHome ? 'H' : 'A') as 'H' | 'A',
    result: `${r.goalsFor}:${r.goalsAgainst}`,
    outcome: r.outcome,
  }));
}

function unbeatenStreak(rs: TeamResult[]): number {
  let n = 0;
  for (const r of rs) {
    if (r.outcome === 'N') break;
    n++;
  }
  return n;
}

function winlessStreak(rs: TeamResult[]): number {
  let n = 0;
  for (const r of rs) {
    if (r.outcome === 'S') break;
    n++;
  }
  return n;
}

export function buildDossier(team: TeamProfile, match: Match, prep: Preparation): DossierContent {
  const b = prep.dataBlocks;
  const ownName = team.name;
  const opp = match.opponent || 'Gegner offen';
  const homeName = match.isHome ? ownName : opp;
  const awayName = match.isHome ? opp : ownName;
  const dateOk = isValidDate(match.date);
  const timeOk = isValidTime(match.kickoff);
  const dateText = dateOk ? formatDate(match.date, { weekday: true }) : 'Datum offen';
  const timeText = timeOk ? `${match.kickoff} Uhr` : 'Uhrzeit offen';
  const ownVenue = prep.organisation.venueOverride ?? match.venue ?? (match.isHome ? team.homeVenue : null);
  // Ohne eigene Angabe: Spielort laut Ansetzung bei fussball.de (z. B. „Hartplatz …, 35239 Steffenberg“).
  const fdVenue = b.begegnung.value?.sourceFixture?.venue;
  const venue = ownVenue?.name ? ownVenue : fdVenue ? { name: fdVenue } : ownVenue;
  const venueText = venue?.name ? [venue.name, venue.address].filter(Boolean).join(', ') : '';
  const venueFV: FV = venue?.name
    ? {
        ...fv(venueText, /Beispiel/i.test(venue.name) ? 'beispiel' : 'ok'),
        // Immer als Link zu Google Maps, damit die Spieler direkt die Route öffnen können.
        ...(/Beispiel/i.test(venue.name) ? {} : { href: `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(venueText)}` }),
      }
    : fv('Spielort offen', 'offen');
  const mdLabel = match.matchday ? `${match.matchday}. Spieltag` : match.competitionType === 'liga' ? 'Spieltag offen' : match.competitionType === 'pokal' ? 'Pokalspiel' : 'Testspiel';
  const containsDemo = Object.values(b).some((blk) => blk.provenance.sources.some((s: SourceRef) => s.kind === 'demo')) || team.isDemo || match.isDemo;

  // Eigenes Wappen aus dem Mannschaftsprofil hat Vorrang (FuPa-Wappen sind teils niedrig aufgelöst).
  const crests = { ...(b.tabelle.value?.crests ?? {}), ...(team.crest ? { [ownName]: team.crest } : {}) };
  const slides: Slide[] = [];
  const blank = { sources: [] as string[], footnote: '' };

  // 1 Titel
  slides.push({
    key: 'titel',
    number: 1,
    title: SLIDE_TITLES.titel,
    kicker: match.isHistoricalReference ? 'Historische Referenz · Beispieldaten' : `${team.shortName} · Spielvorbereitung`,
    home: homeName,
    away: awayName,
    competition: match.competition || 'Wettbewerb offen',
    matchdayLabel: mdLabel,
    dateLabel: fv(dateText, dateOk ? 'ok' : 'offen'),
    timeLabel: fv(timeText, timeOk ? 'ok' : 'offen'),
    venue: venueFV,
    ...blank,
  });

  // 2 Inhalt
  const ownFormTitle = 'Unsere Form';
  const contentItems: [string, string][] = [
    [SLIDE_TITLES.spieltag, 'Tabelle und Spieltagspaarungen'],
    [SLIDE_TITLES.unserSpiel, 'Spielort, Treffpunkt, Kleidung, direkte Duelle und Zeitplan'],
    [SLIDE_TITLES.gegnerForm, 'Letzte fünf Ligaspiele und Bilanzen'],
    [SLIDE_TITLES.gegnerGefahr, 'Gegenspieler, auf die wir achten'],
    [SLIDE_TITLES.gegnerAuffaelligkeiten, 'Kennzahlen und belegte Besonderheiten'],
    [SLIDE_TITLES.soSpieltGegner, 'Beobachtungen des Trainerteams'],
    [ownFormTitle, 'Unsere letzten fünf Ligaspiele und Bilanzen'],
    [SLIDE_TITLES.kader, 'Spieltagskader'],
    [SLIDE_TITLES.auftrag, 'Drei Botschaften und unser Leitmotiv'],
  ];
  slides.push({
    key: 'inhalt',
    number: 2,
    title: SLIDE_TITLES.inhalt,
    kicker: `${homeName} – ${awayName}`,
    items: contentItems.map(([title, text], i) => ({ number: i + 3, title, text })),
    ...blank,
  });

  // 3 Spieltag
  const ta = analyzeTable(b.tabelle, match);
  let tableStatus = fv('Tabelle liegt nicht vor', 'offen');
  if (ta.primary) {
    const unresolved = ta.conflicts.filter((c) => !c.resolution).length;
    if (unresolved) tableStatus = fv(`${unresolved} ungeklärte Abweichung(en) – betroffene Werte sind markiert`, 'widersprüchlich');
    else if (ta.primaryIsStale) tableStatus = fv(`Datenstand ${ta.primary.source.asOf} – nicht aktuell`, 'veraltet');
    else tableStatus = fv(`Stand ${ta.primary.source.asOf ?? 'unbekannt'}`, ta.primary.source.kind === 'demo' ? 'beispiel' : 'ok');
  }
  const pairings = b.spieltag.value?.pairings ?? [];
  const zones = team.leagueZones;
  const nRows = ta.rows.length;
  const zoneOf = (rank: number): 'auf' | 'relegation' | 'ab' | null => {
    if (!zones || !nRows) return null;
    if (rank <= zones.promotion) return 'auf';
    if (rank <= zones.promotion + zones.promotionPlayoff) return 'relegation';
    if (rank > nRows - zones.relegation) return 'ab';
    return null;
  };
  const zoneLegend: { zone: 'auf' | 'relegation' | 'ab'; label: string }[] = [];
  if (zones?.promotion) zoneLegend.push({ zone: 'auf', label: 'Aufstieg' });
  if (zones?.promotionPlayoff) zoneLegend.push({ zone: 'relegation', label: 'Aufstiegsrelegation' });
  if (zones?.relegation) zoneLegend.push({ zone: 'ab', label: 'Abstieg' });
  slides.push({
    key: 'spieltag',
    number: 3,
    title: SLIDE_TITLES.spieltag,
    kicker: `${match.competition} · ${mdLabel}`,
    table: ta.rows.map((r) => {
      const conflicted = r.unresolved.includes('points');
      const alt = ta.conflicts.find((c) => normalizeName(c.subject) === normalizeName(r.team) && c.field === 'points' && !c.resolution);
      return {
        rank: `${r.rank}.`,
        team: r.team,
        played: String(r.played),
        record: `${r.won}-${r.drawn}-${r.lost}`,
        goals: `${r.goalsFor}:${r.goalsAgainst}`,
        diff: `${r.goalsFor - r.goalsAgainst > 0 ? '+' : ''}${r.goalsFor - r.goalsAgainst}`,
        points: conflicted
          ? fv(alt ? [...new Set(alt.values.map((v) => v.value))].join(' / ') : String(r.points), 'widersprüchlich', alt?.label)
          : fv(String(r.points)),
        zone: zoneOf(r.rank),
        highlight: normalizeName(r.team) === normalizeName(ownName) ? 'own' : normalizeName(r.team) === normalizeName(opp) ? 'opp' : null,
      };
    }),
    tableStatus,
    zones: zoneLegend,
    pairings: pairings.map((p) => ({
      home: p.home,
      away: p.away,
      day: dayLabel(p.date),
      time: p.kickoff ? `${p.kickoff} Uhr` : '',
      highlight: [p.home, p.away].some((t) => normalizeName(t) === normalizeName(ownName)),
    })),
    sources: [...(ta.primary ? [srcShort(ta.primary.source)] : []), ...b.spieltag.provenance.sources.map(srcShort)],
    footnote: ta.rows
      .filter((r) => r.pointDeduction)
      .map((r) => `${r.team}: ${r.pointDeduction} ${r.pointDeduction === 1 ? 'Punkt' : 'Punkte'} Abzug`)
      .join(' · '),
  });

  // 4 Unser Spiel
  const sched = timeOk
    ? match.isHome
      ? computeHomeSchedule(match.kickoff!, team.schedule.home, venue?.name ?? null, prep.organisation)
      : computeAwaySchedule(match.kickoff!, team.schedule.away, prep.organisation.travelMinutes, prep.organisation)
    : null;
  const meetingFV = sched?.meetingTime
    ? fv(`${sched.meetingTime} Uhr${sched.meetingPlace ? ` · ${sched.meetingPlace}` : ''}`)
    : fv(match.isHome ? 'Treffpunkt offen' : 'Offen – Fahrzeit für diese Fahrt fehlt', 'offen');
  const facts: { label: string; value: FV }[] = [
    { label: 'Spielort', value: venueFV },
    { label: 'Wettbewerb', value: fv(`${match.competition || 'offen'} · ${mdLabel}`, match.competition ? 'ok' : 'offen') },
    { label: 'Anstoß', value: fv(`${dateText}, ${timeText}`, dateOk && timeOk ? 'ok' : 'offen') },
    { label: 'Treffpunkt', value: meetingFV },
  ];
  if (!match.isHome) {
    facts.push({
      label: 'Abfahrt',
      value: sched?.departureTime ? fv(`${sched.departureTime} Uhr ab ${team.schedule.away.departurePoint || 'Treffpunkt'} (Fahrzeit ${prep.organisation.travelMinutes} Min.)`, prep.organisation.travelSource === 'verifiziert' ? 'ok' : 'trainer') : fv('Offen – Fahrzeit fehlt', 'offen'),
    });
  }
  if (prep.organisation.notes.trim()) facts.push({ label: 'Besonderheiten', value: fv(prep.organisation.notes.trim(), 'trainer') });

  const h2h = (b.direkteDuelle.value?.games ?? []).slice().sort((x, y) => (x.date < y.date ? 1 : -1));
  slides.push({
    key: 'unserSpiel',
    number: 4,
    title: SLIDE_TITLES.unserSpiel,
    kicker: match.isHome ? 'Heimspiel' : 'Auswärtsspiel',
    facts,
    kit: kitView(prep.organisation.kit, team),
    h2h: h2h.map((g) => ({
      season: g.season,
      date: formatDate(g.date),
      competition: g.competitionLabel,
      // Aus unserer Sicht: Spielort und Ergebnis mit unseren Toren zuerst (kompakter als beide Vereinsnamen).
      match: normalizeName(g.home) === normalizeName(ownName) ? 'Heim' : 'Auswärts',
      result: normalizeName(g.home) === normalizeName(ownName) ? `${g.goalsHome}:${g.goalsAway}` : `${g.goalsAway}:${g.goalsHome}`,
    })),
    h2hNote: h2h.length ? '' : 'Keine direkten Duelle erfasst.',
    schedule: sched
      ? sched.items.map((it) => ({
          time: it.start ? fv(it.end ? `${it.start}–${it.end}` : it.start, it.overridden ? 'trainer' : 'ok') : fv('offen', 'offen'),
          label: it.label,
          note: it.openReason,
        }))
      : [],
    scheduleOpen: sched ? sched.open : ['Anstoßzeit fehlt – Zeitplan kann nicht berechnet werden.'],
    sources: h2h.length ? b.direkteDuelle.provenance.sources.map(srcShort) : [],
    footnote: '',
  });

  // 5 Gegner Form / 9 Unsere Form
  const formSlide = <K extends 'gegnerForm' | 'unsereForm'>(key: K, number: number, title: string, teamName: string, blockKey: 'ergebnisseGegner' | 'ergebnisseEigene', relevant: 'home' | 'away'): FormSlide<K> => {
    const blk = b[blockKey];
    const results = blk.value?.results ?? [];
    const s = seasonSummary(teamName, results, match.date);
    const has = s.all.played > 0;
    const rel = relevant === 'home' ? s.home : s.away;
    const tableRow = ta.rows.find((r) => normalizeName(r.team) === normalizeName(teamName));
    // Liefert die Quelle weniger Ligaspiele als die Tabelle ausweist, ist die Ergebnisliste unvollständig.
    const incomplete = Boolean(tableRow && tableRow.played > s.all.played);
    const facts: FV[] = [];
    if (has) {
      const league = teamResults(teamName, results, { type: 'liga', before: match.date });
      const ub = unbeatenStreak(league);
      const wl = winlessStreak(league);
      // Bei unvollständiger Liste: Reicht eine Serie bis an den Anfang der Liste, ist nur eine Untergrenze belegt.
      const streak = (n: number, text: string, wholeSeason: boolean, seasonText: string) => {
        if (n < 3) return;
        if (!incomplete || n < league.length) facts.push(fv(`Seit ${n} ${text}.`));
        else if (wholeSeason) facts.push(fv(`${seasonText} (laut Tabelle).`));
        else facts.push(fv(`Seit mindestens ${n} ${text}.`));
      };
      streak(ub, 'Ligaspielen ungeschlagen', Boolean(tableRow && tableRow.lost === 0), `In dieser Saison noch ungeschlagen: ${tableRow?.played} Ligaspiele`);
      streak(wl, 'Ligaspielen ohne Sieg', Boolean(tableRow && tableRow.won === 0), `In dieser Saison noch ohne Sieg: ${tableRow?.played} Ligaspiele`);
      if (!incomplete && rel.played > 0 && rel.lost === 0) facts.push(fv(`${relevant === 'home' ? 'Zu Hause' : 'Auswärts'} in dieser Saison ohne Niederlage.`));
      const own = key === 'unsereForm';
      for (const t of formFacts({ team: teamName, results, before: match.date, table: ta.rows, zones: team.leagueZones, own, roster: own ? b.ergebnisseEigene.value?.roster : undefined })) facts.push(fv(t));
      if (!own && s.otherCompetitions.length) {
        const o = s.otherCompetitions[0];
        facts.push(fv(`Nicht in der Ligaform enthalten: ${o.competitionLabel} am ${formatDate(o.date)} gegen ${o.opponent} (${o.goalsFor}:${o.goalsAgainst}).`));
      }
    }
    if (key === 'gegnerForm') {
      // Heim-/Auswärtstabelle steht schon in der Bilanztabelle.
      for (const f of (b.gegnerFakten.value?.facts ?? []).filter((x) => x.id !== 'fd-ha')) {
        const src = sourceById(prep, f.sourceId);
        facts.push(fv(f.text, src?.kind === 'demo' ? 'beispiel' : 'ok', src ? srcLabel(src) : undefined));
      }
    }
    const expectedMd = match.competitionType === 'liga' && match.matchday ? match.matchday - 1 : null;
    const leagueAll = teamResults(teamName, results, { type: 'liga', before: match.date });
    const maxMd = Math.max(0, ...leagueAll.map((r) => r.matchday ?? 0));
    const stale = expectedMd !== null && maxMd > 0 && maxMd < expectedMd;
    return {
      key,
      number,
      title,
      kicker: teamName,
      teamName,
      last5: last5Rows(s.last5).map((r) => {
        const c = crestFor(crests, r.opponent);
        return c ? { ...r, crest: c } : r;
      }),
      last5Note: has ? (s.last5.length < 5 ? `Nur ${s.last5.length} Ligaspiele vorhanden.` : 'Nur Ligaspiele – Pokal- und Testspiele nicht berücksichtigt.') : 'Keine Ligaergebnisse vorhanden.',
      records: has
        ? [
            incomplete && tableRow
              ? recordLine('Saison (laut Tabelle)', { played: tableRow.played, won: tableRow.won, drawn: tableRow.drawn, lost: tableRow.lost, goalsFor: tableRow.goalsFor, goalsAgainst: tableRow.goalsAgainst }, tableRow.unresolved.length ? 'widersprüchlich' : 'ok')
              : recordLine('Saison', s.all, stale ? 'veraltet' : 'ok'),
            ...(incomplete ? [] : [recordLine(relevant === 'home' ? 'Heim' : 'Auswärts', rel, stale ? 'veraltet' : 'ok')]),
          ]
        : [],
      recordsNote: !has
        ? fv('Keine Ligaergebnisse vorhanden', 'offen')
        : incomplete
          ? fv(`${relevant === 'home' ? 'Heim' : 'Auswärts'}bilanz unvollständig – nur ${s.all.played} von ${tableRow!.played} Ligaspielen vorhanden`, 'offen')
          : null,
      facts: facts.slice(0, 7),
      sources: [...new Set(blk.provenance.sources.map(srcShort).concat(key === 'gegnerForm' ? b.gegnerFakten.provenance.sources.map(srcShort) : []))],
      footnote: 'Bilanzen berechnet aus Ligaergebnissen.',
    };
  };

  slides.push(formSlide('gegnerForm', 5, SLIDE_TITLES.gegnerForm, opp, 'ergebnisseGegner', match.isHome ? 'away' : 'home'));

  // 6 Gefahr
  const selected = selectKeyPlayers(b.gegenspieler.value?.candidates ?? [], prep.playerHints);
  const playerSources = [...new Set(b.gegenspieler.provenance.sources.map(srcShort))];
  slides.push({
    key: 'gegnerGefahr',
    number: 6,
    title: SLIDE_TITLES.gegnerGefahr,
    kicker: opp,
    players: selected.map((p) => ({
      name: p.name,
      meta: [p.number ? `#${p.number}` : '', p.position ?? '', p.heightCm ? `${(p.heightCm / 100).toFixed(2).replace('.', ',')} m` : '', p.isCaptain ? 'Kapitän' : ''].filter(Boolean).join(' · '),
      reasons: standoutReasons(p.reasons),
      coachNote: p.coachNote,
      initials: initialsOf(p.name),
      ...(p.photo ? { photo: p.photo } : {}),
      ...(p.mvp ? { mvp: p.mvp.value } : {}),
    })),
    note:
      selected.length === 0
        ? 'Keine belegten Angaben zu Gegenspielern vorhanden.'
        : selected.length < 4
          ? `Nur ${selected.length} Spieler mit belegten Angaben – bewusst keine vier erzwungen.`
          : '',
    sources: playerSources,
    legend: '',
    footnote: selected.some((p) => p.mvp) && mvpAsOf(selected) ? `MVP-Wert laut FuPa, Stand ${mvpAsOf(selected)}` : '',
  });

  // 7 Auffälligkeiten
  const oppResults = b.ergebnisseGegner.value?.results ?? [];
  const kpis = opponentKpis(opp, oppResults, match.date, ta.rows.length ? ta.rows : null);
  const goalLog = b.ergebnisseGegner.value?.goals;
  slides.push({
    key: 'gegnerAuffaelligkeiten',
    number: 7,
    title: SLIDE_TITLES.gegnerAuffaelligkeiten,
    kicker: opp,
    kpis: kpis.map((k) => ({ label: k.label, value: k.value, basis: k.basis })),
    phases: goalLog && goalLog.games.length >= 3 ? goalPhases(goalLog) : [],
    phasesBasis: goalLog ? `${goalLog.games.length} Ligaspiele mit Spielbericht` : '',
    keyStats: keyStats(goalLog),
    sources: [...new Set(b.ergebnisseGegner.provenance.sources.map(srcShort).concat(ta.primary ? [srcShort(ta.primary.source)] : []))],
    footnote: '',
  });

  // 8 So spielt der Gegner – nur Trainerbeobachtungen
  slides.push({
    key: 'soSpieltGegner',
    number: 8,
    title: SLIDE_TITLES.soSpieltGegner,
    kicker: 'Beobachtungen des Trainerteams',
    formation: answerFV(prep.answers.q1_grundordnung),
    absences: prep.answers.q8_ausfaelle?.state === 'beantwortet' && prep.answers.q8_ausfaelle.text.trim() ? answerFV(prep.answers.q8_ausfaelle) : null,
    phases: (
      [
        ['ballbesitz', 'Eigener Ballbesitz', 'Aufbau und Chancen', 'q2_aufbau'],
        ['ballverlust', 'Umschalten nach Ballverlust', 'Defensives Umschalten', 'q4b_ballverlust'],
        ['gegnerBall', 'Gegnerischer Ballbesitz', 'Verteidigen und Pressing', 'q3_verteidigung'],
        ['ballgewinn', 'Umschalten nach Ballgewinn', 'Offensives Umschalten', 'q4_umschalten'],
      ] as const
    ).map(([key, label, sub, id]) => ({ key, label, sub, value: answerFV(prep.answers[id as QuestionId]) })),
    extras: (
      [
        ['Standards', 'q5b_standards'],
        ['Stärken', 'q5_staerken'],
        ['Verwundbarkeit', 'q6_verwundbar'],
      ] as const
    ).map(([label, id]) => ({ label, value: answerFV(prep.answers[id]) })),
    sources: ['Trainerteam'],
    footnote: '',
  });

  // 9 Unsere Form
  slides.push(formSlide('unsereForm', 9, ownFormTitle, ownName, 'ergebnisseEigene', match.isHome ? 'home' : 'away'));

  // 10 Kader
  const players = prep.squad?.players ?? [];
  const roster = b.ergebnisseEigene.value?.roster;
  const order = ['Torwart', 'Abwehr', 'Mittelfeld', 'Angriff'];
  const cards = players.map((p) => {
    const r = roster?.players.find((x) => samePerson(x.name, p.name));
    const position = p.position?.trim() || r?.position || '';
    const number = p.number || r?.number || '';
    const card: SquadCard & { gk: boolean; pos: string } = {
      name: p.name,
      meta: [number ? `#${number}` : '', position].filter(Boolean).join(' · '),
      initials: initialsOf(p.name),
      ...(r?.photo ? { photo: r.photo } : {}),
      gk: Boolean(p.isGoalkeeper) || /^tor/i.test(position),
      pos: position,
    };
    return card;
  });
  const strip = ({ name, meta, initials, photo }: SquadCard): SquadCard => ({ name, meta, initials, ...(photo ? { photo } : {}) });
  const coachCards: SquadCard[] = (prep.squad?.coaches ?? []).map((x) => x.trim()).filter(Boolean).map((name) => {
    const r = roster?.coaches.find((x) => samePerson(x.name, name));
    // Nur der Name – Rollen wie „Spielertrainer“ stehen nicht auf der Folie (Trainerwunsch).
    return { name, meta: '', initials: initialsOf(name), ...(r?.photo ? { photo: r.photo } : {}) };
  });
  const o = prep.squad?.origin;
  slides.push({
    key: 'kader',
    number: 10,
    title: SLIDE_TITLES.kader,
    kicker: `${players.length + (prep.squad?.openSlots?.count ?? 0)} Spieler`,
    goalkeepers: cards.filter((c) => c.gk).map(strip),
    players: cards
      .filter((c) => !c.gk)
      .sort((x, y) => (order.indexOf(x.pos) + 1 || 99) - (order.indexOf(y.pos) + 1 || 99) || x.name.localeCompare(y.name))
      .map(strip),
    coaches: coachCards,
    placeholders: players.length
      ? { goalkeepers: 0, players: prep.squad?.openSlots?.count ?? 0, coaches: 0, playerLabel: prep.squad?.openSlots?.label || 'offen' }
      : { goalkeepers: 2, players: 16, coaches: 2, playerLabel: 'Spieler' },
    count: players.length + (prep.squad?.openSlots?.count ?? 0),
    note: prep.squad?.note ?? '',
    origin: !o ? 'Kein Kader erfasst' : o.kind === 'ersteingabe' ? 'Ersteingabe des Trainers' : o.label,
    sources: [],
    footnote: prep.squadReviewed || !players.length ? '' : 'Kader übernommen – noch nicht ausdrücklich geprüft.',
  });

  // 11 Auftrag – ausschließlich Trainerbotschaften
  const m = prep.mission;
  const ex = m.origin === 'beispiel';
  slides.push({
    key: 'auftrag',
    number: 11,
    title: SLIDE_TITLES.auftrag,
    kicker: `${ownName} gegen ${opp}`,
    messages: m.messages.map((msg, i) => ({
      headline: msg.headline.trim() ? fv(msg.headline.trim(), ex ? 'beispiel' : 'ok') : fv(`Botschaft ${i + 1} offen`, 'offen'),
      text: msg.text.trim(),
    })),
    motto: m.motto.trim() ? fv(m.motto.trim(), ex ? 'beispiel' : 'ok') : fv('Leitmotiv offen', 'offen'),
    mantras: m.mantrasWaived ? [] : m.mantras.filter((x) => x.trim()),
    mantrasWaived: m.mantrasWaived,
    sources: [],
    footnote: '',
  });

  return {
    meta: {
      teamName: ownName,
      teamShort: team.shortName,
      opponent: opp,
      matchLabel: `${homeName} – ${awayName}`,
      competition: match.competition,
      dateLabel: dateOk ? formatDate(match.date) : 'Datum offen',
      isHistoricalReference: match.isHistoricalReference,
      containsDemoData: containsDemo,
      generatedAt: new Date().toISOString(),
      templateName: team.template.name,
      crests: {
        ...(crestFor(crests, homeName) ? { home: crestFor(crests, homeName) } : {}),
        ...(crestFor(crests, awayName) ? { away: crestFor(crests, awayName) } : {}),
      },
    },
    slides: slides.filter((s) => team.template.slides.includes(s.key)),
  };
}

function recordLine(label: string, r: { played: number; won: number; drawn: number; lost: number; goalsFor: number; goalsAgainst: number }, flag: FV['flag']): RecordLine {
  const d = r.goalsFor - r.goalsAgainst;
  return { label, played: String(r.played), won: String(r.won), drawn: String(r.drawn), lost: String(r.lost), goals: `${r.goalsFor}:${r.goalsAgainst}`, diff: `${d > 0 ? '+' : ''}${d}`, flag };
}

function initialsOf(name: string): string {
  const parts = name.replace(/[^\p{L}\s-]/gu, ' ').split(/[\s-]+/).filter(Boolean);
  if (!parts.length) return '?';
  return ((parts[0][0] ?? '') + (parts.length > 1 ? parts[parts.length - 1][0] : '')).toUpperCase();
}

function mvpAsOf(players: SelectedPlayer[]): string | null {
  const iso = players.map((p) => p.mvp?.asOf).find(Boolean);
  const m = iso ? /^(\d{4})-(\d{2})-(\d{2})/.exec(iso) : null;
  return m ? `${m[3]}.${m[2]}.${m[1]}` : null;
}
