# VTC Hub v1.1.3

## Desktop-Client und Telemetrie

- Reparierte Installation des ETS2-/ATS-Telemetrie-Plugins inklusive gebündelter Plugin-DLL.
- Aussagekräftige Statusanzeigen für SCS-Telemetrie, Netzwerkverbindung und Synchronisierung.
- Neue analoge Lkw-Tachoanzeige und vervollständigte Navigation im Desktop-Client.
- Präzisere Umrechnung der SCS-Spielkoordinaten für die Live-Karte.
- Korrigierte API-Kommunikation zwischen Client, Backend und Live-Karte.

## Live-Karte und Web-App

- Speicherung und Anzeige der zuletzt bekannten Fahrerpositionen.
- Neue Nachrichtenansicht im Web-Dashboard.
- Verbesserte Live-Datenübertragung vom Spiel bis zur Staging-Webseite.

## Speditionschat

- Neuer firmenbezogener Chat im Backend, Web-Dashboard und Desktop-Client.
- Datenbankmigration `20260820090000_company_chat` für Chat-Unterhaltungen und Nachrichten.
- Zugriff auf den Chat ist auf Mitglieder der jeweiligen Spedition beschränkt.

## Installation

- Windows-Installer und portable Windows-x64-Version werden automatisch als GitHub-Release-Artefakte erzeugt.
- Hinweis: Der Windows-Installer ist derzeit nicht codesigniert; Windows kann deshalb eine SmartScreen-Warnung anzeigen.
