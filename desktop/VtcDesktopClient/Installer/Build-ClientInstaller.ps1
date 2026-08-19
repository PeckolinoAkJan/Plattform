param(
    [string]$ProjectFile = "$PSScriptRoot\..\VtcDesktopClient.csproj",
    [string]$Configuration = "Release",
    [string]$Runtime = "win-x64",
    [string]$Version = "1.1.1",
    [string]$OutputFolder = "$PSScriptRoot\output"
)

$ErrorActionPreference = "Stop"

& "$PSScriptRoot\build-installer.ps1" `
    -ProjectPath $ProjectFile `
    -Configuration $Configuration `
    -Runtime $Runtime `
    -Version $Version `
    -OutputRoot $OutputFolder `
    -BuildInnoInstaller

if ($LASTEXITCODE -ne 0) {
    throw "Installer-Build fehlgeschlagen."
}
