# Auftragsverarbeitung mit Anthropic (KI-Verteilung): Vorbereitung

Stand 15.11.2026. Diese Unterlage ist eine Arbeitshilfe, keine Rechtsberatung. Verantwortlicher: Variante A (Trainer persönlich), wie bei Hetzner.

## Wofür Anthropic genutzt wird

Nur für die **KI-Verteilung**: Ein diktierter oder getippter Text wird auf die Felder einer Maske verteilt, zuerst bei „Übung erfassen“. Der 11Plan-Server schickt dafür an die Anthropic-API (Modell Claude Sonnet 5.5):

- den **erkannten Text** (nicht die Tonaufnahme – die wandelt Whisper auf dem eigenen Server um und verwirft sie),
- die Feldnamen und Auswahllisten der Maske (z. B. Arten, Spielprinzipien),
- die Spielernamen des Kaders als Schreibhilfe.

Die Antwort (vorausgefüllte Felder) wird nicht automatisch gespeichert; der Trainer prüft und speichert selbst. Der Schlüssel steht nur in `deploy/.env` auf dem Server.

## Vertrag

- Der **Data Processing Addendum (DPA)** von Anthropic ist laut Anthropic Bestandteil der kommerziellen Bedingungen („incorporated into and forms part of the Anthropic Commercial Terms of Service“) – keine gesonderte Unterschrift nötig. Er enthält die **EU-Standardvertragsklauseln** (Modul 2 und 3) für die Übermittlung in die USA.
  Quelle: https://www.anthropic.com/legal/data-processing-addendum
- Die kommerziellen Bedingungen schließen das **Training mit Kundendaten** aus: „Anthropic may not train models on Customer Content from Services.“
  Quelle: https://www.anthropic.com/legal/commercial-terms
- Beim Anlegen des API-Kontos (platform.claude.com) diesen Bedingungen zustimmen; die beiden Seiten als PDF ablegen.

## Datensparsamkeit (so umgesetzt)

- Keine Tonaufnahmen an Dritte, nur Text.
- Keine Speicherung der KI-Anfragen auf dem 11Plan-Server, keine Protokolle mit Inhalten.
- Zuerst nur für Übungen (enthalten in der Regel keine personenbezogenen Daten außer Namen als Schreibhilfe). Vor einer Nutzung in Nachbereitung oder Spielergesprächen erneut prüfen: dort stehen Leistungsurteile und eventuell Gesundheitsangaben (Art. 9 DSGVO) – diese möglichst nicht diktieren.
- Ohne Schlüssel in der `.env` ist die Funktion aus.

## Für das Verzeichnis der Verarbeitungstätigkeiten

- Empfänger: Anthropic PBC (USA), Auftragsverarbeiter, Grundlage DPA mit Standardvertragsklauseln.
- Zweck: Sortieren diktierter Trainertexte in Eingabefelder.
- Daten: Trainertexte, Spielernamen (Kader).
