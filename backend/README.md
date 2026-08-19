# VTC Platform Backend (NestJS + Prisma)

Dieser Ordner enthält den initialen Backend-Kern für die Plattform nach deinem Lastenheft.

## Module

- `auth`: Steam-Login/Callback, später JWT-Session.
- `user`: Nutzerprofil, Rollen, Statistiken/Awards-Ansicht.
- `company`: VTC-Gründung, Mitgliedschaften, Wall, Bewerbungen.
- `logbook`: Telemetrie-Ingestion, Fahrtenklassifizierung (Real/Race/Invalid), Trip-Details.
- `dispatch`: eigene Jobs, Unternehmensjobs, Zuweisungen.
- `map`: Live-Position, Konvois, Map-Daten.
- `stats`: Leaderboards/Ranking.

## Prisma

Das Datenbankschema steht in:

- `prisma/schema.prisma`

Wichtige Entitäten:

- `User`, `SteamAccount`
- `Company`, `CompanyMembership`, `CompanyJoinRequest`
- `CompanyPost`, `CompanyPostComment`
- `DispatchJob`
- `TripRecord`, `TelemetryPoint`, `RouteTrack`
- `LivePosition`, `Convoy`, `ConvoyParticipant`
- `Award`, `UserAward`
- `LeaderboardSnapshot`
- `TelemetryIngestionAudit`

## Start

1. `.env.example` nach `.env` kopieren.
2. `npm install`
3. `npm run prisma:migrate` (oder manuell Migrationen anlegen)
4. `npm run start:dev`

## Nächste konkrete Schritte

1. Auth-Flow mit Steam OpenID + Steam Web API anschließen.
2. Logik: Trip-Validierung + Real/Race/Invalid-Klassifikation nach ETS2/ATS Limits.
3. WebSocket-Kanäle für Live-Map und Dispatch-Events.
