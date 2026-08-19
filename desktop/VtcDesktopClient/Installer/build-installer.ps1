param(
    [string]$ProjectPath = "$PSScriptRoot\\..\\VtcDesktopClient.csproj",
    [string]$Runtime = "win-x64",
    [string]$Configuration = "Release",
    [string]$Version = "1.1.1",
    [string]$OutputRoot = "$PSScriptRoot\\output",
    [string]$ApiBaseUrl = $env:VTC_API_URL,
    [string]$UpdateManifestUrl = $env:VTC_UPDATE_MANIFEST_URL,
    [switch]$BuildInnoInstaller
)

$ErrorActionPreference = "Stop"

if (-not (Get-Command dotnet -ErrorAction SilentlyContinue)) {
    throw "dotnet SDK wurde nicht gefunden. Bitte installiere .NET SDK 8+."
}

if (-not (Test-Path $ProjectPath)) {
    throw "Projektdatei nicht gefunden: $ProjectPath"
}

$publishDir = Join-Path $OutputRoot "app"
$installerDir = Join-Path $OutputRoot "installer"
$portableDir = Join-Path $OutputRoot "install_portable"

New-Item -ItemType Directory -Force -Path $publishDir | Out-Null

Write-Host "🚀 Publishing: $ProjectPath"
& dotnet publish $ProjectPath `
    -c $Configuration `
    -r $Runtime `
    -p:PublishSingleFile=true `
    -p:SelfContained=true `
    -p:PublishTrimmed=false `
    -p:EnableCompression=true `
    -p:IncludeNativeLibrariesForSelfExtract=true `
    -p:Version=$Version `
    -p:FileVersion="$Version.0" `
    -p:InformationalVersion=$Version `
    -o $publishDir

if ($LASTEXITCODE -ne 0) {
    throw "dotnet publish fehlgeschlagen. Bitte Build-Logs prüfen."
}

$publishedSettingsPath = Join-Path $publishDir "clientsettings.json"
if (Test-Path $publishedSettingsPath) {
    $publishedSettings = Get-Content -LiteralPath $publishedSettingsPath -Raw | ConvertFrom-Json
    if (-not [string]::IsNullOrWhiteSpace($ApiBaseUrl)) { $publishedSettings.baseUrl = $ApiBaseUrl.TrimEnd('/') }
    if (-not [string]::IsNullOrWhiteSpace($UpdateManifestUrl)) { $publishedSettings.updateManifestUrl = $UpdateManifestUrl }
    $publishedSettings | ConvertTo-Json | Set-Content -LiteralPath $publishedSettingsPath -Encoding utf8NoBOM
}

$exePath = Join-Path $publishDir "VtcDesktopClient.exe"
if (-not (Test-Path $exePath)) {
    throw "Ausgabe-EXE wurde nicht gefunden: $exePath"
}

Write-Host "✅ Client-Build erstellt:"
Write-Host "   Portable: $exePath"
Write-Host "   Optional: auch Inno-Setup-Installer in .\\installer\\ erzeugen mit -BuildInnoInstaller"

New-Item -ItemType Directory -Force -Path $portableDir | Out-Null
Copy-Item -Path (Join-Path $publishDir "*") -Destination $portableDir -Recurse -Force
Write-Host "✅ Portable-Ordner aktualisiert:"
Write-Host "   $portableDir\\VtcDesktopClient.exe"

if ($BuildInnoInstaller) {
    $iscc = Get-Command iscc -ErrorAction SilentlyContinue
    New-Item -ItemType Directory -Force -Path $installerDir | Out-Null
    if ($iscc) {
        $issPath = Join-Path $PSScriptRoot "VtcDesktopClient.iss"
        if (-not (Test-Path $issPath)) {
            throw "Inno-Setup Script fehlt: $issPath"
        }

        & $iscc.Source @(
            "/DSourceDir=$publishDir",
            "/DOutputDir=$installerDir",
            "/DOutputBaseName=VtcDesktopClient-Setup",
            "/DAppVersion=$Version",
            $issPath
        )
    }
    else {
        $makensisCandidates = @(
            "C:\Program Files (x86)\NSIS\makensis.exe",
            "C:\Program Files\NSIS\makensis.exe"
        )
        $makensis = $makensisCandidates | Where-Object { Test-Path -LiteralPath $_ } | Select-Object -First 1
        if (-not $makensis) {
            throw "Weder Inno Setup noch NSIS wurde gefunden. Installiere einen der beiden Compiler."
        }

        $nsiPath = Join-Path $PSScriptRoot "VtcDesktopClient.nsi"
        if (-not (Test-Path $nsiPath)) {
            throw "NSIS-Script fehlt: $nsiPath"
        }

        & $makensis `
            "/DSourceDir=$publishDir" `
            "/DOutputDir=$installerDir" `
            "/DProductVersion=$Version" `
            $nsiPath
    }

    if ($LASTEXITCODE -ne 0) {
        throw "Inno Setup Build fehlgeschlagen."
    }

    Write-Host "✅ Installer-EXE erstellt:"
    Write-Host "   $installerDir\\VtcDesktopClient-Setup.exe"
}
