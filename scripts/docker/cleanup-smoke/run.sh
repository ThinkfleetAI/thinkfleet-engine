#!/usr/bin/env bash
set -euo pipefail

cd /repo

export THINKFLEETBOT_STATE_DIR="/tmp/thinkfleetbot-test"
export THINKFLEETBOT_CONFIG_PATH="${THINKFLEETBOT_STATE_DIR}/thinkfleetbot.json"

echo "==> Seed state"
mkdir -p "${THINKFLEETBOT_STATE_DIR}/credentials"
mkdir -p "${THINKFLEETBOT_STATE_DIR}/agents/main/sessions"
echo '{}' >"${THINKFLEETBOT_CONFIG_PATH}"
echo 'creds' >"${THINKFLEETBOT_STATE_DIR}/credentials/marker.txt"
echo 'session' >"${THINKFLEETBOT_STATE_DIR}/agents/main/sessions/sessions.json"

echo "==> Reset (config+creds+sessions)"
pnpm thinkfleetbot reset --scope config+creds+sessions --yes --non-interactive

test ! -f "${THINKFLEETBOT_CONFIG_PATH}"
test ! -d "${THINKFLEETBOT_STATE_DIR}/credentials"
test ! -d "${THINKFLEETBOT_STATE_DIR}/agents/main/sessions"

echo "==> Recreate minimal config"
mkdir -p "${THINKFLEETBOT_STATE_DIR}/credentials"
echo '{}' >"${THINKFLEETBOT_CONFIG_PATH}"

echo "==> Uninstall (state only)"
pnpm thinkfleetbot uninstall --state --yes --non-interactive

test ! -d "${THINKFLEETBOT_STATE_DIR}"

echo "OK"
