# VTC Hub - Release- und Deploymentstatus

Stand: 19.08.2026

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
- [x] Version 1.1.1, Setup-EXE, portable ZIP und SHA-256-Manifest im Tag-Workflow konsistent
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

## Nachgewiesene Buildbefehle

- Backend: `node node_modules/@nestjs/cli/bin/nest.js build`
- Frontend: `pnpm run build`
- Desktop: `dotnet publish` ueber `Installer/build-installer.ps1`

Alle drei Builds wurden am 19.08.2026 mit dem korrigierten 1.1.1-Quellstand erneut erfolgreich ausgefuehrt. Der aktuelle Setup-Build liegt unter `desktop/VtcDesktopClient/Installer/output/installer/VtcDesktopClient-Setup.exe`.

## Externe Freigaben vor Produktion

Diese Punkte sind keine fehlenden Codemodule, sondern brauchen Betreiberkonten oder reale Infrastruktur:

- [ ] DNS, TLS-Zertifikate und Plesk-Zielpfade setzen
- [ ] starke Produktions-Secrets eintragen
- [ ] Google-, Discord- und Steam-Anwendungen registrieren und Callback-URLs freigeben
- [ ] Produktionsdatenbank starten, Migration anwenden und Restoreprobe dokumentieren
- [ ] Version 1.1.1 committen, pushen und als Tag/Release veroeffentlichen
- [ ] das vom Tag-Workflow erzeugte Update-Manifest ueber die echte HTTPS-Releaseadresse pruefen
- [ ] SCS-Spielweltkoordinaten mit einem kalibrierten Kartendienst nach WGS84 projizieren, bevor sie als echte Leaflet-GPS-Positionen genutzt werden
- [ ] End-to-End-Abnahme mit laufendem ETS2/ATS, produktiver API und mehreren Livefahrern durchfuehren

## Ehrliche Einsatzgrenze

Der Quellcode und die lokale Laufzeitumgebung sind startklar. Google-, Discord- und Steam-Login koennen jedoch erst gegen die echten Anbieter getestet werden, nachdem der Betreiber dort Anwendungen registriert und die realen IDs/Secrets eingetragen hat. Der alte Website-Ordner enthielt Benutzeridentitaeten, aber keine verwendbaren Provider-Secrets.

Plesk wurde in diesem Abschlusslauf nicht veraendert. Ein produktives Deployment setzt ausdrueckliche Serverfreigabe, Zielpfade, SSH-Zugang, DNS/TLS und eine abschliessende Restore- sowie End-to-End-Abnahme voraus.

Gruene lokale Builds bedeuten nicht automatisch, dass externe Plesk-, OAuth- oder Steamkonten bereits konfiguriert sind.
