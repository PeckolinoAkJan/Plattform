# VTC Hub 1.1.2

Version 1.1.2 erweitert den Desktop-Login, repariert die Telemetrie-Installation und bringt den migrierten Legacy-Bestand in die Staging-Plattform.

## Datenmigration

- Der verifizierte Supabase-Legacy-Export wurde verlustfrei nach PostgreSQL importiert.
- Ein bereits per Google angelegtes Konto wird anhand der normalisierten E-Mail dem Legacy-Konto zugeordnet, statt einen doppelten Benutzer zu erzeugen.
- Importiert und geprueft sind 7 Benutzer, 2 Speditionen, 5 Mitgliedschaften und 9 Sozialkonten.
- Manifest, Dateipruefsummen, Import-Audit und Idempotenz werden vor beziehungsweise nach dem Import kontrolliert.

## Desktop-Client

- Rahmenlose Fenster lassen sich wieder ueber mehrere Monitore verschieben, auch wenn der Drag im maximierten Zustand beginnt.
- Beim Start wird eine gespeicherte Sitzung geprueft und andernfalls sofort der Login angeboten.
- E-Mail/Passwort, Google, Discord und Steam sind als Anmeldewege integriert; nicht konfigurierte Provider werden eindeutig deaktiviert angezeigt.
- Der Telemetrie-Installer erkennt Steam ueber Benutzer- und Maschinenregistrierung sowie Standardpfade und installiert das Plugin in alle gefundenen ETS2-/ATS-Bibliotheken.

## Webseite und Konten

- Die Hauptnavigation liegt oben und fuehrt in der Reihenfolge zu Uebersicht, Fahrtenbuch, Spedition, Livekarte und CTA-Experiment.
- Die Speditionsseite besitzt eigene Reiter fuer Uebersicht, Mitglieder und Einstellungen.
- Im Profil koennen Google-, Discord- und Steam-Konten explizit und konfliktgeprueft verknuepft werden.
- OAuth-only-Konten koennen einen normalen E-Mail-/Passwort-Login einrichten; bestehende Passwoerter werden nur nach Pruefung des aktuellen Passworts ersetzt.

## Bekannte externe Voraussetzung

- Steam-Login bleibt deaktiviert, bis ein gueltiger Steam-API-Schluessel hinterlegt ist.
- Der Windows-Installer ist weiterhin nicht Authenticode-signiert, solange kein Publisher-Zertifikat bereitgestellt wurde.
