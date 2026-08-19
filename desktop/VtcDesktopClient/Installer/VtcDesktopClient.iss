#ifndef AppVersion
  #define AppVersion "1.1.1"
#endif

[Setup]
AppId={{3B0A8D7C-1A5F-4D77-BA3A-95D5AEBE9F2D}}
AppName=VTC Hub Client
AppVersion={#AppVersion}
DefaultDirName={autopf}\VTC Hub\VTC Desktop Client
DefaultGroupName=VTC Hub
PrivilegesRequired=lowest
DisableDirPage=no
DisableProgramGroupPage=no
OutputDir={#OutputDir}
OutputBaseFilename={#OutputBaseName}
Compression=lzma
SolidCompression=yes
WizardStyle=modern
ChangesAssociations=no
SetupLogging=no
UninstallDisplayName=VTC Hub Client
ArchitecturesInstallIn64BitMode=x64

[Languages]
Name: "english"; MessagesFile: "compiler:Default.isl"
Name: "german"; MessagesFile: "compiler:Languages\\German.isl"

[Dirs]
Name: "{app}"

[Files]
Source: "{#SourceDir}\\*"; DestDir: "{app}"; Flags: ignoreversion recursesubdirs createallsubdirs

[Icons]
Name: "{group}\VTC Hub Client"; Filename: "{app}\VtcDesktopClient.exe"
Name: "{autodesktop}\VTC Hub Client"; Filename: "{app}\VtcDesktopClient.exe"; Tasks: desktopicon

[Tasks]
Name: "desktopicon"; Description: "Desktop-Verknüpfung erstellen"; GroupDescription: "Zusätzliche Optionen:"

[Run]
Filename: "{app}\VtcDesktopClient.exe"; Description: "VTC Hub Client starten"; Flags: nowait postinstall skipifsilent

[UninstallDelete]
Type: filesandordirs; Name: "{userappdata}\VtcDesktopClient"
