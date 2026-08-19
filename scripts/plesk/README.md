# Plesk-Deploy-Skripte

Die Skripte entpacken ein Release in einen neuen Ordner, verknuepfen persistente Konfiguration und Uploads, bauen die Anwendung, schalten den `current`-Symlink atomar um und pruefen den lokalen Healthcheck.

## Voraussetzungen

- Node.js 22 mit Corepack und pnpm 11
- PM2
- fuer das Backend PostgreSQL-Clientwerkzeuge inklusive `pg_dump`
- Backend-Konfiguration unter `<PLESK_BACKEND_DIR>/shared/.env`
- Frontend-Konfiguration unter `<PLESK_FRONTEND_DIR>/shared/.env.production`

Die beiden Environment-Dateien werden nicht in Releases kopiert und sollten dem App-Benutzer gehoeren sowie mit Modus `600` geschuetzt sein.

## Aufruf auf dem Server

```bash
export PLESK_BACKEND_DIR=/var/www/vhosts/DEINE-DOMAIN.de/api-vtchub
export PLESK_BACKEND_PORT=3001
bash scripts/plesk/deploy-backend.sh /tmp/backend-<sha>.tgz

export PLESK_FRONTEND_DIR=/var/www/vhosts/DEINE-DOMAIN.de/web-vtchub
export PLESK_FRONTEND_PORT=3000
bash scripts/plesk/deploy-frontend.sh /tmp/frontend-<sha>.tgz
```

Das Backend erstellt vor Prisma-Migrationen ein Custom-Format-Backup in `shared/backups`. Es werden zehn Backups und fuenf Releases aufbewahrt.
