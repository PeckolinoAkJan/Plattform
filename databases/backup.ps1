param([string]$Destination = "$PSScriptRoot\backups")
$ErrorActionPreference = "Stop"
$envFile = Join-Path $PSScriptRoot ".env"
if (-not (Test-Path -LiteralPath $envFile)) { throw "databases/.env fehlt." }
Get-Content -LiteralPath $envFile | Where-Object { $_ -match '^[A-Z0-9_]+=' } | ForEach-Object {
    $name, $value = $_ -split '=', 2
    Set-Item -Path "Env:$name" -Value $value
}
New-Item -ItemType Directory -Path $Destination -Force | Out-Null
$stamp = Get-Date -Format "yyyyMMdd-HHmmss"
$target = Join-Path $Destination "vtc-platform-$stamp.dump"
$containerTarget = "/tmp/vtc-platform-$stamp.dump"
docker exec vtchub-postgres pg_dump -U $env:POSTGRES_USER -d $env:POSTGRES_DB --format=custom --clean --if-exists --file=$containerTarget
if ($LASTEXITCODE -ne 0) { throw "pg_dump fehlgeschlagen." }
docker cp "vtchub-postgres:$containerTarget" $target
if ($LASTEXITCODE -ne 0) { throw "Backup konnte nicht aus dem Container kopiert werden." }
docker exec vtchub-postgres rm -f $containerTarget | Out-Null
Write-Host "Backup erstellt: $target"
