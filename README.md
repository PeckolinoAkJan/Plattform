# VTC Hub

VTC Hub ist eine Plattform fuer ETS2/ATS-Speditionen mit NestJS-API, Next.js-Dashboard, PostgreSQL/Redis und einem selbststaendigen .NET-8-WPF-Telemetrieclient.

## Gepruefter Stand

- Backend: Produktionsbuild erfolgreich; Healthcheck, CORS, Upload-Auslieferung, JWT/OAuth, JWT-gebundenes HMAC-SHA256 und atomarer Redis-Replay-Schutz vorhanden.
- Frontend: Produktionsbuild erfolgreich; Landingpage, Login, Dashboard, Profil, Spedition, Fahrtenbuch und Socket.io/Leaflet-Livekarte vorhanden.
- Desktop: Produktionsbuild erfolgreich; echtes SCS-SDK-Binding, Login, DPAPI-Session, sicherer HMAC-Client, Updater-Pruefsumme und sicherer Plugin-Installer vorhanden.
- Daten: Prisma-Schema, initiale Produktionsmigration, Seed, PostgreSQL/Redis-Compose, Backup und Restore vorhanden.
- Installer: portable Ausgabe und NSIS-Setup-EXE fuer Version 1.1.2 werden im Tag-Workflow zusammen mit dem SHA-256-Update-Manifest gebaut.
- Bestandsdaten: Der verifizierte Legacy-Export wurde importiert (7 Benutzer, 2 Speditionen, 5 Mitgliedschaften und 9 Social-Accounts). Der Import ist per Audit-ID idempotent.
- Lokaler Betrieb: PostgreSQL und Redis laufen in Docker; Backend und Frontend wurden mit der aktuellen Konfiguration erfolgreich gebaut.

## Projektstruktur

- `backend/`: NestJS API auf Port 3001
- `frontend/`: Next.js App auf Port 3000
- `desktop/VtcDesktopClient/`: Windows-Client
- `databases/`: PostgreSQL, Redis, Backups und Restore
- `scripts/plesk/`: atomare Releases und Rollback
- `.github/workflows/`: CI, Plesk-Deploy und Desktop-Release

## Schnellstart

```powershell
Copy-Item databases\.env.example databases\.env
Copy-Item backend\.env.example backend\.env
Copy-Item frontend\.env.example frontend\.env.local

docker compose -f databases\docker-compose.yml --env-file databases\.env up -d

Set-Location backend
pnpm install --frozen-lockfile
pnpm run prisma:generate
pnpm run prisma:migrate:deploy
pnpm run prisma:seed
pnpm run start:dev
```

In einem zweiten Terminal:

```powershell
Set-Location frontend
pnpm install --frozen-lockfile
pnpm run dev
```

- Webseite: `http://localhost:3000`
- API: `http://localhost:3001/api`
- Healthcheck: `http://localhost:3001/api/health`

## Desktop-Ausgaben

- Setup: `desktop/VtcDesktopClient/Installer/output/installer/VtcDesktopClient-Setup.exe`
- Portable: `desktop/VtcDesktopClient/Installer/output/install_portable/VtcDesktopClient.exe`
- Rendervergleich: `desktop/VtcDesktopClient/Installer/output/client-render-final.png`

Die produktiven Werte fuer Backend-URL und Update-Manifest werden in `clientsettings.json` gesetzt. Die Datei enthaelt keine Secrets. Das Telemetrie-Plugin wird ueber den Button im Client in ETS2/ATS installiert.

## Importierte Bestandsdaten

Der Importer `backend/prisma/import-legacy.mjs` prueft vor dem Schreiben Pfade, SHA-256-Pruefsummen und Zeilenanzahlen des Export-Manifests. Er importiert Benutzer, Speditionen, Mitgliedschaften, vorhandene Passwort-Hashes und verknuepfte Google-, Discord- und Steam-Identitaeten in einer Transaktion.

```powershell
Set-Location backend
pnpm run prisma:import-legacy -- "C:\Users\jrike\Documents\Neues Projekt\Neu Website\migration\export-2026-08-14"
```

Ein erneuter Lauf veraendert den Datenbestand nicht. Das aktuelle PostgreSQL-Backup liegt unter `databases/backups/vtc-platform-20260819-095648.dump`.

## Social Login

Google, Discord und Steam sind in Web und Desktop technisch implementiert. Die Loginseite fragt `/api/auth/providers` ab und aktiviert nur vollstaendig konfigurierte Anbieter. Der Desktop-Client verwendet Browserlogin, Loopback-Callback, PKCE, signierten State und einen einmalig einloesbaren Redis-Code; JWTs werden nicht in Callback-URLs geschrieben.

Die realen Provider-Anwendungen muessen vor Produktion mit den Callback-URLs aus `INSTALLATION.md` registriert werden. Ohne echte Betreiber-IDs und Secrets bleiben die Schaltflaechen absichtlich deaktiviert.

## Vor einem echten Go-live

Repository-Code kann keine externen Geheimnisse oder Konten erzeugen. Vor Produktion muessen reale DNS-/TLS-/Plesk-Daten, starke PostgreSQL-/Redis-/JWT-Secrets sowie Google-, Discord- und Steam-Providerdaten eingetragen werden. Fuer eine geografisch exakte Leaflet-Position muss ausserdem ein kalibrierter SCS-Weltkoordinaten-zu-WGS84-Konverter bereitgestellt werden; die SCS-Telemetrie selbst liefert Spielweltkoordinaten.

Ausfuehrliche Schritte: `INSTALLATION.md`, `PLESK-DEPLOY.md` und `DEPLOYMENT_COMPLETE.md`.
