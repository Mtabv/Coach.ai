# 11Plan aktualisieren (von zu Hause)

Im Gäste- oder Vereins-WLAN ist der Zugang zum Server (Port 22) oft gesperrt. Dann zu Hause oder über den Handy-Hotspot.

## 1. Datei bereitlegen

`11plan-tsg.html` (die neueste Teamzentrale aus dem Chat) im Ordner **Downloads** speichern, die alte ersetzen.

## 2. Auf dem Mac

```
scp ~/Downloads/11plan-tsg.html root@116.203.28.104:/root/
ssh root@116.203.28.104
```

## 3. Auf dem Server (ein Befehl)

```
cd /opt/coachai && git pull && cd deploy && docker compose up -d --build && docker compose cp /root/11plan-tsg.html app:/daten/teamzentrale.html && git log --oneline -1 && docker compose ps --format "{{.Service}} {{.Status}}"
```

Dauert 3 bis 5 Minuten. Danach:

- erste Zeile beginnt mit der neuesten Version (siehe GitHub, Zweig `main`),
- vier Zeilen mit „Up“: `app`, `caddy`, `datendienst`, `teamzentrale`.

## 4. Steht „System restart required“ beim Anmelden

```
reboot
```

Nach etwa einer Minute ist alles wieder da (Container starten von selbst).

## 5. Im Browser

11plan.de neu laden (Safari: Cmd + Shift + R). Auf dem iPhone die App vom Home-Bildschirm einmal ganz schließen.

Woran man sieht, dass alles drauf ist:

- Kader: Name antippen öffnet das Spielerprofil.
- Training: unten Gastspieler.
- Spielvorbereitung 6, 7, 8: je ein Knopf „Sprachaufnahme“.
- „Dossier als PDF“ öffnet das Dossier im dunklen Design.
- Unten in der Seitenleiste: „Daten von fussball.de und FuPa: heute …“.

Danach baut der Server die Teamzentrale alle 6 Stunden selbst neu; die Datei aus Schritt 1 braucht es dann nicht mehr.
