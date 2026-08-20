# VTC Hub - Release- und Deploymentstatus

Stand: 20.08.2026

## Lokal technisch abgeschlossen

- [x] Backendabhaengigkeiten vereinheitlicht und Prisma Client erzeugt
- [x] NestJS-Produktionsbuild erfolgreich
- [x] HMAC-Vertrag `JSON + Timestamp + Nonce` zwischen C# und NestJS vereinheitlicht
- [x] HMAC an den kurzlebigen Benutzer-JWT gebunden; kein globales Client-Secret im Installer
- [x] Redis-Replay-Schutz atomar mit `SET NX EX 60`
- [x] Healthcheck, CORS und statische Upload-Auslieferung
- [x] OAuth-Callback ohne JWT im Querystring; HttpOnly-Cookie aktiv
- [x] Backend-Guards akzeptieren den HttpOnly-Sessioncookie; Browser-JWTs liegen nicht mehr in Local Storage
- [x] lokaler Login mit scrypt statt globalem SHA-256-Passwort
- [x] Next.js-Produktionsbuild mit allen 17 Routen erfolgreich
- [x] Livekarte mit Socket.io, Dark Tiles, Goldmarkern, Clustern, Follow, Trails und Lastmodus
- [x] Socket-Handshakes und Firmenraeume werden ausschliesslich aus einem gueltigen JWT abgeleitet
- [x] WPF-Cockpit nach der Referenz strukturell neu aufgebaut
- [x] RenCloud SCSSdkClient 1.12.1 statt Demotelemetrie integriert
- [x] JobStarted, JobDelivered und JobCancelled angebunden
- [x] Clientlogin und DPAPI-Session
- [x] Updater mit HTTPS-Regel und SHA-256-Pruefung
- [x] ZIP-Slip-Schutz und gebuendeltes Telemetrie-Plugin
- [x] portable Windows-EXE und NSIS-Setup-EXE gebaut
- [x] Version 1.1.2, Setup-EXE, portable ZIP und SHA-256-Manifest im Tag-Workflow konsistent
- [x] Prisma-Initialmigration und Seed vorhanden
- [x] PostgreSQL-/Redis-Compose, Backup und Restore vorhanden
- [x] atomare Plesk-Releases, persistente Uploads und Rollback vorbereitet
- [x] persistente Plesk-Environment-Dateien, Pre-Deploy-Backup und Healthcheck-Retries verdrahtet
- [x] Legacy-Export kryptografisch verifiziert und transaktional importiert
- [x] 7 Benutzer, 2 Speditionen, 5 Mitgliedschaften und 9 Social-Accounts in PostgreSQL vorhanden
- [x] wiederholter Import als idempotent nachgewiesen
- [x] PostgreSQL-Backup `databases/backups/vtc-platform-20260819-095648.dump` erfolgreich erzeugt
- [x] Google-, Discord- und Steam-Flows fuer Web und Desktop verdrahtet
- [x] Desktop-OAuth mit Loopback, PKCE, State und Redis-Einmalcode abgesichert
- [x] Loginoberflaechen deaktivieren nicht konfigurierte Provider automatisch
- [x] Bestehende OAuth-Benutzer beim Legacy-Import verlustfrei zugeordnet
- [x] Desktop-Fenster fuer monitoruebergreifendes Ziehen repariert
- [x] Telemetrie-Installer fuer alle Steam-Bibliotheken und beide Spiele repariert
- [x] obere Dashboardnavigation und Speditionsreiter umgesetzt
- [x] explizite OAuth-Kontoverknuepfung und normaler Passwort-Login im Profil umgesetzt

## Nachgewiesene Buildbefehle

- Backend: `node node_modules/@nestjs/cli/bin/nest.js build`
- Frontend: `pnpm run build`
- Desktop: `dotnet publish` ueber `Installer/build-installer.ps1`

Backend, Frontend und Desktop wurden am 20.08.2026 mit dem 1.1.2-Quellstand erneut erfolgreich gebaut. Der Tag-Workflow erzeugt den aktuellen Setup-Build reproduzierbar.

## Externe Freigaben vor Produktion

Diese Punkte sind keine fehlenden Codemodule, sondern brauchen Betreiberkonten oder reale Infrastruktur:

- [x] DNS, TLS-Zertifikate und Plesk-Zielpfade gesetzt
- [x] starke Staging-Secrets eingetragen
- [x] Google- und Discord-Anwendungen registriert und Callback-URLs freigegeben
- [x] PostgreSQL und Redis gestartet, Migrationen angewendet und Import-Backup erzeugt
- [x] Version 1.1.2 committen, pushen und als Tag/Release veroeffentlichen
- [ ] das vom Tag-Workflow erzeugte Update-Manifest ueber die echte HTTPS-Releaseadresse pruefen
- [ ] SCS-Spielweltkoordinaten mit einem kalibrierten Kartendienst nach WGS84 projizieren, bevor sie als echte Leaflet-GPS-Positionen genutzt werden
- [ ] End-to-End-Abnahme mit laufendem ETS2/ATS, produktiver API und mehreren Livefahrern durchfuehren

## Ehrliche Einsatzgrenze

Der Quellcode und die Staging-Laufzeit sind startklar. Google und Discord sind konfiguriert; Steam kann erst nach Bereitstellung eines echten Steam-API-Schluessels aktiviert werden.

Plesk, PostgreSQL und Redis wurden fuer Staging eingerichtet. Eine spaetere Produktionsfreigabe benoetigt weiterhin Code-Signing, Steam-Schluessel und die Abnahme mit laufendem ETS2/ATS.

Gruene lokale Builds bedeuten nicht automatisch, dass externe Plesk-, OAuth- oder Steamkonten bereits konfiguriert sind.
