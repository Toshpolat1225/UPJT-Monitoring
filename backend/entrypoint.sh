#!/bin/sh
set -e

export PATH="/root/.local/bin:$PATH"

if command -v alembic >/dev/null 2>&1 && [ -f alembic.ini ]; then
	echo "Running database migrations..."
	alembic upgrade head
fi

echo "Starting API..."
# Execute the main command (gunicorn)
# This ensures that the entrypoint script runs and then passes control to the CMD in the Dockerfile
exec "$@"
