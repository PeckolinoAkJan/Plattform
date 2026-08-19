# VTC Hub 1.1.1

Version 1.1.1 ist ein Sicherheits- und Deployment-Patch fuer den bestehenden 1.1.0-Stand.

## Behoben

- HttpOnly-Websessions funktionieren jetzt durchgaengig mit geschuetzten Backend-Endpunkten; Browser-Tokens werden nicht mehr in Local Storage gespeichert oder aus Callback-URLs uebernommen.
- WebSocket-Verbindungen, Firmenraeume und Telemetrie-Absender werden aus einem gueltigen JWT abgeleitet.
- Speditions-, Livekarten- und Dispatch-Berechtigungen wurden verschaerft; parallele Auftragsannahmen sind atomar abgesichert.
- Der oeffentliche Desktop-Installer enthaelt kein globales HMAC-Secret mehr. Signierte Anfragen verwenden den DPAPI-geschuetzten Benutzer-JWT, Timestamp und eine einmalige Redis-Nonce.
- Der Updater startet nach HTTPS- und SHA-256-Pruefung den Setup-Installer, statt die laufende EXE mit einem Installer zu ueberschreiben.
- Plesk-Defaultports, SCP-Zielpfade, persistente Environment-Dateien, Pre-Deploy-Backups und Healthcheck-Retries wurden korrigiert.
- Setup-, portable Client- und Assemblyversion sind konsistent aus dem Git-Tag abgeleitet.
- Next.js wurde von 14.2.35 auf die gepatchte Version 15.5.21 aktualisiert; Sharp und PostCSS sind auf sichere Versionen fixiert. Backend- und Frontend-Produktionsaudits melden keine bekannten Schwachstellen.

## Release-Artefakte

Der Tag-Workflow veroeffentlicht:

- `VtcDesktopClient-Setup.exe`
- `VtcDesktopClient-v1.1.1-win-x64.zip`
- `latest.json` mit Version, HTTPS-Downloadadresse und SHA-256-Pruefsumme

## Bekannte externe Voraussetzung

Die SCS-Telemetrie liefert Spielweltkoordinaten. Fuer geografisch korrekte Leaflet-Positionen wird weiterhin eine kalibrierte ETS2-/ATS-nach-WGS84-Projektion benoetigt. Rohe Spielkoordinaten werden nicht als scheinbar echte GPS-Positionen veroeffentlicht.

Der lokal erzeugte Installer ist nicht Authenticode-signiert, weil kein Publisher-Zertifikat bereitgestellt wurde. Vor einer oeffentlichen Produktionsverteilung sollte er signiert oder der bewusst unsignierte Status freigegeben werden.
