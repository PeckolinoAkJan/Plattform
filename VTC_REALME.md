# VTC Hub - Release-Uebergabe

Stand: 19.08.2026

Diese Datei beschreibt den nachgewiesenen Stand des Projekts. Geheimnisse, Passwoerter, Tokens und private Schluessel sind absichtlich nicht enthalten.

## Projekt und Remote-Stand

- Projekt: `C:\Users\jrike\Documents\Neues Projekt\Spark Projekt`
- Repository: `https://github.com/PeckolinoAkJan/Plattform`
- Remote-Branch vor diesem Abschlusslauf: `main` auf Commit `340e227`
- Bereits vorhandenes Remote-Release: `v1.1.0`
- Lokaler Release-Kandidat: `v1.1.1`, noch nicht committed, gepusht oder getaggt
- Die GitHub-CLI-Anmeldung fuer `PeckolinoAkJan` ist aktuell abgelaufen und muss vor Push/Tag erneuert werden.

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
- Desktop-Version, NSIS/Inno-Metadaten und Tag-Workflow sind auf `1.1.1` vereinheitlicht.
- Der Tag-Workflow erzeugt portable ZIP, Setup-EXE und `latest.json` mit der SHA-256-Pruefsumme derselben Setup-Datei.
- Next.js wurde auf die gepatchte Version 15.5.21 aktualisiert; sichere Sharp-/PostCSS-Versionen werden ueber pnpm 11 erzwungen.

## Lokal nachgewiesen

- Backend-NestJS-Produktionsbuild: erfolgreich
- Frontend-TypeScript-Pruefung: erfolgreich
- Frontend-Next.js-Produktionsbuild: erfolgreich, 17 Routen
- Desktop-.NET-Releasebuild: erfolgreich
- Vollstaendiger NSIS-Installerbuild `1.1.1`: erfolgreich
- Backend- und Frontend-Produktionsaudits: keine bekannten Schwachstellen
- Lokaler Installer: `desktop/VtcDesktopClient/Installer/output/installer/VtcDesktopClient-Setup.exe`
- Groesse: `49.553.852` Bytes
- Lokale SHA-256-Pruefsumme: `ce1da8d8b4725ec889bd223d7528f4fa5fc815d803ef646cd13491ffda9430a8`
- Authenticode-Status: `NotSigned` (es wurde kein Publisher-Zertifikat bereitgestellt)
- Eingebettete API: `https://staging.vtc-truck-hub.de`
- Eingebettetes Update-Manifest: `https://github.com/PeckolinoAkJan/Plattform/releases/latest/download/latest.json`

Der lokale NuGet-Auditfeed war in der Sandbox nicht erreichbar; der Desktop-Build selbst hatte keine Fehler. Der GitHub-Tag-Workflow baut das Release spaeter reproduzierbar auf .NET 8 und berechnet dort die tatsaechliche Release-Pruefsumme neu.

## Datenstatus

- PostgreSQL 16 (`vtchub-postgres`) und Redis 7 (`vtchub-redis`) wurden in diesem Lauf als `healthy` verifiziert.
- Prisma-Migrationen:
  - `20260819090000_initial`
  - `20260819110000_legacy_auth`
- Prisma meldet das lokale Schema als aktuell.
- Verifizierter Legacy-Import: 7 Benutzer, 2 Speditionen, 5 Mitgliedschaften, 9 Social-Accounts.
- Nachgewiesenes lokales Backup: `databases/backups/vtc-platform-20260819-095648.dump`.

## Externer Erreichbarkeitstest

- `staging.vtc-truck-hub.de` loest auf `159.195.60.60` auf.
- TCP 80, 443 und der Plesk-Port 8443 waren vom Testsystem nicht erreichbar; ein HTTP-/HTTPS-Healthcheck gegen die Staging-Domain war daher noch nicht moeglich.
- Die lokale Backend-Instanz meldete Datenbank und Redis als `up`; der Auth-Smoke-Test lieferte fuer Bearer-JWT, HttpOnly-Cookie und Providerstatus jeweils HTTP 200.

## Externe Schritte, die noch echte Betreiberfreigaben benoetigen

1. GitHub erneut anmelden, die lokalen Aenderungen reviewen, committen und nach `main` pushen.
2. Plesk-Zugriff fuer `staging.vtc-truck-hub.de` bereitstellen oder die vorhandene angemeldete Sitzung nutzbar machen.
3. DNS, Let's Encrypt, Reverse Proxy fuer `/`, `/api`, `/socket.io` und `/uploads` sowie die Ports 3000/3001 bestaetigen.
4. Backenddatei `<PLESK_BACKEND_DIR>/shared/.env` aus `backend/.env.production.example` mit realen Werten erstellen und Modus `600` setzen.
5. Frontenddatei `<PLESK_FRONTEND_DIR>/shared/.env.production` aus `frontend/.env.production.example` erstellen und Modus `600` setzen.
6. PostgreSQL 16, Redis 7 und `pg_dump` bereitstellen; Datenbank und Benutzer anlegen.
7. GitHub-Secrets `PLESK_HOST`, `PLESK_SSH_PORT`, `PLESK_USER`, `PLESK_SSH_KEY`, `PLESK_BACKEND_DIR` und `PLESK_FRONTEND_DIR` setzen.
8. Backend- und Frontend-Workflow starten und Healthcheck, Providerstatus, Webseite, Uploads und WebSocket pruefen.
9. Google-, Discord- und Steam-Anwendungen mit den Callback-URLs aus `INSTALLATION.md` registrieren.
10. Vor einer oeffentlichen Produktionsverteilung ein Windows-Code-Signing-Zertifikat bereitstellen oder den bewusst unsignierten Status freigeben; danach den Release-Kandidaten als Tag `v1.1.1` veroeffentlichen und Setup, ZIP sowie `latest.json` im GitHub Release pruefen.
11. Web- und Desktoplogin, Sessionablauf, Plugininstallation, echte Jobereignisse, Livefahrer, Backup und Restore Ende-zu-Ende abnehmen.
12. SCS-Spielweltkoordinaten mit einer kalibrierten ETS2-/ATS-Projektion nach WGS84 umrechnen. Ohne diese externe Kalibrierung werden rohe Spielkoordinaten absichtlich nicht als geografische Leaflet-Positionen gesendet.

## Wichtige Dateien

- `README.md`
- `INSTALLATION.md`
- `PLESK-DEPLOY.md`
- `DEPLOYMENT_COMPLETE.md`
- `RELEASE_NOTES_v1.1.1.md`
- `databases/README.md`
- `desktop/VtcDesktopClient/Installer/README.md`
