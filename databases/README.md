# Datenbanken

VTC Hub benoetigt PostgreSQL 16 als Hauptdatenbank und Redis 7 fuer Livezustand, Cache und atomaren Replay-Schutz. Eine optionale PostgreSQL-Testdatenbank wird beim lokalen Erststart erzeugt.

## Dateien

- `docker-compose.yml`: lokale PostgreSQL-/Redis-Dienste
- `docker-compose.production.yml`: Produktionsoverlay mit Redis-AOF, Passwort und persistenten Volumes
- `.env.example`: lokale Vorlage
- `.env.production.example`: Produktionsvorlage ohne echte Secrets
- `../backend/prisma/schema.prisma`: Datenmodell
- `../backend/prisma/migrations/20260819090000_initial/migration.sql`: versionierte Initialmigration
- `../backend/prisma/seed.ts`: idempotente Startdaten
- `backup.ps1`, `restore.ps1`: Betriebswerkzeuge

## Lokal starten

```powershell
Copy-Item databases\.env.example databases\.env
docker compose -f databases\docker-compose.yml --env-file databases\.env up -d
Set-Location backend
pnpm run prisma:generate
pnpm run prisma:migrate:deploy
pnpm run prisma:seed
```

## Produktion

```bash
cp databases/.env.production.example databases/.env.production
# Beide Passwoerter ersetzen.
docker compose -f databases/docker-compose.yml -f databases/docker-compose.production.yml --env-file databases/.env.production up -d
```

PostgreSQL und Redis duerfen nicht offen aus dem Internet erreichbar sein. Backups werden verschluesselt ausserhalb des Servers aufbewahrt und Restoretests regelmaessig in Staging ausgefuehrt.
