# Plesk-Deployment

## Zielarchitektur

- Frontend: Port 3000, Reverse Proxy fuer `/`
- Backend: Port 3001, Reverse Proxy fuer `/api`, `/socket.io` und `/uploads`
- PostgreSQL 16 und Redis 7 nicht oeffentlich exponieren
- HTTPS fuer Frontend, Backend und WebSocket erzwingen

## GitHub-Secrets

- `PLESK_HOST`, `PLESK_SSH_PORT`, `PLESK_USER`, `PLESK_SSH_KEY`
- `PLESK_BACKEND_DIR`, `PLESK_FRONTEND_DIR`
- optional `PLESK_BACKEND_SERVICE_NAME`, `PLESK_FRONTEND_SERVICE_NAME`
- optional `PLESK_BACKEND_PORT=3001`, `PLESK_FRONTEND_PORT=3000`

Laufzeit-Secrets wie `DATABASE_URL`, `JWT_SECRET`, `CLIENT_SECRET`, Redis- und OAuth-Secrets werden im geschuetzten Plesk-Environment gepflegt und nicht in GitHub-Artefakte geschrieben.

Fuer Social Login muessen dort ausserdem `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET`, `DISCORD_CLIENT_ID`, `DISCORD_CLIENT_SECRET`, `STEAM_API_KEY`, `BACKEND_URL`, `FRONTEND_URL` und `OAUTH_COOKIE_DOMAIN` gesetzt sein. Die Provider-Konsole muss dieselben HTTPS-Callback-URLs enthalten, die in `INSTALLATION.md` dokumentiert sind.

## Deploymentverhalten

Die GitHub-Workflows und `scripts/plesk/deploy-*.sh` verwenden pnpm, bauen vor dem Umschalten, wenden Prisma-Migrationen an, speichern Uploads unter `shared/uploads`, wechseln den `current`-Symlink atomar und behalten die letzten fuenf Releases. Nach dem Prozessstart muss der Healthcheck erfolgreich sein.

Manueller Backendaufruf:

```bash
export PLESK_BACKEND_DIR=/var/www/vhosts/example/api-vtchub
export PLESK_BACKEND_PORT=3001
export DATABASE_URL='postgresql://...'
bash scripts/plesk/deploy-backend.sh /tmp/backend-release.tgz
```

Manueller Frontendaufruf:

```bash
export PLESK_FRONTEND_DIR=/var/www/vhosts/example/web-vtchub
export PLESK_FRONTEND_PORT=3000
bash scripts/plesk/deploy-frontend.sh /tmp/frontend-release.tgz
```

## Rollback

Backendbeispiel:

```bash
bash scripts/plesk/rollback.sh /var/www/vhosts/example/api-vtchub vtc-backend dist/src/main.js 3001
```

Vor jedem Release wird ein PostgreSQL-Backup erstellt. Uploads liegen ausserhalb der Releases. Redis laeuft mit AOF und Passwort. Zertifikate, Domains und reale Plesk-Zugangsdaten muessen vom Betreiber bereitgestellt werden; ein lokaler Build bestaetigt kein erfolgreiches externes Deployment.

## Go-live-Kontrolle

Nach dem Umschalten muessen mindestens folgende Aufrufe geprueft werden:

```bash
curl --fail https://staging.vtc-truck-hub.de/api/health
curl --fail https://staging.vtc-truck-hub.de/api/auth/providers
```

Der erste Aufruf muss `status: ok` melden. Der zweite muss `google`, `discord` und `steam` erst dann als `true` melden, wenn die jeweiligen Betreiberwerte vollstaendig gesetzt sind. Anschliessend werden Web- und Desktop-Login interaktiv abgenommen; Secrets oder JWTs duerfen dabei weder in URLs noch in Deployment-Logs erscheinen.
