#!/bin/sh
set -e

echo "Running database migrations..."
alembic upgrade head

echo "Migrations complete. Starting Gunicorn..."
# Execute the main command (gunicorn)
# This ensures that the entrypoint script runs and then passes control to the CMD in the Dockerfile
exec "$@"