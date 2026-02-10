#!/bin/sh
set -e

echo "Starting Tattoo Map API..."

# Run migrations if RUN_MIGRATIONS is set to 'true'
if [ "$RUN_MIGRATIONS" = "true" ]; then
  echo "RUN_MIGRATIONS=true → Applying database migrations..."
  npx -y prisma migrate deploy
  if [ $? -eq 0 ]; then
    echo "✓ Migrations applied successfully"
  else
    echo "✗ Migration failed with exit code $?"
    exit 1
  fi
else
  echo "RUN_MIGRATIONS not set → Skipping migrations"
fi

# Execute the main command (node dist/src/main.js)
exec "$@"
