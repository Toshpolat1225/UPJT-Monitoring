# Disaster Recovery (DR) Runbook

This document provides procedures for recovering the UPJT-Monitoring system from data loss or corruption.

## 1. DR Targets

- **Recovery Time Objective (RTO):** `< 30 minutes`. The time from disaster declaration to system restoration.
- **Recovery Point Objective (RPO):** `< 5 minutes`. The maximum acceptable amount of data loss, measured in time.

## 2. Backup Strategy

- **Logical Backups:** A full logical backup of the database is created using `pg_dump` **every day at 02:30 AM**. These are stored locally in `/backups` and are encrypted with AES-256.
- **Physical Backups (WAL Archiving):** PostgreSQL's Write-Ahead Logs (WAL) are continuously archived. This is the foundation for Point-in-Time Recovery (PITR).

---

## 3. Scenario A: Logical Restore (Full Database Recovery)

**Use Case:** The database is corrupted, or a major data deletion event has occurred, and you need to restore the entire database to the state of the last successful daily backup.

**Procedure:**

1.  **Declare an Outage & Identify Backup File:** Announce a maintenance window. Identify the latest valid encrypted backup file (e.g., `backups/daily/backup_2026-07-25_02-30-00.dump.enc`).

2.  **Execute Restore Script:** Run the `restore.sh` script from the host machine, providing the path to the backup file. This script automates the entire process.
    ```bash
    # Ensure you are in the project's root directory
    ./scripts/restore.sh backups/daily/backup_2026-07-25_02-30-00.dump.enc
    ```

    *The script will automatically:*
    - Decrypt the backup.
    - Verify its checksum.
    - Terminate active connections to the database.
    - Drop and recreate the database.
    - Restore the data using `pg_restore` in a single transaction.

3.  **Verify System Health:** Once the script completes, check the logs of the `backend` and `db` containers. Perform a smoke test by logging into the application.

4.  **End Maintenance Window:** Announce that the system is back online.

---

## 4. Scenario B: Point-in-Time Recovery (PITR)

**Use Case:** A critical error (e.g., accidental deletion of a specific table's data) occurred at a known time, and you need to restore the database to the state *just before* that event.

**Procedure:**

1.  **Declare an Outage & Identify Target Time:** Determine the exact timestamp to recover to (e.g., `"2026-07-25 14:15:00 UTC"`).

2.  **Stop All Application Services:** This is critical to prevent new writes to the database.
    ```bash
    docker compose -f docker-compose.prod.yml stop backend nginx
    ```

3.  **Execute Restore Script with PITR Target:** Run the `restore.sh` script, providing both the latest base backup and the target timestamp as arguments.
    ```bash
    # The timestamp MUST be in quotes
    ./scripts/restore.sh backups/daily/backup_2026-07-25_02-30-00.dump.enc "2026-07-25 14:15:00 UTC"
    ```

4.  **Follow Script Prompts:** The script will guide you to stop and start the `db` container.
    - **Stop the DB container:** `docker compose -f docker-compose.prod.yml stop db`
    - The script will then restore the base backup and configure recovery settings.
    - **Start the DB container:** `docker compose -f docker-compose.prod.yml start db`

5.  **Monitor Recovery:** The PostgreSQL container will now start in recovery mode. It will replay WAL files from the archive until it reaches the specified target time. Monitor its logs:
    ```bash
    docker compose -f docker-compose.prod.yml logs -f db
    ```
    Look for a message like `recovery stopping at restore point`. Once you see `database system is ready to accept connections`, the recovery is complete.

6.  **Restart Application Services & Verify:**
    ```bash
    docker compose -f docker-compose.prod.yml start backend nginx
    ```
    Log in and verify that the data has been restored to the correct state.