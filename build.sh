#!/usr/bin/env bash
set -euo pipefail

# ─────────────────────────────────────────────────────────────
# Noticeboard App — Docker Compose Build Script
# Runs `docker compose build` to build the app image.
# ─────────────────────────────────────────────────────────────

echo "Building noticeboard-app with docker compose build..."

docker compose build --no-cache

echo ""
echo "Done! Start with: docker compose up -d"
