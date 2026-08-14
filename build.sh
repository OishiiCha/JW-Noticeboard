#!/usr/bin/env bash
set -euo pipefail

# ─────────────────────────────────────────────────────────────
# Noticeboard App — Docker Buildx Build Script
# Uses buildx with GitHub Actions cache for faster rebuilds.
# ─────────────────────────────────────────────────────────────

IMAGE_NAME="${IMAGE_NAME:-noticeboard-app}"
IMAGE_TAG="${IMAGE_TAG:-latest}"
PLATFORM="${PLATFORM:-}"           # e.g. linux/amd64, linux/arm64, or empty for native
PUSH="${PUSH:-false}"              # set to true to push to a registry
LOAD="${LOAD:-true}"               # set to false to skip loading into docker (needed for multi-platform)

# Determine platform flag
PLATFORM_FLAG=""
if [ -n "$PLATFORM" ]; then
  PLATFORM_FLAG="--platform $PLATFORM"
  # Multi-platform or push builds can't use --load
  if echo "$PLATFORM" | grep -q ","; then
    LOAD="false"
  fi
fi

# Determine load flag (only for single-platform builds)
LOAD_FLAG=""
if [ "$LOAD" = "true" ] && [ "$PUSH" = "false" ]; then
  LOAD_FLAG="--load"
fi

# Determine push flag
PUSH_FLAG=""
if [ "$PUSH" = "true" ]; then
  PUSH_FLAG="--push"
fi

# GHA cache flags (works in GitHub Actions; falls back gracefully elsewhere)
CACHE_FLAGS="--cache-from type=gha --cache-to type=gha,mode=max"

echo "Building ${IMAGE_NAME}:${IMAGE_TAG}"
echo "  Platform: ${PLATFORM:-native}"
echo "  Push:     ${PUSH}"
echo "  Load:     ${LOAD}"
echo ""

docker buildx build \
  $PLATFORM_FLAG \
  $LOAD_FLAG \
  $PUSH_FLAG \
  $CACHE_FLAGS \
  -t "${IMAGE_NAME}:${IMAGE_TAG}" \
  -f Dockerfile \
  .

echo ""
echo "Done! Built ${IMAGE_NAME}:${IMAGE_TAG}"
