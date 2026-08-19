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

mkdir -p "$RELEASE" "$SHARED/uploads"
tar -xzf "$PACKAGE_FILE" -C "$RELEASE"
APP_DIR="$RELEASE/backend"
test -f "$APP_DIR/package.json" || { echo "backend/package.json missing in package"; exit 1; }

cd "$APP_DIR"
corepack pnpm install --frozen-lockfile
corepack pnpm run prisma:generate
corepack pnpm run build
test -n "${DATABASE_URL:-}" || { echo "DATABASE_URL is required for production migrations"; exit 1; }
corepack pnpm run prisma:migrate:deploy
corepack pnpm prune --prod

rm -rf "$APP_DIR/uploads"
ln -s "$SHARED/uploads" "$APP_DIR/uploads"
ln -sfn "$APP_DIR" "$APP_ROOT/current.next"
mv -Tf "$APP_ROOT/current.next" "$APP_ROOT/current"

pm2 delete "$SERVICE_NAME" >/dev/null 2>&1 || true
PORT="$PORT" NODE_ENV=production pm2 start "$APP_ROOT/current/dist/src/main.js" --name "$SERVICE_NAME" --time
pm2 save

curl --fail --silent --show-error "http://127.0.0.1:$PORT/api/health" >/dev/null
find "$RELEASES" -mindepth 1 -maxdepth 1 -type d -printf '%T@ %p\n' | sort -nr | tail -n +6 | cut -d' ' -f2- | xargs -r rm -rf
echo "Backend release $RELEASE_ID deployed successfully."
