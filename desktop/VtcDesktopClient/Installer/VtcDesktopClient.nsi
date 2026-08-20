Unicode True
RequestExecutionLevel user

!include "MUI2.nsh"
!include "FileFunc.nsh"

!ifndef SourceDir
  !define SourceDir "output\app"
!endif
!ifndef OutputDir
  !define OutputDir "output\installer"
!endif

!define ProductName "VTC Hub Desktop Client"
!ifndef ProductVersion
  !define ProductVersion "1.1.3"
!endif
!define ProductPublisher "VTC Hub"
!define ProductExe "VtcDesktopClient.exe"
!define ProductRegKey "Software\Microsoft\Windows\CurrentVersion\Uninstall\VtcHubDesktopClient"

Name "${ProductName} ${ProductVersion}"
OutFile "${OutputDir}\VtcDesktopClient-Setup.exe"
InstallDir "$LOCALAPPDATA\Programs\VtcHub"
InstallDirRegKey HKCU "${ProductRegKey}" "InstallLocation"
BrandingText "VTC Hub"
SetCompressor /SOLID lzma

!define MUI_ABORTWARNING
!define MUI_FINISHPAGE_RUN "$INSTDIR\${ProductExe}"
!define MUI_FINISHPAGE_RUN_TEXT "VTC Hub jetzt starten"
!insertmacro MUI_PAGE_WELCOME
!insertmacro MUI_PAGE_DIRECTORY
!insertmacro MUI_PAGE_INSTFILES
!insertmacro MUI_PAGE_FINISH
!insertmacro MUI_UNPAGE_CONFIRM
!insertmacro MUI_UNPAGE_INSTFILES
!insertmacro MUI_LANGUAGE "German"

Section "VTC Hub Desktop Client" SEC_MAIN
  SetOutPath "$INSTDIR"
  File /r "${SourceDir}\*.*"
  WriteUninstaller "$INSTDIR\Uninstall.exe"

  CreateDirectory "$SMPROGRAMS\VTC Hub"
  CreateShortcut "$SMPROGRAMS\VTC Hub\VTC Hub.lnk" "$INSTDIR\${ProductExe}"
  CreateShortcut "$SMPROGRAMS\VTC Hub\VTC Hub deinstallieren.lnk" "$INSTDIR\Uninstall.exe"
  CreateShortcut "$DESKTOP\VTC Hub.lnk" "$INSTDIR\${ProductExe}"

  WriteRegStr HKCU "${ProductRegKey}" "DisplayName" "${ProductName}"
  WriteRegStr HKCU "${ProductRegKey}" "DisplayVersion" "${ProductVersion}"
  WriteRegStr HKCU "${ProductRegKey}" "Publisher" "${ProductPublisher}"
  WriteRegStr HKCU "${ProductRegKey}" "InstallLocation" "$INSTDIR"
  WriteRegStr HKCU "${ProductRegKey}" "DisplayIcon" "$INSTDIR\${ProductExe}"
  WriteRegStr HKCU "${ProductRegKey}" "UninstallString" '"$INSTDIR\Uninstall.exe"'
  WriteRegDWORD HKCU "${ProductRegKey}" "NoModify" 1
  WriteRegDWORD HKCU "${ProductRegKey}" "NoRepair" 1
  ${GetSize} "$INSTDIR" "/S=0K" $0 $1 $2
  WriteRegDWORD HKCU "${ProductRegKey}" "EstimatedSize" $0
SectionEnd

Section "Uninstall"
  Delete "$DESKTOP\VTC Hub.lnk"
  RMDir /r "$SMPROGRAMS\VTC Hub"
  DeleteRegKey HKCU "${ProductRegKey}"
  RMDir /r "$INSTDIR"
SectionEnd
