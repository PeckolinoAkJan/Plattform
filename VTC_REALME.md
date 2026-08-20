# VTC Hub - Release-Uebergabe

Stand: 20.08.2026

Diese Datei beschreibt den nachgewiesenen Stand des Projekts. Geheimnisse, Passwoerter, Tokens und private Schluessel sind absichtlich nicht enthalten.

## Projekt und Remote-Stand

- Projekt: `C:\Users\jrike\Documents\Neues Projekt\Spark Projekt`
- Repository: `https://github.com/PeckolinoAkJan/Plattform`
- Remote-Branch vor diesem Release: `main` auf Commit `70f8d83` (`v1.1.1`)
- Lokaler Release-Kandidat: `v1.1.2`
- Zielumgebung: `https://staging.vtc-truck-hub.de`
- Plesk-Backend und -Frontend laufen als systemd-Dienste hinter dem Reverse Proxy.

## In diesem Abschlusslauf korrigiert

- Backend- und Frontend-Defaultports in den Plesk-Workflows auf `3001` beziehungsweise `3000` berichtigt.
- SCP-Artefaktpfade mit `strip_components: 1` an die erwarteten Serverpfade angepasst.
- Persistente Serverkonfiguration unter `shared/.env` und `shared/.env.production` verdrahtet.
- Pre-Deploy-Datenbankbackup vor jeder Prisma-Migration und Healthcheck-Retries ergaenzt.
- Browser-JWT aus Local Storage entfernt; Websessions verwenden ausschliesslich einen HttpOnly-Cookie.
- Backend-JWT-Guard akzeptiert Bearer-Token fuer Desktop und den HttpOnly-Cookie fuer Web.
- OAuth-Provider mit Platzhalterwerten werden korrekt als nicht konfiguriert gemeldet.
- Produktionsstart bricht bei fehlenden oder unsicheren Pflichtwerten ab; HTTPS und ein mindestens 64 Zeichen langes `JWT_SECRET` werden erzwungen.
- WebSocket-Verbindungen ohne gueltigen JWT werden getrennt; Firma, Benutzer und Raum stammen nicht mehr aus ungeprueften Querywerten.
- Livepositionen und Dispatch-Auftraege sind auf die eigene Spedition beschraenkt.
- Gleichzeitiges Annehmen desselben Dispatch-Auftrags wird atomar verhindert.
- Nur Owner duerfen Speditionsstammdaten aendern; Logos duerfen Owner oder Dispatcher hochladen.
- Frei manipulierbare Fahrtenbuch-Einreichung aus dem Web entfernt.
- HMAC-SHA256 verwendet den kurzlebigen Benutzer-JWT statt eines globalen Secrets im oeffentlichen Installer; Redis-Nonce und Timestamp bleiben aktiv.
- Desktop-Live-Telemetrie ist im Drei-Sekunden-Takt verdrahtet, sobald kalibrierte WGS84-Koordinaten vorliegen.
- Der Updater prueft Manifest-HTTPS und SHA-256 und startet danach den verifizierten Setup-Installer, statt ihn ueber die laufende Programmdatei zu kopieren.
- Desktop-Version, NSIS/Inno-Metadaten und Tag-Workflow sind auf `1.1.2` vereinheitlicht.
- Der Tag-Workflow erzeugt portable ZIP, Setup-EXE und `latest.json` mit der SHA-256-Pruefsumme derselben Setup-Datei.
- Next.js wurde auf die gepatchte Version 15.5.21 aktualisiert; sichere Sharp-/PostCSS-Versionen werden ueber pnpm 11 erzwungen.
- Legacy-Benutzer werden bei gleicher normalisierter E-Mail verlustfrei mit bestehenden OAuth-Konten zusammengefuehrt.
- Desktop-Fenster koennen aus dem maximierten Zustand ueber mehrere Monitore gezogen werden.
- Steam-Bibliotheken werden ueber Registry, Standardpfade und `libraryfolders.vdf` erkannt; ETS2 und ATS werden gemeinsam versorgt.
- Die Webnavigation liegt oben; Spedition besitzt die Reiter Uebersicht, Mitglieder und Einstellungen.
- OAuth-Konten koennen im Profil explizit verknuepft und ein normaler Passwort-Login kann eingerichtet werden.

## Lokal nachgewiesen

- Backend-NestJS-Produktionsbuild: erfolgreich
- Frontend-TypeScript-Pruefung: erfolgreich
- Frontend-Next.js-Produktionsbuild: erfolgreich, 17 Routen
- Desktop-.NET-Releasebuild: erfolgreich
- Desktop-.NET-Releasebuild `1.1.2`: erfolgreich
- Backend- und Frontend-Produktionsaudits: keine bekannten Schwachstellen
- Lokaler Installer: `desktop/VtcDesktopClient/Installer/output/installer/VtcDesktopClient-Setup.exe`
- Groesse: `49.553.852` Bytes
- Lokale SHA-256-Pruefsumme: `ce1da8d8b4725ec889bd223d7528f4fa5fc815d803ef646cd13491ffda9430a8`
- Authenticode-Status: `NotSigned` (es wurde kein Publisher-Zertifikat bereitgestellt)
- Eingebettete API: `https://staging.vtc-truck-hub.de`
- Eingebettetes Update-Manifest: `https://github.com/PeckolinoAkJan/Plattform/releases/latest/download/latest.json`

Der lokale NuGet-Auditfeed war in der Sandbox nicht erreichbar; der Desktop-Build selbst hatte keine Fehler. Der GitHub-Tag-Workflow baut das Release spaeter reproduzierbar auf .NET 8 und berechnet dort die tatsaechliche Release-Pruefsumme neu.

## Datenstatus

- PostgreSQL (`vtchub-postgres`) und Redis (`vtchub-redis`) wurden auf Plesk als laufend verifiziert.
- Prisma-Migrationen:
  - `20260819090000_initial`
  - `20260819110000_legacy_auth`
- Prisma meldet das lokale Schema als aktuell.
- Verifizierter Plesk-Legacy-Import: 7 Benutzer, 2 Speditionen, 5 Mitgliedschaften, 9 Social-Accounts.
- Vor dem Import wurde unter `backend/shared/backups` ein geschuetztes PostgreSQL-Backup erzeugt.

## Externer Erreichbarkeitstest

- `staging.vtc-truck-hub.de` ist per HTTPS erreichbar und leitet `/api` an das Backend weiter.
- Google und Discord sind auf Staging konfiguriert; Steam bleibt ohne API-Schluessel deaktiviert.
- Der Providerstatus wurde ueber `/api/auth/providers` verifiziert.

## Externe Schritte, die noch echte Betreiberfreigaben benoetigen

1. Vor einer oeffentlichen Produktionsverteilung ein Windows-Code-Signing-Zertifikat bereitstellen oder den bewusst unsignierten Status freigeben.
2. Steam-Anwendung und API-Schluessel registrieren, sobald der Steam-Account die Voraussetzung erfuellt.
3. Web- und Desktoplogin, Sessionablauf, Plugininstallation, echte Jobereignisse und mehrere Livefahrer Ende-zu-Ende abnehmen.
4. SCS-Spielweltkoordinaten mit einer kalibrierten ETS2-/ATS-Projektion nach WGS84 umrechnen. Ohne diese externe Kalibrierung werden rohe Spielkoordinaten absichtlich nicht als geografische Leaflet-Positionen gesendet.

## Wichtige Dateien

- `README.md`
- `INSTALLATION.md`
- `PLESK-DEPLOY.md`
- `DEPLOYMENT_COMPLETE.md`
- `RELEASE_NOTES_v1.1.1.md`
- `RELEASE_NOTES_v1.1.2.md`
- `databases/README.md`
- `desktop/VtcDesktopClient/Installer/README.md`
