#!/usr/bin/env sh
set -euo pipefail

if [ -z "${POSTGRES_TEST_DB:-}" ] || [ "${POSTGRES_TEST_DB}" = "${POSTGRES_DB}" ]; then
  echo "No secondary database required (POSTGRES_TEST_DB empty or equal POSTGRES_DB)."
  exit 0
fi

echo "Ensure optional database ${POSTGRES_TEST_DB} exists..."

exists="$(psql -v ON_ERROR_STOP=1 --username "${POSTGRES_USER}" --dbname "${POSTGRES_DB}" -tAc "SELECT 1 FROM pg_database WHERE datname = '${POSTGRES_TEST_DB}'")"
if [ "$exists" != "1" ]; then
  psql -v ON_ERROR_STOP=1 --username "${POSTGRES_USER}" --dbname "${POSTGRES_DB}" --command "CREATE DATABASE \"${POSTGRES_TEST_DB}\";"
  echo "Created ${POSTGRES_TEST_DB}."
else
  echo "Database ${POSTGRES_TEST_DB} already exists."
fi
