#!/usr/bin/env bash
set -e

cat <<'EOF'
Usage (SSH on server):
  export PLESK_BACKEND_DIR=/var/www/vhosts/DEINE-DOMAIN.de/htdocs
  bash scripts/plesk/deploy-backend.sh /tmp/backend-<sha>.tgz

  export PLESK_FRONTEND_DIR=/var/www/vhosts/DEINE-DOMAIN.de/htdocs
  bash scripts/plesk/deploy-frontend.sh /tmp/frontend-<sha>.tgz
EOF