param(
    [string]$ProjectFile = "$PSScriptRoot\..\VtcDesktopClient.csproj",
    [string]$Configuration = "Release",
    [string]$Runtime = "win-x64",
    [string]$Version = "1.0.0",
    [string]$OutputFolder = "$PSScriptRoot\..\dist"
)

$ErrorActionPreference = "Stop"

$projectDirectory = Split-Path -Parent $ProjectFile
$clientName = [System.IO.Path]::GetFileNameWithoutExtension($ProjectFile)
$resolvedOutputFolder = [System.IO.Path]::GetFullPath($OutputFolder)

if (!(Test-Path $ProjectFile)) {
    throw "Projektdatei nicht gefunden: $ProjectFile"
}

$projectPath = (Resolve-Path $ProjectFile).Path

[xml]$csproj = Get-Content -Raw $projectPath
$assemblyNameNode = $csproj.Project.PropertyGroup | Where-Object { $_.AssemblyName } | Select-Object -First 1
$appExeName = if ($assemblyNameNode -and $assemblyNameNode.AssemblyName -and $assemblyNameNode.AssemblyName.InnerText) {
    $assemblyNameNode.AssemblyName.InnerText
} else {
    $clientName
}
$appExeName = "$appExeName.exe"

$publishOutput = Join-Path $resolvedOutputFolder "publish"
$installerOutput = Join-Path $resolvedOutputFolder "installer"
$portableExecutableName = [System.IO.Path]::GetFileNameWithoutExtension($appExeName)
$portableOutput = Join-Path $resolvedOutputFolder "$portableExecutableName-Portable-v$Version.exe"
$safeIsccSource = Join-Path $env:TEMP "VtcDesktopClient-Installer-Source"
$safeIsccOutput = Join-Path $env:TEMP "VtcDesktopClient-Installer-Build"
$generatedInstallerName = "$portableExecutableName-Setup-v$Version.exe"

New-Item -ItemType Directory -Path $publishOutput, $installerOutput, $safeIsccSource, $safeIsccOutput -Force | Out-Null

Write-Host "Erstelle self-contained Single-File Build..."
dotnet publish $projectPath `
  -c $Configuration `
  -r $Runtime `
  --self-contained true `
  -p:PublishSingleFile=true `
  -p:PublishTrimmed=false `
  -p:IncludeNativeLibrariesForSelfExtract=true `
  -p:EnableCompressionInSingleFile=true `
  -p:DebugType=None `
  --output $publishOutput

if ($LASTEXITCODE -ne 0) {
    throw "dotnet publish fehlgeschlagen."
}

$builtExecutable = Join-Path $publishOutput $appExeName
if (!(Test-Path $builtExecutable)) {
    throw "Build-Datei wurde nicht gefunden: $builtExecutable"
}

Copy-Item $builtExecutable $portableOutput -Force
Write-Host "Portable Exe erstellt: $portableOutput"

$iscc = Get-Command iscc -ErrorAction SilentlyContinue
if ($null -eq $iscc) {
    Write-Warning "Inno Setup (iscc.exe) nicht gefunden."
    Write-Host "Portable Exe liegt fertig vor. Für Installer-EXE installiere zuerst Inno Setup: https://jrsoftware.org/isinfo.php"
    Write-Host "Danach erneut Build-Skript ausführen."
    return
}

$issPath = Join-Path $PSScriptRoot "VtcDesktopClient.iss"
$issArgs = @(
    "/O$safeIsccOutput",
    "/F$($portableExecutableName)-Setup-v$Version",
    "/dMyAppSource=$safeIsccSource",
    "/dMyAppVersion=$Version",
    "/dMyAppExeName=$appExeName",
    "/dMyAppInstallerBase=$portableExecutableName-Setup",
    "/dMyAppPublisher=VTC Hub"
)

Get-ChildItem -Path $safeIsccSource | Remove-Item -Recurse -Force
Copy-Item -Path (Join-Path $publishOutput "*") -Destination $safeIsccSource -Recurse -Force

$iconPath = Join-Path $projectDirectory "Assets\VtcDesktopClient.ico"
if (Test-Path $iconPath) {
    $issArgs += "/dMyAppIconPath=$iconPath"
}

Write-Host "Baue Setup-Exe (Inno Setup)..."
& $iscc.Path @issArgs $issPath | Out-Host

if ($LASTEXITCODE -ne 0) {
    throw "Inno Setup Build fehlgeschlagen."
}

$builtInstaller = Get-ChildItem $safeIsccOutput -Filter "*.exe" | Sort-Object LastWriteTime -Descending | Select-Object -First 1
if ($null -eq $builtInstaller) {
    throw "Setup-Exe wurde nicht generiert."
}

$finalInstallerPath = Join-Path $installerOutput $generatedInstallerName
Copy-Item $builtInstaller.FullName $finalInstallerPath -Force

Write-Host "Installations-Exe erstellt:"
Write-Host $finalInstallerPath
