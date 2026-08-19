param([Parameter(Mandatory = $true)][string]$BackupFile)
$ErrorActionPreference = "Stop"
$resolved = (Resolve-Path -LiteralPath $BackupFile).Path
$envFile = Join-Path $PSScriptRoot ".env"
if (-not (Test-Path -LiteralPath $envFile)) { throw "databases/.env fehlt." }
Get-Content -LiteralPath $envFile | Where-Object { $_ -match '^[A-Z0-9_]+=' } | ForEach-Object {
    $name, $value = $_ -split '=', 2
    Set-Item -Path "Env:$name" -Value $value
}
$containerSource = "/tmp/vtc-restore-$([Guid]::NewGuid().ToString('N')).dump"
docker cp $resolved "vtchub-postgres:$containerSource"
if ($LASTEXITCODE -ne 0) { throw "Backup konnte nicht in den Container kopiert werden." }
docker exec vtchub-postgres pg_restore -U $env:POSTGRES_USER -d $env:POSTGRES_DB --clean --if-exists --no-owner $containerSource
if ($LASTEXITCODE -ne 0) { throw "Restore fehlgeschlagen." }
docker exec vtchub-postgres rm -f $containerSource | Out-Null
Write-Host "Restore abgeschlossen: $resolved"
