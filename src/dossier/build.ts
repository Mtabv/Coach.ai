import { FUPA_MVP_DEFINITION } from '../data/fupa/mapping';
import { analyzeTable } from '../domain/dataQuality';
import { selectKeyPlayers, type SelectedPlayer } from '../domain/players';
import { kitLabel } from '../domain/questionnaire';
import { formatRecord, normalizeName, opponentKpis, seasonSummary, teamResults, type TeamResult } from '../domain/stats';
import { computeAwaySchedule, computeHomeSchedule, formatDate, isValidDate, isValidTime } from '../domain/time';
import type { Answer, Match, Preparation, QuestionId, SourceRef, TeamProfile } from '../domain/types';
import { fv, type DossierContent, type FV, type FormSlide, type Slide } from './model';

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
  const venue = prep.organisation.venueOverride ?? match.venue ?? (match.isHome ? team.homeVenue : null);
  const venueFV: FV = venue?.name
    ? fv([venue.name, venue.address].filter(Boolean).join(', '), /Beispiel/i.test(venue.name) ? 'beispiel' : 'ok')
    : fv('Spielort offen', 'offen');
  const mdLabel = match.matchday ? `${match.matchday}. Spieltag` : match.competitionType === 'liga' ? 'Spieltag offen' : match.competitionType === 'pokal' ? 'Pokalspiel' : 'Testspiel';
  const containsDemo = Object.values(b).some((blk) => blk.provenance.sources.some((s: SourceRef) => s.kind === 'demo')) || team.isDemo || match.isDemo;

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
  const ownFormTitle = `${team.shortName} ${SLIDE_TITLES.unsereForm}`;
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
  const tableSources = ta.primary ? [srcLabel(ta.primary.source)] : [];
  let tableStatus = fv('Tabelle liegt nicht vor', 'offen');
  if (ta.primary) {
    const unresolved = ta.conflicts.filter((c) => !c.resolution).length;
    if (unresolved) tableStatus = fv(`${unresolved} ungeklärte Abweichung(en) – betroffene Werte sind markiert`, 'widersprüchlich');
    else if (ta.primaryIsStale) tableStatus = fv(`Datenstand ${ta.primary.source.asOf} – nicht aktuell`, 'veraltet');
    else tableStatus = fv(`Stand ${ta.primary.source.asOf ?? 'unbekannt'}`, ta.primary.source.kind === 'demo' ? 'beispiel' : 'ok');
  }
  const pairings = b.spieltag.value?.pairings ?? [];
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
        deduction: r.pointDeduction ? `−${r.pointDeduction}` : '',
        highlight: normalizeName(r.team) === normalizeName(ownName) ? 'own' : normalizeName(r.team) === normalizeName(opp) ? 'opp' : null,
      };
    }),
    tableStatus,
    pairings: pairings.map((p) => ({
      home: p.home,
      away: p.away,
      when: [p.date ? formatDate(p.date).slice(0, 6) : '', p.kickoff ?? ''].filter(Boolean).join(' '),
      highlight: [p.home, p.away].some((t) => normalizeName(t) === normalizeName(ownName)),
    })),
    sources: [...tableSources, ...(b.spieltag.provenance.sources.map(srcLabel))],
    footnote: ta.rows.some((r) => r.pointDeduction) ? 'Punktabzüge sind als eigene Angabe ausgewiesen.' : '',
  });

  // 4 Unser Spiel
  const sched = timeOk
    ? match.isHome
      ? computeHomeSchedule(match.kickoff!, team.schedule.home, venue?.name ?? null, prep.organisation)
      : computeAwaySchedule(match.kickoff!, team.schedule.away, prep.organisation.travelMinutes, prep.organisation)
    : null;
  const kit = prep.organisation.kit;
  const kitFV = kit && (kit.shirt || kit.shorts || kit.socks) ? fv(kitLabel(kit), /Beispiel/i.test(kitLabel(kit)) ? 'beispiel' : 'ok') : fv('Spielkleidung offen', 'offen');
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
  facts.push({ label: 'Spielkleidung', value: kitFV });
  if (prep.organisation.notes.trim()) facts.push({ label: 'Besonderheiten', value: fv(prep.organisation.notes.trim(), 'trainer') });

  const h2h = (b.direkteDuelle.value?.games ?? []).slice().sort((x, y) => (x.date < y.date ? 1 : -1));
  slides.push({
    key: 'unserSpiel',
    number: 4,
    title: SLIDE_TITLES.unserSpiel,
    kicker: match.isHome ? 'Heimspiel' : 'Auswärtsspiel',
    facts,
    h2h: h2h.map((g) => ({
      season: g.season,
      date: formatDate(g.date),
      competition: g.competitionLabel,
      match: `${g.home} – ${g.away}`,
      result: `${g.goalsHome}:${g.goalsAway}`,
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
    sources: [...(h2h.length ? b.direkteDuelle.provenance.sources.map(srcLabel) : []), 'Zeitplan: berechnet aus gespeichertem Zeitmuster'],
    footnote: 'Traineransprache = organisatorischer Zeitblock.',
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
      if (tableRow) {
        facts.push(tableRow.unresolved.length ? fv(`Tabellenplatz ${tableRow.rank} – Punktzahl ungeklärt`, 'widersprüchlich') : fv(`Tabellenplatz ${tableRow.rank} mit ${tableRow.points} Punkten${tableRow.pointDeduction ? ` (nach ${tableRow.pointDeduction} Punkten Abzug)` : ''}.`));
      }
      if (s.otherCompetitions.length) {
        const o = s.otherCompetitions[0];
        facts.push(fv(`Nicht in der Ligaform enthalten: ${o.competitionLabel} am ${formatDate(o.date)} gegen ${o.opponent} (${o.goalsFor}:${o.goalsAgainst}).`));
      }
    }
    if (key === 'gegnerForm') {
      for (const f of b.gegnerFakten.value?.facts ?? []) {
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
      last5: last5Rows(s.last5),
      last5Note: has ? (s.last5.length < 5 ? `Nur ${s.last5.length} Ligaspiele vorhanden.` : 'Nur Ligaspiele – Pokal- und Testspiele nicht berücksichtigt.') : 'Keine Ligaergebnisse vorhanden.',
      records: has
        ? [
            incomplete && tableRow
              ? { label: 'Saisonbilanz (Liga, laut Tabelle)', value: fv(`${tableRow.won}S ${tableRow.drawn}U ${tableRow.lost}N · ${tableRow.goalsFor}:${tableRow.goalsAgainst} Tore`, tableRow.unresolved.length ? 'widersprüchlich' : 'ok') }
              : { label: 'Saisonbilanz (Liga)', value: fv(formatRecord(s.all), stale ? 'veraltet' : 'ok') },
            {
              label: relevant === 'home' ? 'Heimbilanz' : 'Auswärtsbilanz',
              value: incomplete
                ? fv(`unvollständig – nur ${s.all.played} von ${tableRow!.played} Ligaspielen vorhanden`, 'offen')
                : fv(rel.played ? formatRecord(rel) : 'Noch keine Spiele', stale ? 'veraltet' : 'ok'),
            },
            { label: 'Tabellenpunkte', value: tableRow ? (tableRow.unresolved.includes('points') ? fv('ungeklärt', 'widersprüchlich') : fv(`${tableRow.points}${tableRow.pointDeduction ? ` (−${tableRow.pointDeduction} Abzug)` : ''}`)) : fv('Tabelle fehlt', 'offen') },
          ]
        : [{ label: 'Saisonbilanz (Liga)', value: fv('Keine Daten', 'offen') }],
      facts,
      sources: blk.provenance.sources.map(srcLabel).concat(key === 'gegnerForm' ? b.gegnerFakten.provenance.sources.map(srcLabel) : []),
      footnote: 'Bilanzen berechnet aus Ligaergebnissen; Tabellenpunkte laut Tabelle.',
    };
  };

  slides.push(formSlide('gegnerForm', 5, SLIDE_TITLES.gegnerForm, opp, 'ergebnisseGegner', match.isHome ? 'away' : 'home'));

  // 6 Gefahr
  const selected = selectKeyPlayers(b.gegenspieler.value?.candidates ?? [], prep.playerHints);
  const playerSources = b.gegenspieler.provenance.sources.map(srcLabel);
  slides.push({
    key: 'gegnerGefahr',
    number: 6,
    title: SLIDE_TITLES.gegnerGefahr,
    kicker: opp,
    players: selected.map((p) => ({
      name: p.name,
      meta: [p.number ? `#${p.number}` : '', p.position ?? '', p.heightCm ? `${(p.heightCm / 100).toFixed(2).replace('.', ',')} m` : '', p.isCaptain ? 'Kapitän' : ''].filter(Boolean).join(' · '),
      reasons: p.reasons.filter((r) => !/^FuPa-MVP-Wert/.test(r)),
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
    legend: [
      selected.some((p) => p.mvp) ? `MVP: ${FUPA_MVP_DEFINITION}${mvpAsOf(selected) ? ` Stand ${mvpAsOf(selected)}.` : ''}` : '',
      selected.some((p) => p.photo) ? `Fotos: ${[...new Set(selected.filter((p) => p.photo).map((p) => p.photo!.credit))].join('; ')}.` : '',
    ]
      .filter(Boolean)
      .join(' '),
    footnote: 'Trainerhinweise haben Vorrang vor statistischer Vorauswahl.',
  });

  // 7 Auffälligkeiten
  const oppResults = b.ergebnisseGegner.value?.results ?? [];
  const kpis = opponentKpis(opp, oppResults, match.date, ta.rows.length ? ta.rows : null);
  const oppSummary = seasonSummary(opp, oppResults, match.date);
  const profile: FV[] = [];
  if (oppSummary.all.played) {
    profile.push(fv(`Heim: ${formatRecord(oppSummary.home)}`));
    profile.push(fv(`Auswärts: ${formatRecord(oppSummary.away)}`));
    const firstHalf = kpis.find((k) => k.id === 'offrang');
    const def = kpis.find((k) => k.id === 'defrang');
    if (firstHalf && def) profile.push(fv(`Offensive auf Rang ${firstHalf.value.replace('.', '')}, Defensive auf Rang ${def.value.replace('.', '')} der Liga.`));
  }
  slides.push({
    key: 'gegnerAuffaelligkeiten',
    number: 7,
    title: SLIDE_TITLES.gegnerAuffaelligkeiten,
    kicker: opp,
    kpis: kpis.map((k) => ({ label: k.label, value: k.value, basis: k.basis })),
    profile: profile.length ? profile : [fv('Keine Ergebnisdaten vorhanden.', 'offen')],
    facts: (b.gegnerFakten.value?.facts ?? []).map((f) => {
      const src = sourceById(prep, f.sourceId);
      return fv(f.text, src?.kind === 'demo' ? 'beispiel' : 'ok', src ? srcLabel(src) : undefined);
    }),
    sources: b.ergebnisseGegner.provenance.sources.map(srcLabel).concat(ta.primary ? [srcLabel(ta.primary.source)] : []),
    footnote: 'Kennzahlen deterministisch aus Ergebnissen und Tabelle – keine taktischen Ableitungen.',
  });

  // 8 So spielt der Gegner – nur Trainerbeobachtungen
  const obs: [string, QuestionId][] = [
    ['Grundordnung', 'q1_grundordnung'],
    ['Aufbau und Chancen', 'q2_aufbau'],
    ['Verteidigen und Pressing', 'q3_verteidigung'],
    ['Umschalten', 'q4_umschalten'],
    ['Stärken und Standards', 'q5_staerken'],
    ['Verwundbarkeit', 'q6_verwundbar'],
    ['Ausfälle und Besonderheiten', 'q8_ausfaelle'],
  ];
  slides.push({
    key: 'soSpieltGegner',
    number: 8,
    title: SLIDE_TITLES.soSpieltGegner,
    kicker: 'Beobachtungen des Trainerteams',
    phases: obs.map(([label, id]) => ({ label, value: answerFV(prep.answers[id]) })),
    sources: ['Trainerbeobachtungen'],
    footnote: 'Subjektive Beobachtungen – getrennt von statistischen Angaben.',
  });

  // 9 Unsere Form
  slides.push(formSlide('unsereForm', 9, ownFormTitle, ownName, 'ergebnisseEigene', match.isHome ? 'home' : 'away'));

  // 10 Kader
  const players = prep.squad?.players ?? [];
  const groups = new Map<string, string[]>();
  for (const p of players) {
    const g = p.position?.trim() || 'Ohne Position';
    if (!groups.has(g)) groups.set(g, []);
    groups.get(g)!.push(`${p.number ? `${p.number} ` : ''}${p.name}`);
  }
  const order = ['Tor', 'Abwehr', 'Mittelfeld', 'Angriff'];
  const groupList = [...groups.entries()].sort((a, b) => (order.indexOf(a[0]) + 1 || 99) - (order.indexOf(b[0]) + 1 || 99)).map(([label, ps]) => ({ label, players: ps }));
  const o = prep.squad?.origin;
  slides.push({
    key: 'kader',
    number: 10,
    title: SLIDE_TITLES.kader,
    kicker: `${players.length} Spieler`,
    groups: groupList,
    count: players.length,
    note: prep.squad?.note ?? '',
    origin: !o ? 'Kein Kader erfasst' : o.kind === 'ersteingabe' ? 'Ersteingabe des Trainers' : o.label,
    sources: [],
    footnote: prep.squadReviewed ? 'Kader vom Trainer geprüft.' : 'Kader übernommen – noch nicht ausdrücklich geprüft.',
  });

  // 11 Auftrag – ausschließlich Trainerbotschaften
  const m = prep.mission;
  const ex = m.origin === 'beispiel';
  slides.push({
    key: 'auftrag',
    number: 11,
    title: SLIDE_TITLES.auftrag,
    kicker: `${team.shortName} gegen ${opp}`,
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
    },
    slides: slides.filter((s) => team.template.slides.includes(s.key)),
  };
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
