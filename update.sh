#!/usr/bin/env bash
#
# update.sh — deploy updates to the production noticeboard
#
# Steps:
#   1. git pull (aborts if there are local changes or pull fails)
#   2. back up the database to .backups/ (timestamped copy)
#   3. docker compose down
#   4. docker compose up -d --build
#
set -euo pipefail
cd "$(dirname "$0")"

DB_PATH="data/noticeboard.db"
BACKUP_DIR=".backups"

echo "==> 1/4 Pulling latest code..."
if ! git diff --quiet || ! git diff --cached --quiet; then
  echo "ERROR: You have uncommitted local changes. Commit or stash them first." >&2
  exit 1
fi
git pull --ff-only

echo "==> 2/4 Backing up database..."
if [ -f "$DB_PATH" ]; then
  mkdir -p "$BACKUP_DIR"
  STAMP="$(date +%Y-%m-%d_%H-%M-%S)"
  cp "$DB_PATH" "$BACKUP_DIR/noticeboard_${STAMP}.db"
  echo "    Saved $BACKUP_DIR/noticeboard_${STAMP}.db"
  # Keep the 10 most recent update backups
  ls -1t "$BACKUP_DIR"/noticeboard_*.db 2>/dev/null | tail -n +11 | xargs -r rm --
else
  echo "    WARNING: $DB_PATH not found — skipping backup"
fi

echo "==> 3/4 Stopping containers..."
docker compose down

echo "==> 4/4 Building and starting..."
docker compose up -d --build

echo "==> Update complete. Watching startup:"
docker compose logs -f --tail 50 noticeboard-app 2>/dev/null || docker compose logs --tail 50
