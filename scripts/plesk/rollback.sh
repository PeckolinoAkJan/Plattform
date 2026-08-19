#!/usr/bin/env bash
set -euo pipefail

APP_ROOT="${1:?Usage: rollback.sh <app-root> <service-name> <entrypoint> [port]}"
SERVICE_NAME="${2:?service-name is required}"
ENTRYPOINT="${3:?entrypoint is required}"
PORT="${4:-3000}"
PREVIOUS="$(find "$APP_ROOT/releases" -mindepth 1 -maxdepth 1 -type d -printf '%T@ %p\n' | sort -nr | sed -n '2p' | cut -d' ' -f2-)"

test -n "$PREVIOUS" || { echo "No previous release available"; exit 1; }
ln -sfn "$PREVIOUS" "$APP_ROOT/current.next"
mv -Tf "$APP_ROOT/current.next" "$APP_ROOT/current"
pm2 delete "$SERVICE_NAME" >/dev/null 2>&1 || true
PORT="$PORT" NODE_ENV=production pm2 start "$APP_ROOT/current/$ENTRYPOINT" --name "$SERVICE_NAME" --time
pm2 save
echo "Rolled back $SERVICE_NAME to $PREVIOUS"
