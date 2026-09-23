#!/bin/sh
set -eu
umask 077

ENCRYPTED_BACKUP_FILE="${1:-}"
if [ -z "${ENCRYPTED_BACKUP_FILE}" ]; then
  echo "Usage: RESTORE_DB_HOST=... RESTORE_DB_NAME=... ./restore.sh <backup.enc>" >&2
  exit 2
fi
: "${BACKUP_ENCRYPTION_KEY:?BACKUP_ENCRYPTION_KEY is required}"
: "${RESTORE_DB_HOST:?RESTORE_DB_HOST is required}"
: "${RESTORE_DB_PORT:=5432}"
: "${RESTORE_DB_USER:?RESTORE_DB_USER is required}"
: "${RESTORE_DB_PASSWORD:?RESTORE_DB_PASSWORD is required}"
: "${RESTORE_DB_NAME:?RESTORE_DB_NAME is required}"
: "${RESTORE_TARGET:=temporary}"

case "${RESTORE_DB_NAME}" in
  ''|*[!A-Za-z0-9_]* ) echo "Invalid RESTORE_DB_NAME" >&2; exit 2 ;;
esac
if [ "${RESTORE_TARGET}" = "production" ]; then
  [ "${ALLOW_PRODUCTION_RESTORE:-}" = "YES_I_UNDERSTAND" ] || { echo "Production restore requires ALLOW_PRODUCTION_RESTORE=YES_I_UNDERSTAND" >&2; exit 2; }
else
  [ "${RESTORE_DB_NAME}" != "${POSTGRES_DB:-}" ] || { echo "Refusing to restore into production database" >&2; exit 2; }
fi

BASE_NAME=$(basename "${ENCRYPTED_BACKUP_FILE%.enc}")
CHECKSUM_FILE="${ENCRYPTED_BACKUP_FILE%.enc}.sha256"
HMAC_FILE="${ENCRYPTED_BACKUP_FILE%.enc}.hmac"
TMP_DIR="$(mktemp -d /tmp/fuel-restore.XXXXXX)"
DECRYPTED_BACKUP_FILE="${TMP_DIR}/${BASE_NAME}"
cleanup() { rm -rf "${TMP_DIR}"; }
trap cleanup EXIT HUP INT TERM

[ -s "${ENCRYPTED_BACKUP_FILE}" ] || { echo "Encrypted backup missing or empty" >&2; exit 1; }
[ -s "${CHECKSUM_FILE}" ] || { echo "Checksum file missing" >&2; exit 1; }
[ -s "${HMAC_FILE}" ] || { echo "HMAC file missing" >&2; exit 1; }

EXPECTED_HMAC=$(tr -d '[:space:]' < "${HMAC_FILE}")
ACTUAL_HMAC=$(openssl dgst -sha256 -hmac "${BACKUP_ENCRYPTION_KEY}" "${ENCRYPTED_BACKUP_FILE}" | awk '{print $NF}')
[ "${EXPECTED_HMAC}" = "${ACTUAL_HMAC}" ] || { echo "Encrypted backup HMAC verification failed" >&2; exit 1; }
echo "HMAC verification: PASS"

openssl enc -d -aes-256-cbc -pbkdf2 -in "${ENCRYPTED_BACKUP_FILE}" -out "${DECRYPTED_BACKUP_FILE}" -pass env:BACKUP_ENCRYPTION_KEY
(cd "${TMP_DIR}" && sha256sum -c "${CHECKSUM_FILE}")
echo "Decrypted checksum verification: PASS"
pg_restore --list "${DECRYPTED_BACKUP_FILE}" >/dev/null
echo "Dump catalog validation: PASS"

export PGPASSWORD="${RESTORE_DB_PASSWORD}"
if [ "${RESTORE_TARGET}" = "production" ] || [ "${RESTORE_CREATE_DATABASE:-true}" = "true" ]; then
  psql -h "${RESTORE_DB_HOST}" -p "${RESTORE_DB_PORT}" -U "${RESTORE_DB_USER}" -d postgres -v ON_ERROR_STOP=1 \
    -c "DROP DATABASE IF EXISTS \"${RESTORE_DB_NAME}\" WITH (FORCE);" \
    -c "CREATE DATABASE \"${RESTORE_DB_NAME}\";"
fi
pg_restore -h "${RESTORE_DB_HOST}" -p "${RESTORE_DB_PORT}" -U "${RESTORE_DB_USER}" -d "${RESTORE_DB_NAME}" \
  --no-owner --no-privileges --single-transaction --exit-on-error "${DECRYPTED_BACKUP_FILE}"
echo "Restore target=${RESTORE_TARGET} database=${RESTORE_DB_NAME}: PASS"
