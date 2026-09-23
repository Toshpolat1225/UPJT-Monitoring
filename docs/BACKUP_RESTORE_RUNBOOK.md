# Backup and Restore Runbook

## Storage and schedule

- Encrypted backups: `/srv/apps/fuel/backups/daily/`
- Weekly copies: `/srv/apps/fuel/backups/weekly/`
- Monthly copies: `/srv/apps/fuel/backups/monthly/`
- Backup log: `/srv/apps/fuel/backups/backup.log`
- Scheduler: `upjt_backup_prod` cron, daily at `02:30` server time
- Retention: daily 7 days, weekly 30 days, monthly 365 days
- Off-host backup: not configured on this server; copy encrypted artifacts to separate storage.

Each backup has `.enc`, `.sha256`, `.hmac`, and `.meta` files. The checksum covers the decrypted dump; the HMAC covers the encrypted artifact.

## Manual backup

Run from `/srv/apps/fuel`:

```sh
docker exec upjt_backup_prod /usr/local/bin/backup.sh
```

Do not put secrets on the command line. The container receives them from the production environment.

## Verify a backup

Use the restore script in temporary mode. It requires a separate PostgreSQL target and refuses the production database by default:

```sh
RESTORE_TARGET=temporary \
RESTORE_DB_HOST=<temporary-db-host> \
RESTORE_DB_PORT=5432 \
RESTORE_DB_USER=<temporary-db-user> \
RESTORE_DB_PASSWORD=<temporary-db-password> \
RESTORE_DB_NAME=fuel_restore_test \
BACKUP_ENCRYPTION_KEY=<secret-from-secret-store> \
./scripts/restore.sh /backups/daily/<backup>.dump.enc
```

The command verifies HMAC, decrypts, verifies the decrypted SHA256 checksum, validates the dump catalog, and restores inside one transaction.

## Restore test

Create a temporary PostgreSQL container/database on an isolated Docker network. Never point a normal restore test at `sttb_monitoring`. Validate `current_database()`, `information_schema.tables`, and representative row counts after restore.

## Production recovery

Production restore is intentionally blocked unless all of the following are explicit:

```text
RESTORE_TARGET=production
ALLOW_PRODUCTION_RESTORE=YES_I_UNDERSTAND
```

Before production recovery, stop application writes, confirm the backup filename and timestamp with the incident owner, verify HMAC/checksum, and record the approval. Use the production DB credentials only from the secret store.

## Failure monitoring

Check container logs and the backup log:

```sh
docker logs upjt_backup_prod
sed -n '1,200p' backups/backup.log
```

A successful run ends with `FINAL SUCCESS`. A failed run ends with `FINAL FAILURE` and returns a non-zero exit code. Passwords, encryption keys, and JWT secrets are never written to the log.
