param(
    [string]$ComposeFile = "$PSScriptRoot\..\databases\docker-compose.yml",
    [string]$EnvFile = "$PSScriptRoot\..\databases\.env.example",
    [switch]$SkipBackendSync
)

$ErrorActionPreference = "Stop"

Set-Location "$PSScriptRoot\.."
$root = Get-Location

if (-not (Test-Path "databases\.env")) {
  Copy-Item "databases\.env.example" "databases\.env" | Out-Null
  Write-Host "✓ databases\.env erstellt (aus .env.example)."
}

docker compose -f databases/docker-compose.yml --env-file databases/.env | Out-Null
docker compose -f databases/docker-compose.yml --env-file databases/.env up -d
Write-Host "✓ Datenbank- und Redis-Container wurden gestartet."

try {
  docker exec vtchub-postgres pg_isready -U $(
    (Get-Content databases/.env | Where-Object { $_ -match '^POSTGRES_USER=' } | ForEach-Object { $_ -replace '^POSTGRES_USER=', '' })[0]
  ) -d $(
    (Get-Content databases/.env | Where-Object { $_ -match '^POSTGRES_DB=' } | ForEach-Object { $_ -replace '^POSTGRES_DB=', '' })[0]
  ) | Out-Null
}
catch {
  Write-Host "⚠️  PostgreSQL-Readiness-Check fehlgeschlagen, prüfe den Container-Start."
  throw
}

$envVars = @{}
Get-Content databases/.env | ForEach-Object {
  if ($_ -match '^\s*([^#\s][^=]*)=(.*)$') {
    $envVars[$Matches[1]] = $Matches[2]
  }
}

$pgUser = $envVars.POSTGRES_USER
$mainDb = $envVars.POSTGRES_DB
$testDb = $envVars.POSTGRES_TEST_DB

if (-not [string]::IsNullOrWhiteSpace($testDb) -and $testDb -ne $mainDb) {
  $exists = docker exec vtchub-postgres psql -U $pgUser -d $mainDb -At -c "SELECT 1 FROM pg_database WHERE datname='$testDb';"
  if ($exists -ne "1") {
    docker exec vtchub-postgres psql -U $pgUser -d $mainDb -c "CREATE DATABASE ""$testDb"";"
    Write-Host "✓ Zusätzliche Datenbank erstellt: $testDb"
  }
  else {
    Write-Host "✓ Zusatzdatenbank vorhanden: $testDb"
  }
}

if (-not $SkipBackendSync) {
  if (Test-Path "backend\.env") {
    Push-Location backend
    try {
      if (Test-Path "node_modules") {
        npm run prisma:generate | Out-Null
        npm run prisma:migrate:deploy | Out-Null
        Write-Host "✓ Prisma-Client generiert und Migrationen angewendet."
      }
      else {
        Write-Host "⚠️  backend/node_modules nicht vorhanden – migrations konnten nicht automatisch ausgeführt werden."
      }
    }
    finally {
      Pop-Location
    }
  }
  else {
    Write-Host "⚠️  backend\.env nicht vorhanden – Migrationen wurden übersprungen."
  }
}

Write-Host ""
Write-Host "FERTIG. Bereit:"
Write-Host "  - PostgreSQL: $mainDb (+ $testDb falls gesetzt)"
Write-Host "  - Redis:      vtc-hub (Container) "
