#!/bin/sh
set -e

echo "--- Backup Job Started: $(date) ---"

# Export password for pg_dump execution
export PGPASSWORD="${POSTGRES_PASSWORD}"

BACKUP_DIR="/backups"
DATE_FORMAT=$(date +"%Y-%m-%d_%H-%M-%S")

# --- Retention Policy (in days) ---
DAILY_RETENTION=7
WEEKLY_RETENTION=30
MONTHLY_RETENTION=365

# --- Backup Execution ---
mkdir -p ${BACKUP_DIR}/daily ${BACKUP_DIR}/weekly ${BACKUP_DIR}/monthly

DUMP_FILENAME="backup_${DATE_FORMAT}.dump"
DUMP_PATH="/tmp/${DUMP_FILENAME}"
ENCRYPTED_PATH="${BACKUP_DIR}/daily/${DUMP_FILENAME}.enc"
CHECKSUM_PATH="${BACKUP_DIR}/daily/${DUMP_FILENAME}.sha256"

echo "1. Starting database dump to custom-format file..."
pg_dump -h db -U "${POSTGRES_USER}" -d "${POSTGRES_DB}" -F c -Z 9 -f "${DUMP_PATH}"

echo "2. Generating SHA256 checksum for integrity verification..."
sha256sum "${DUMP_PATH}" > "${CHECKSUM_PATH}"

echo "3. Encrypting dump with AES-256..."
openssl enc -aes-256-cbc -pbkdf2 -salt -in "${DUMP_PATH}" -out "${ENCRYPTED_PATH}" -k "${BACKUP_ENCRYPTION_KEY}"
rm -f "${DUMP_PATH}"

echo "Backup created: ${ENCRYPTED_PATH}"

# --- Rotation and Retention ---
DAY_OF_WEEK=$(date +"%u") # 1=Monday, 7=Sunday
DAY_OF_MONTH=$(date +"%d") # 01-31

if [ "${DAY_OF_WEEK}" -eq 7 ]; then
  echo "4. Rotating to weekly backup..."
  cp "${ENCRYPTED_PATH}" "${BACKUP_DIR}/weekly/"
  cp "${CHECKSUM_PATH}" "${BACKUP_DIR}/weekly/"
fi

if [ "${DAY_OF_MONTH}" -eq 1 ]; then
  echo "5. Rotating to monthly backup..."
  cp "${ENCRYPTED_PATH}" "${BACKUP_DIR}/monthly/"
  cp "${CHECKSUM_PATH}" "${BACKUP_DIR}/monthly/"
fi

echo "6. Applying retention policy..."
find "${BACKUP_DIR}/daily" -type f -mtime +${DAILY_RETENTION} -name '*.enc' -delete
find "${BACKUP_DIR}/daily" -type f -mtime +${DAILY_RETENTION} -name '*.sha256' -delete
find "${BACKUP_DIR}/weekly" -type f -mtime +${WEEKLY_RETENTION} -name '*.enc' -delete
find "${BACKUP_DIR}/weekly" -type f -mtime +${WEEKLY_RETENTION} -name '*.sha256' -delete
find "${BACKUP_DIR}/monthly" -type f -mtime +${MONTHLY_RETENTION} -name '*.enc' -delete
find "${BACKUP_DIR}/monthly" -type f -mtime +${MONTHLY_RETENTION} -name '*.sha256' -delete

echo "--- Backup Job Finished Successfully: $(date) ---"