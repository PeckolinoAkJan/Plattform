# Desktop-Installer

## Erzeugte Artefakte

- Portable: `output/install_portable/VtcDesktopClient.exe`
- Vollstaendige App: `output/app/`
- Setup: `output/installer/VtcDesktopClient-Setup.exe`

## Neu bauen

```powershell
Set-Location desktop\VtcDesktopClient
.\Installer\build-installer.ps1 -BuildInnoInstaller
```

Produktionsnaher Build:

```powershell
.\Installer\build-installer.ps1 `
  -Version 1.1.2 `
  -ApiBaseUrl "https://staging.vtc-truck-hub.de" `
  -UpdateManifestUrl "https://github.com/PeckolinoAkJan/Plattform/releases/latest/download/latest.json" `
  -BuildInnoInstaller
```

Der Build ist self-contained fuer Windows x64. Das Skript nutzt Inno Setup, falls `iscc.exe` verfuegbar ist, andernfalls NSIS. Der Setup-Installer installiert benutzerbezogen unter `%LOCALAPPDATA%\Programs\VtcHub`, erzeugt Startmenue-/Desktoplinks und registriert einen Uninstaller.

Der Unterordner `Plugin` und die Clientkonfiguration werden mit ausgeliefert. Das Plugin wird nicht ungefragt installiert, sondern ueber den ausdruecklichen Button im Client in ETS2/ATS kopiert.

Der Installer enthaelt kein globales Client-Secret. Signierte Telemetrieanfragen verwenden den per DPAPI geschuetzten Benutzer-JWT. Der GitHub-Tag-Workflow erzeugt ausserdem `latest.json` mit der SHA-256-Pruefsumme der Setup-EXE.
