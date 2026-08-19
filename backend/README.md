# VTC Platform Backend (NestJS + Prisma)

Dieser Ordner enthält die produktionsnahe NestJS-API der VTC-Hub-Plattform.

## Module

- `auth`: lokaler Login, Google, Discord und Steam, HttpOnly-Websession, Desktop-PKCE und JWT.
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
2. `pnpm install --frozen-lockfile`
3. `pnpm run prisma:migrate:deploy`
4. `pnpm run start:dev`

## Sicherheitsvertrag des Desktop-Clients

Telemetrie-Endpunkte benötigen einen gültigen Benutzer-JWT. Der Request-Body wird zusätzlich mit demselben kurzlebigen JWT über HMAC-SHA256 signiert; Timestamp und Redis-Nonce verhindern Wiederholungen. Dadurch muss kein globales HMAC-Secret in einem öffentlichen Installer ausgeliefert werden.
