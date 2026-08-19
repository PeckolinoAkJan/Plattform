#!/usr/bin/env bash
set -euo pipefail

APP_ROOT="${PLESK_BACKEND_DIR:?PLESK_BACKEND_DIR is required}"
SERVICE_NAME="${PLESK_BACKEND_SERVICE_NAME:-vtc-backend}"
PORT="${PLESK_BACKEND_PORT:-3001}"
PACKAGE_FILE="${1:?Usage: deploy-backend.sh <backend-deploy.tgz>}"
RELEASE_ID="${RELEASE_ID:-$(date -u +%Y%m%d%H%M%S)}"
RELEASES="$APP_ROOT/releases"
SHARED="$APP_ROOT/shared"
RELEASE="$RELEASES/$RELEASE_ID"

command -v pm2 >/dev/null 2>&1 || { echo "pm2 is required"; exit 1; }
command -v corepack >/dev/null 2>&1 || { echo "Node.js corepack is required"; exit 1; }
test -f "$PACKAGE_FILE" || { echo "Package not found: $PACKAGE_FILE"; exit 1; }

mkdir -p "$RELEASE" "$SHARED/uploads" "$SHARED/backups"
ENV_FILE="$SHARED/.env"
test -f "$ENV_FILE" || { echo "Persistent backend configuration missing: $ENV_FILE"; exit 1; }
tar -xzf "$PACKAGE_FILE" -C "$RELEASE"
APP_DIR="$RELEASE/backend"
test -f "$APP_DIR/package.json" || { echo "backend/package.json missing in package"; exit 1; }
ln -sfn "$ENV_FILE" "$APP_DIR/.env"

cd "$APP_DIR"
corepack pnpm install --frozen-lockfile
corepack pnpm run prisma:generate
corepack pnpm run build
command -v pg_dump >/dev/null 2>&1 || { echo "pg_dump is required before migrations"; exit 1; }
DATABASE_URL_VALUE="$(sed -n 's/^DATABASE_URL=//p' "$ENV_FILE" | tail -n 1 | tr -d '\r')"
test -n "$DATABASE_URL_VALUE" || { echo "DATABASE_URL is required in $ENV_FILE"; exit 1; }
BACKUP_FILE="$SHARED/backups/pre-deploy-$RELEASE_ID.dump"
pg_dump --format=custom --file="$BACKUP_FILE" "$DATABASE_URL_VALUE"
corepack pnpm run prisma:migrate:deploy
corepack pnpm prune --prod

rm -rf "$APP_DIR/uploads"
ln -s "$SHARED/uploads" "$APP_DIR/uploads"
ln -sfn "$APP_DIR" "$APP_ROOT/current.next"
mv -Tf "$APP_ROOT/current.next" "$APP_ROOT/current"

pm2 delete "$SERVICE_NAME" >/dev/null 2>&1 || true
PORT="$PORT" NODE_ENV=production pm2 start "$APP_ROOT/current/dist/src/main.js" --name "$SERVICE_NAME" --time
pm2 save

healthy=false
for attempt in $(seq 1 20); do
  if curl --fail --silent --show-error "http://127.0.0.1:$PORT/api/health" >/dev/null; then
    healthy=true
    break
  fi
  sleep 2
done
test "$healthy" = true || { echo "Backend health check failed on port $PORT"; exit 1; }
find "$SHARED/backups" -mindepth 1 -maxdepth 1 -type f -name 'pre-deploy-*.dump' -printf '%T@ %p\n' | sort -nr | tail -n +11 | cut -d' ' -f2- | xargs -r rm -f
find "$RELEASES" -mindepth 1 -maxdepth 1 -type d -printf '%T@ %p\n' | sort -nr | tail -n +6 | cut -d' ' -f2- | xargs -r rm -rf
echo "Backend release $RELEASE_ID deployed successfully."
