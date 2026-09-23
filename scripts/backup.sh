#!/bin/sh
set -eu
umask 077

BACKUP_DIR="${BACKUP_DIR:-/backups}"
DATE_FORMAT=$(date +"%Y-%m-%d_%H-%M-%S")
DUMP_FILENAME="fuel_db_${DATE_FORMAT}.dump"
DUMP_PATH="/tmp/${DUMP_FILENAME}"
ENCRYPTED_PATH="${BACKUP_DIR}/daily/${DUMP_FILENAME}.enc"
CHECKSUM_PATH="${BACKUP_DIR}/daily/${DUMP_FILENAME}.sha256"
HMAC_PATH="${BACKUP_DIR}/daily/${DUMP_FILENAME}.hmac"
META_PATH="${BACKUP_DIR}/daily/${DUMP_FILENAME}.meta"
LOG_PATH="${BACKUP_DIR}/backup.log"

log() { printf '%s %s\n' "$(date -Iseconds)" "$*" | tee -a "${LOG_PATH}"; }
fail() { log "FINAL FAILURE: $*"; rm -f "${DUMP_PATH}" "${ENCRYPTED_PATH}.tmp" "${CHECKSUM_PATH}.tmp" "${HMAC_PATH}.tmp" "${META_PATH}.tmp"; exit 1; }
trap 'fail "unexpected error at line ${LINENO}"' HUP INT TERM

: "${POSTGRES_HOST:=db}"
: "${POSTGRES_PORT:=5432}"
: "${POSTGRES_USER:?POSTGRES_USER is required}"
: "${POSTGRES_PASSWORD:?POSTGRES_PASSWORD is required}"
: "${POSTGRES_DB:?POSTGRES_DB is required}"
: "${BACKUP_ENCRYPTION_KEY:?BACKUP_ENCRYPTION_KEY is required}"

DAILY_RETENTION="${DAILY_RETENTION:-7}"
WEEKLY_RETENTION="${WEEKLY_RETENTION:-30}"
MONTHLY_RETENTION="${MONTHLY_RETENTION:-365}"

# --- Backup Execution ---
mkdir -p "${BACKUP_DIR}/daily" "${BACKUP_DIR}/weekly" "${BACKUP_DIR}/monthly" || fail "cannot create backup directories"
touch "${LOG_PATH}" || fail "backup storage is not writable"
export PGPASSWORD="${POSTGRES_PASSWORD}"

log "START database=${POSTGRES_DB} host=${POSTGRES_HOST} timestamp=${DATE_FORMAT}"
log "DUMP starting"
pg_dump -h "${POSTGRES_HOST}" -p "${POSTGRES_PORT}" -U "${POSTGRES_USER}" -d "${POSTGRES_DB}" -F c -Z 9 -f "${DUMP_PATH}" || fail "pg_dump failed"
[ -s "${DUMP_PATH}" ] || fail "pg_dump produced an empty file"
log "DUMP success size=$(wc -c < "${DUMP_PATH}")"

log "ENCRYPT starting"
openssl enc -aes-256-cbc -pbkdf2 -salt -in "${DUMP_PATH}" -out "${ENCRYPTED_PATH}.tmp" -pass env:BACKUP_ENCRYPTION_KEY || fail "encryption failed"
[ -s "${ENCRYPTED_PATH}.tmp" ] || fail "encrypted backup is empty"
mv "${ENCRYPTED_PATH}.tmp" "${ENCRYPTED_PATH}"
printf '%s  %s\n' "$(sha256sum "${DUMP_PATH}" | awk '{print $1}')" "${DUMP_FILENAME}" > "${CHECKSUM_PATH}.tmp" || fail "checksum failed"
mv "${CHECKSUM_PATH}.tmp" "${CHECKSUM_PATH}"
openssl dgst -sha256 -hmac "${BACKUP_ENCRYPTION_KEY}" "${ENCRYPTED_PATH}" | awk '{print $NF}' > "${HMAC_PATH}.tmp" || fail "HMAC failed"
mv "${HMAC_PATH}.tmp" "${HMAC_PATH}"
printf 'database=%s\ntimestamp=%s\ndump=%s\n' "${POSTGRES_DB}" "${DATE_FORMAT}" "${DUMP_FILENAME}" > "${META_PATH}.tmp"
mv "${META_PATH}.tmp" "${META_PATH}"
rm -f "${DUMP_PATH}"
log "ENCRYPT success artifact=${ENCRYPTED_PATH} checksum=${CHECKSUM_PATH} hmac=${HMAC_PATH}"

DAY_OF_WEEK=$(date +"%u") # 1=Monday, 7=Sunday
DAY_OF_MONTH=$(date +"%d") # 01-31

if [ "${DAY_OF_WEEK}" -eq 7 ]; then
  cp "${ENCRYPTED_PATH}" "${CHECKSUM_PATH}" "${HMAC_PATH}" "${META_PATH}" "${BACKUP_DIR}/weekly/" || fail "weekly rotation failed"
fi

if [ "${DAY_OF_MONTH}" -eq 1 ]; then
  cp "${ENCRYPTED_PATH}" "${CHECKSUM_PATH}" "${HMAC_PATH}" "${META_PATH}" "${BACKUP_DIR}/monthly/" || fail "monthly rotation failed"
fi

log "RETENTION daily=${DAILY_RETENTION}d weekly=${WEEKLY_RETENTION}d monthly=${MONTHLY_RETENTION}d"
for directory in daily weekly monthly; do
  case "${directory}" in
    daily) retention="${DAILY_RETENTION}" ;;
    weekly) retention="${WEEKLY_RETENTION}" ;;
    monthly) retention="${MONTHLY_RETENTION}" ;;
  esac
  find "${BACKUP_DIR}/${directory}" -type f -mtime "+${retention}" \( -name '*.enc' -o -name '*.sha256' -o -name '*.hmac' -o -name '*.meta' \) -print -delete >> "${LOG_PATH}" || fail "retention failed for ${directory}"
done
log "FINAL SUCCESS backup=${ENCRYPTED_PATH}"