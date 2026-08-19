#!/usr/bin/env bash
set -euo pipefail

APP_ROOT="${PLESK_FRONTEND_DIR:?PLESK_FRONTEND_DIR is required}"
SERVICE_NAME="${PLESK_FRONTEND_SERVICE_NAME:-vtc-frontend}"
PORT="${PLESK_FRONTEND_PORT:-3000}"
PACKAGE_FILE="${1:?Usage: deploy-frontend.sh <frontend-deploy.tgz>}"
RELEASE_ID="${RELEASE_ID:-$(date -u +%Y%m%d%H%M%S)}"
RELEASES="$APP_ROOT/releases"
RELEASE="$RELEASES/$RELEASE_ID"

command -v pm2 >/dev/null 2>&1 || { echo "pm2 is required"; exit 1; }
command -v corepack >/dev/null 2>&1 || { echo "Node.js corepack is required"; exit 1; }
test -f "$PACKAGE_FILE" || { echo "Package not found: $PACKAGE_FILE"; exit 1; }

mkdir -p "$RELEASE"
tar -xzf "$PACKAGE_FILE" -C "$RELEASE"
APP_DIR="$RELEASE/frontend"
test -f "$APP_DIR/package.json" || { echo "frontend/package.json missing in package"; exit 1; }

cd "$APP_DIR"
corepack pnpm install --frozen-lockfile
corepack pnpm run build
corepack pnpm prune --prod

ln -sfn "$APP_DIR" "$APP_ROOT/current.next"
mv -Tf "$APP_ROOT/current.next" "$APP_ROOT/current"

pm2 delete "$SERVICE_NAME" >/dev/null 2>&1 || true
NODE_ENV=production PORT="$PORT" pm2 start "$(command -v corepack)" --name "$SERVICE_NAME" --cwd "$APP_ROOT/current" -- pnpm start --port "$PORT"
pm2 save

curl --fail --silent --show-error "http://127.0.0.1:$PORT/" >/dev/null
find "$RELEASES" -mindepth 1 -maxdepth 1 -type d -printf '%T@ %p\n' | sort -nr | tail -n +6 | cut -d' ' -f2- | xargs -r rm -rf
echo "Frontend release $RELEASE_ID deployed successfully."
