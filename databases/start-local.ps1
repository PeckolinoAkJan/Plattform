$ErrorActionPreference = 'Stop'

# Kurzstart für lokale Entwicklung:
# - PostgreSQL + Redis starten
# - optional zweite Datenbank vtc_platform_test anlegen
# - Prisma syncen, falls backend/.env vorhanden ist

& "$PSScriptRoot\bootstrap.ps1"
