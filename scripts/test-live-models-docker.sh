#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
IMAGE_NAME="${THINKFLEETBOT_IMAGE:-thinkfleetbot:local}"
CONFIG_DIR="${THINKFLEETBOT_CONFIG_DIR:-$HOME/.thinkfleetbot}"
WORKSPACE_DIR="${THINKFLEETBOT_WORKSPACE_DIR:-$HOME/thinkfleet}"
PROFILE_FILE="${THINKFLEETBOT_PROFILE_FILE:-$HOME/.profile}"

PROFILE_MOUNT=()
if [[ -f "$PROFILE_FILE" ]]; then
  PROFILE_MOUNT=(-v "$PROFILE_FILE":/home/node/.profile:ro)
fi

echo "==> Build image: $IMAGE_NAME"
docker build -t "$IMAGE_NAME" -f "$ROOT_DIR/Dockerfile" "$ROOT_DIR"

echo "==> Run live model tests (profile keys)"
docker run --rm -t \
  --entrypoint bash \
  -e COREPACK_ENABLE_DOWNLOAD_PROMPT=0 \
  -e HOME=/home/node \
  -e NODE_OPTIONS=--disable-warning=ExperimentalWarning \
  -e THINKFLEETBOT_LIVE_TEST=1 \
  -e THINKFLEETBOT_LIVE_MODELS="${THINKFLEETBOT_LIVE_MODELS:-all}" \
  -e THINKFLEETBOT_LIVE_PROVIDERS="${THINKFLEETBOT_LIVE_PROVIDERS:-}" \
  -e THINKFLEETBOT_LIVE_MODEL_TIMEOUT_MS="${THINKFLEETBOT_LIVE_MODEL_TIMEOUT_MS:-}" \
  -e THINKFLEETBOT_LIVE_REQUIRE_PROFILE_KEYS="${THINKFLEETBOT_LIVE_REQUIRE_PROFILE_KEYS:-}" \
  -v "$CONFIG_DIR":/home/node/.thinkfleetbot \
  -v "$WORKSPACE_DIR":/home/node/thinkfleet \
  "${PROFILE_MOUNT[@]}" \
  "$IMAGE_NAME" \
  -lc "set -euo pipefail; [ -f \"$HOME/.profile\" ] && source \"$HOME/.profile\" || true; cd /app && pnpm test:live"
