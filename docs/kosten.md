# Kosten 11Plan

Stand 11.11.2026. Laufende Kosten für den Betrieb. Feste Beträge stehen nur dort, wo sie bekannt sind. Alles andere ist als offen markiert und wird nachgetragen, sobald es feststeht.

## Version 1 (Trainerteam)

| Posten | Monatlich | Jährlich | Stand |
|---|---|---|---|
| Server Hetzner Cloud CPX22 (2 vCPU, 4 GB RAM) | 24,00 € | 288,00 € | fest, Angabe von Manuel |
| Hetzner-Backups (20 % des Serverpreises) | 4,80 € | 57,60 € | gerechnet aus dem Serverpreis |
| Domain 11plan.de (INWX) | 0,50 € | 5,97 € | fest, Angabe von Manuel |
| **Summe** | **29,30 €** | **351,57 €** | Server, Backups, Domain |

Offen und beim Bestellen zu prüfen:
- Ob die 24 € mit oder ohne Mehrwertsteuer angezeigt werden. Mit 19 % Mehrwertsteuer wären es 28,56 € nur für den Server.
- Ob die öffentliche IPv4-Adresse im Preis enthalten ist oder extra berechnet wird.

## KI-Verteilung (optional, Anthropic)

Abrechnung über ein eigenes API-Konto (platform.claude.com), getrennt vom Claude-Abo, mit Guthaben und Monatslimit. Modell Claude Sonnet 5.5, Preise laut Anthropic am 15.11.2026: 2 $ je Million Eingabe-Tokens, 10 $ je Million Ausgabe-Tokens.

| Posten | Schätzung | Stand |
|---|---|---|
| Eine Sprachnachricht auf etwa 6–11 Felder verteilt (~2.000 Tokens rein, ~600 raus) | ≈ 1 Cent | gerechnet |
| 100 Sprachnachrichten im Monat | ≈ 1 € | gerechnet |
| Monatslimit in der Konsole | 5 $ | Empfehlung |

## Ohne zusätzliche Kosten

| Posten | Warum kostenlos |
|---|---|
| HTTPS-Zertifikat | Let's Encrypt, holt der Server selbst |
| Daten von fussball.de und FuPa | öffentliche Seiten, Abruf über den eigenen Datendienst |
| Fahrzeiten | OpenStreetMap (Nominatim und OSRM), Ergebnis wird gespeichert |
| Schriften | liegen auf dem eigenen Server |
| Diktieren | Whisper läuft auf dem eigenen Server, kein externer Dienst |
| GitHub und automatisches Aufspielen | ein Update braucht wenige Minuten GitHub Actions, im kostenlosen Kontingent |

## Später, ab Version 2

| Posten | Stand |
|---|---|
| KI-Texte über die Claude API | offen, wird nach Verbrauch abgerechnet; Schätzung kommt mit der Planung von Version 2 |
| E-Mail-Versand oder Push an Spieler | offen |
| Größerer Server, falls nötig | offen; Hochstufen geht jederzeit in der Cloud Console |
