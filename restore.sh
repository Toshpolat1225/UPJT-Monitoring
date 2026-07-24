#!/bin/sh
set -e

ENCRYPTED_BACKUP_FILE=$1

if [ -z "${ENCRYPTED_BACKUP_FILE}" ]; then
  echo "Usage: ./restore.sh <path_to_encrypted_backup.enc>"
  exit 1
fi

if [ -z "${BACKUP_ENCRYPTION_KEY}" ]; then
    echo "Error: BACKUP_ENCRYPTION_KEY environment variable is not set."
    exit 1
fi

CHECKSUM_FILE="${ENCRYPTED_BACKUP_FILE%.enc}.sha256"
DECRYPTED_BACKUP_FILE="/tmp/decrypted_backup.dump"

export PGPASSWORD="${POSTGRES_PASSWORD}"

echo "1. Decrypting backup file..."
openssl enc -d -aes-256-cbc -pbkdf2 -in "${ENCRYPTED_BACKUP_FILE}" -out "${DECRYPTED_BACKUP_FILE}" -k "${BACKUP_ENCRYPTION_KEY}"

if [ ! -f "${CHECKSUM_FILE}" ]; then
    echo "Warning: Checksum file ${CHECKSUM_FILE} not found. Skipping integrity check."
else
    echo "2. Verifying backup integrity with SHA256 checksum..."
    sha256sum -c "${CHECKSUM_FILE}" --ignore-missing
fi

echo "3. Terminating active database connections to '${POSTGRES_DB}'..."
psql -h db -U "${POSTGRES_USER}" -d postgres -c "SELECT pg_terminate_backend(pid) FROM pg_stat_activity WHERE datname = '${POSTGRES_DB}' AND pid <> pg_backend_pid();" || true

echo "4. Re-creating target database..."
psql -h db -U "${POSTGRES_USER}" -d postgres -c "DROP DATABASE IF EXISTS ${POSTGRES_DB} WITH (FORCE);"
psql -h db -U "${POSTGRES_USER}" -d postgres -c "CREATE DATABASE ${POSTGRES_DB};"

echo "5. Restoring logical dump into the new database..."
# pg_restore for a custom-format dump connects to an existing, empty database
# and populates it. It does not operate on the PGDATA directory level.
pg_restore -h db -U "${POSTGRES_USER}" -d "${POSTGRES_DB}" \
  --no-owner \
  --no-privileges \
  --single-transaction \
  --exit-on-error \
  "${DECRYPTED_BACKUP_FILE}" || {
    echo "FATAL: pg_restore failed. The database is likely empty but clean due to single-transaction mode."
    rm -f "${DECRYPTED_BACKUP_FILE}"
    exit 1
}

rm -f "${DECRYPTED_BACKUP_FILE}"
echo "Restore operation completed successfully!"