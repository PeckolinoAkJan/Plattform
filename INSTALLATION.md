# Installation und Betrieb

## Voraussetzungen

- Node.js 22 LTS mit Corepack
- pnpm 11
- Docker Desktop oder PostgreSQL 16 plus Redis 7
- .NET SDK 8 fuer Cliententwicklung; auf Ziel-PCs ist keine Runtime noetig
- Windows 10/11 x64 fuer den Desktop-Client

## 1. Datenbank und Redis

```powershell
Copy-Item databases\.env.example databases\.env
# Passwoerter fuer nichtlokalen Betrieb zwingend aendern.
docker compose -f databases\docker-compose.yml --env-file databases\.env up -d
```

Produktiv wird die Overlay-Datei zusaetzlich verwendet:

```bash
docker compose -f databases/docker-compose.yml -f databases/docker-compose.production.yml --env-file databases/.env.production up -d
```

## 2. Backend

```powershell
Copy-Item backend\.env.example backend\.env
Set-Location backend
corepack enable
pnpm install --frozen-lockfile
pnpm run prisma:generate
pnpm run prisma:migrate:deploy
pnpm run prisma:seed
pnpm run build
pnpm run start:prod
```

Backend-Port: `3001`. Healthcheck: `/api/health`.

Erforderliche Produktionswerte:

- `DATABASE_URL`, `REDIS_PASSWORD`
- `JWT_SECRET` mit mindestens 64 zufaelligen Zeichen
- `FRONTEND_URL`, `BACKEND_URL`, `OAUTH_COOKIE_DOMAIN`
- Google-/Discord-/Steam-Zugangsdaten, falls Provider aktiviert werden

Der produktive lokale Login verwendet ausschliesslich den Passwort-Hash des jeweiligen importierten Benutzers. `LOCAL_LOGIN_PASSWORD` und `LOCAL_LOGIN_PASSWORD_HASH` sind nur Entwicklungshilfen und werden bei `NODE_ENV=production` ignoriert. Signierte Desktop-Anfragen verwenden den aktuellen Benutzer-JWT als HMAC-Schluessel sowie Timestamp und Nonce; ein globales Secret wird nicht in den oeffentlichen Installer eingebettet.

### Google, Discord und Steam registrieren

Fuer die vorgesehene Staging-Domain gelten diese Callback-Adressen:

- Google Redirect URI: `https://staging.vtc-truck-hub.de/api/auth/google/callback`
- Discord Redirect URI: `https://staging.vtc-truck-hub.de/api/auth/discord/callback`
- Steam Return URL: `https://staging.vtc-truck-hub.de/api/auth/steam/callback`
- Steam Realm: `https://staging.vtc-truck-hub.de`

Bei einer anderen Domain muessen `BACKEND_URL`, `FRONTEND_URL`, `OAUTH_COOKIE_DOMAIN` und alle Provider-Callbacks gemeinsam angepasst werden. Google und Discord benoetigen Client-ID und Client-Secret; Steam benoetigt einen API-Key. Der Status ist ohne Secret-Ausgabe ueber `GET /api/auth/providers` pruefbar.

Web-Callbacks verwenden ein signiertes HttpOnly-Flow-Cookie mit CSRF-State. Der Desktop-Client verwendet zusaetzlich PKCE und tauscht einen kurzlebigen, einmalig verwendbaren Redis-Code an `/api/auth/desktop/exchange` gegen das JWT. Provider-Secrets gehoeren ausschliesslich ins Backend.

### Legacy-Benutzer und Speditionen importieren

Nach den Migrationen kann der verifizierte Export einmalig oder wiederholt importiert werden:

```powershell
Set-Location backend
pnpm run prisma:import-legacy -- "C:\Users\jrike\Documents\Neues Projekt\Neu Website\migration\export-2026-08-14"
```

Der Importer validiert das Manifest und arbeitet transaktional sowie idempotent. Nachgewiesener lokaler Stand: 7 Benutzer, 2 Speditionen, 5 Mitgliedschaften und 9 Social-Accounts.

## 3. Frontend

```powershell
Copy-Item frontend\.env.example frontend\.env.local
Set-Location frontend
pnpm install --frozen-lockfile
pnpm run build
pnpm run start
```

Frontend-Port: `3000`. `NEXT_PUBLIC_API_URL` und `NEXT_PUBLIC_SOCKET_URL` zeigen produktiv auf die HTTPS-Backendadresse.

## 4. Desktop-Client

Setup starten:

`desktop/VtcDesktopClient/Installer/output/installer/VtcDesktopClient-Setup.exe`

Der Installer legt Startmenue- und Desktopverknuepfung sowie einen Uninstaller an. Im Client:

1. `LOG IN` waehlen und mit dem Backendkonto anmelden.
2. `INSTALL TELEMETRY PLUGIN` waehlen.
3. ETS2/ATS neu starten.
4. Spiel- und Serverstatus im Kopf pruefen.

Die Session wird mit Windows DPAPI verschluesselt. `clientsettings.json` enthaelt nur API- und Update-URLs, keine Secrets.

## 5. Installer neu bauen

```powershell
Set-Location desktop\VtcDesktopClient
.\Installer\build-installer.ps1 `
  -ApiBaseUrl "https://staging.vtc-truck-hub.de" `
  -UpdateManifestUrl "https://github.com/PeckolinoAkJan/Plattform/releases/latest/download/latest.json" `
  -Version "1.1.4" `
  -BuildInnoInstaller
```

Das Skript verwendet Inno Setup, falls vorhanden, andernfalls NSIS. Der Tag-Workflow baut automatisch portable ZIP, Setup-EXE und `latest.json` mit der SHA-256-Pruefsumme derselben Setup-Datei.

## 6. Backup und Restore

```powershell
.\databases\backup.ps1
.\databases\restore.ps1 -BackupFile .\databases\backups\<datei>.dump
```

Restore zuerst in Staging testen. Danach `pnpm run prisma:migrate:deploy` und den Healthcheck ausfuehren.

Aktuell nachgewiesenes lokales Backup:

`databases/backups/vtc-platform-20260819-095648.dump`

## 7. Produktionsabnahme

Vor Freigabe muessen diese externen Schritte erfolgreich sein:

- DNS und TLS fuer Web-, API-, WebSocket- und Downloadadressen
- PostgreSQL-/Redis-Restoreprobe auf Staging
- Provider-Login je einmal in Web und Desktop
- lokaler Login, Logout, Sessionablauf und erneute Anmeldung
- Update-Manifest inklusive SHA-256 und HTTPS-Download
- Plugininstallation und Neustart von ETS2 sowie ATS
- echte Fahrt mit JobStarted, JobCancelled und JobDelivered
- Livekarte mit mindestens zwei Fahrern und Socket-Reconnect
- kalibrierte SCS-Spielweltkoordinaten fuer die geografische Kartenprojektion
