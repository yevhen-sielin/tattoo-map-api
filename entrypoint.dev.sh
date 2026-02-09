#!/usr/bin/env sh
set -eu

# --- Simple log helper ---
log() { printf "\033[1;34m[backend]\033[0m %s\n" "$*"; }


echo "[entrypoint] node: $(node -v)  pnpm: $(pnpm -v)"
echo "[entrypoint] CWD: $(pwd)"

# Confirm Prisma URLs are set (values masked for security)
echo "[entrypoint] DATABASE_URL=${DATABASE_URL:+set (masked)}"
echo "[entrypoint] DIRECT_URL=${DIRECT_URL:+set (masked)}"


# --- Optional: wait for Postgres if needed ---
if [ -n "${DATABASE_URL:-}" ]; then
  log "DATABASE_URL is set → assuming DB is reachable inside compose network"
fi

# Install deps once inside the container (safe for bind mounts)
if [ ! -d node_modules ] || [ -z "$(ls -A node_modules 2>/dev/null || true)" ]; then
  log "Installing dependencies (pnpm) ..."
  corepack enable >/dev/null 2>&1 || true
  pnpm install --prefer-offline
fi

# Generate Prisma client
log "prisma generate"
pnpm prisma generate

# Apply migrations if present, then always ensure schema is in sync (dev only)
log "prisma migrate deploy"
pnpm prisma migrate deploy || true
log "prisma db push (ensure dev schema sync)"
pnpm prisma db push

# Start Nest in dev mode
log "start:dev"
exec pnpm run start:dev