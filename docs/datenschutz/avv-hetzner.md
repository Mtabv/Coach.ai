# Vertrag zur Auftragsverarbeitung mit Hetzner: Vorbereitung

Stand 11.11.2026. Diese Unterlage ist eine Arbeitshilfe, keine Rechtsberatung.

## Worum es geht

Wenn Coach.AI auf einem Hetzner-Server personenbezogene Daten verarbeitet (Spielernamen, Fotos, Einsätze, Noten, Gesprächsnotizen, Abwesenheitsgründe), ist Hetzner Auftragsverarbeiter nach Art. 28 DSGVO. Dafür braucht es einen Vertrag zur Auftragsverarbeitung (AV-Vertrag).

Bei Hetzner wird er **nicht automatisch** geschlossen. Man schließt ihn **selbst im Kundenkonto** unter accounts.hetzner.com/account/dpa ab. Hetzner verhandelt keine individuellen Verträge, eine Unterschrift ist nicht nötig. Wer einen AV-Vertrag hat, bekommt dort auch den jährlichen Prüfbericht zu den technischen und organisatorischen Maßnahmen (TOM).

## Vorher klären: Wer ist verantwortlich?

- **Variante A, Trainer persönlich:** Manuel Viehmann betreibt Coach.AI für seine Mannschaft. Er ist Verantwortlicher und schließt den AV-Vertrag in seinem Hetzner-Konto.
- **Variante B, Verein:** Die TSG Wilhelmshöhe ist Verantwortliche. Dann schließt der Verein den Vertrag (Vereinskonto bei Hetzner) oder bevollmächtigt dich. Der Datenschutzbeauftragte des Vereins, falls vorhanden, sollte Bescheid wissen.

**Entschieden am 11.11.2026: Variante A.** Manuel Viehmann ist Verantwortlicher.

Für Version 1 (nur Trainerteam) ist Variante A schnell umsetzbar. Spätestens mit Version 2 (Spieler bekommen Zugang) empfehle ich, das mit dem Vorstand abzustimmen.

## Angaben für Anlage 1 (im Hetzner-Formular auszuwählen oder zu ergänzen)

**Arten der Daten**
- Stammdaten: Name, Rückennummer, Position, Foto
- Einsatzdaten: Nominierungen, Einsätze, Spielminuten, Tore, Vorlagen
- Leistungsbewertungen: Noten mit Begründung, Bewertungen von Spielphasen
- Abwesenheiten mit Grund (zum Beispiel Urlaub, Arbeit, Verletzung). Gesundheitsangaben möglichst nur als „verletzt“ oder „krank“, ohne Diagnose.
- Gesprächsnotizen und Vereinbarungen aus Spielergesprächen
- Zugangsdaten der Trainer (E-Mail, Passwort-Hash)

**Betroffene Personen**
- Spieler der 1. Herren der TSG Wilhelmshöhe
- Trainerteam

**Zweck:** Planung und Durchführung von Training und Spielbetrieb, Spielvorbereitung und -nachbereitung, Kaderverwaltung.

## Begleitende Unterlagen (Variante A, folgen als Nächstes)

1. **Eintrag im Verzeichnis der Verarbeitungstätigkeiten:** Zweck, Daten, Empfänger (Hetzner), Löschfristen.
2. **Löschkonzept**, zum Beispiel:
   - Gesprächsnotizen und Noten zwei Jahre nach Ende der Saison löschen.
   - Spieler, die den Verein verlassen, nach einem Jahr anonymisieren.
3. **Infoblatt für die Mannschaft**, spätestens vor Version 2: Was gespeichert wird, wer es sieht, dass Noten nur auf Freigabe sichtbar sind.

## Technische Maßnahmen in Coach.AI

- Eigener Server, getrennt vom bestehenden Server mit dem digitalen Assistenten.
- Zugriff nur per SSH-Schlüssel. Firewall nur für die Ports 22, 80 und 443.
- HTTPS, Passwörter nur als Hash gespeichert.
- Hetzner-Backups und eine tägliche Datenbanksicherung.
- Gesprächsnotizen nur für das Trainerteam sichtbar.
- Keine Gesprächsnotizen an KI-Dienste.

## Schritte für dich

1. ~~Variante A oder B festlegen.~~ Erledigt: Variante A.
2. Bei Hetzner einloggen und accounts.hetzner.com/account/dpa öffnen.
3. Die Angaben oben in Anlage 1 übernehmen und den Vertrag abschließen.
4. Das PDF des Vertrags ablegen, etwa in der Vereinsablage, nicht im Repository.

Quellen: [Datenschutz bei Hetzner, FAQ](https://docs.hetzner.com/de/general/general-terms-and-conditions/data-privacy-faq/), [Datenschutz bei Hetzner](https://docs.hetzner.com/de/general/company-and-policy/data-protection-at-hetzner/), [Technische und organisatorische Maßnahmen](https://docs.hetzner.com/de/general/security-and-identify/technical-and-organizational-measures/)
