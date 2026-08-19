# Datenbank-Katalog (Provisioniert durch databases/bootstrap.ps1)

- `vtc_platform` (Primary)  
- `vtc_platform_test` (Optional/Test)  
- Redis: `vtchub-redis` (Port `6379`, AOF aktiv, Persistenz aktiv)

## Verbindung (lokal)

- PostgreSQL (Main): `postgresql://<POSTGRES_USER>:<POSTGRES_PASSWORD>@127.0.0.1:<POSTGRES_PORT>/vtc_platform`
- PostgreSQL (Test): `postgresql://<POSTGRES_USER>:<POSTGRES_PASSWORD>@127.0.0.1:<POSTGRES_PORT>/vtc_platform_test`
- Redis: `127.0.0.1:<REDIS_PORT>`

## Provisionierungs-Befehl

```powershell
cd databases
.\bootstrap.ps1
```
