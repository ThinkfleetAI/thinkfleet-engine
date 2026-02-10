#!/usr/bin/env bash
set -euo pipefail

INSTALL_URL="${THINKFLEETBOT_INSTALL_URL:-https://thinkfleet.dev/install.sh}"
SMOKE_PREVIOUS_VERSION="${THINKFLEETBOT_INSTALL_SMOKE_PREVIOUS:-}"
SKIP_PREVIOUS="${THINKFLEETBOT_INSTALL_SMOKE_SKIP_PREVIOUS:-0}"
DEFAULT_PACKAGE="thinkfleet"
if [[ -z "${THINKFLEETBOT_INSTALL_PACKAGE:-}" && "$INSTALL_URL" == *"thinkfleet.dev"* ]]; then
  DEFAULT_PACKAGE="thinkfleet"
fi
PACKAGE_NAME="${THINKFLEETBOT_INSTALL_PACKAGE:-$DEFAULT_PACKAGE}"
if [[ "$PACKAGE_NAME" == "thinkfleet" ]]; then
  ALT_PACKAGE_NAME="thinkfleet"
else
  ALT_PACKAGE_NAME="thinkfleet"
fi

echo "==> Resolve npm versions"
LATEST_VERSION="$(npm view "$PACKAGE_NAME" version 2>/dev/null || true)"
if [[ -z "$LATEST_VERSION" ]]; then
  echo "WARN: $PACKAGE_NAME not found on npm registry — skipping version checks"
fi
PREVIOUS_VERSION=""
if [[ -n "$LATEST_VERSION" ]]; then
  if [[ -n "$SMOKE_PREVIOUS_VERSION" ]]; then
    PREVIOUS_VERSION="$SMOKE_PREVIOUS_VERSION"
  else
    VERSIONS_JSON="$(npm view "$PACKAGE_NAME" versions --json 2>/dev/null || echo "[]")"
    PREVIOUS_VERSION="$(VERSIONS_JSON="$VERSIONS_JSON" LATEST_VERSION="$LATEST_VERSION" node - <<'NODE'
const raw = process.env.VERSIONS_JSON || "[]";
const latest = process.env.LATEST_VERSION || "";
let versions;
try {
  versions = JSON.parse(raw);
} catch {
  versions = raw ? [raw] : [];
}
if (!Array.isArray(versions)) {
  versions = [versions];
}
if (versions.length === 0) {
  process.exit(1);
}
const latestIndex = latest ? versions.lastIndexOf(latest) : -1;
if (latestIndex > 0) {
  process.stdout.write(String(versions[latestIndex - 1]));
  process.exit(0);
}
process.stdout.write(String(latest || versions[versions.length - 1]));
NODE
  )" || true
  fi
fi

echo "package=$PACKAGE_NAME latest=${LATEST_VERSION:-<not published>} previous=${PREVIOUS_VERSION:-<none>}"

if [[ "$SKIP_PREVIOUS" == "1" || -z "$LATEST_VERSION" ]]; then
  echo "==> Skip preinstall previous (${SKIP_PREVIOUS:+THINKFLEETBOT_INSTALL_SMOKE_SKIP_PREVIOUS=1}${LATEST_VERSION:- package not on npm})"
else
  echo "==> Preinstall previous (forces installer upgrade path)"
  npm install -g "${PACKAGE_NAME}@${PREVIOUS_VERSION}"
fi

echo "==> Run official installer one-liner"
curl -fsSL "$INSTALL_URL" | bash

echo "==> Verify installed version"
CLI_NAME="$PACKAGE_NAME"
if ! command -v "$CLI_NAME" >/dev/null 2>&1; then
  if command -v "$ALT_PACKAGE_NAME" >/dev/null 2>&1; then
    CLI_NAME="$ALT_PACKAGE_NAME"
    LATEST_VERSION="$(npm view "$CLI_NAME" version 2>/dev/null || true)"
    echo "==> Detected alternate CLI: $CLI_NAME"
  else
    echo "ERROR: neither $PACKAGE_NAME nor $ALT_PACKAGE_NAME is on PATH" >&2
    exit 1
  fi
fi
if [[ -n "${THINKFLEETBOT_INSTALL_LATEST_OUT:-}" ]]; then
  printf "%s" "$LATEST_VERSION" > "$THINKFLEETBOT_INSTALL_LATEST_OUT"
fi
INSTALLED_VERSION="$("$CLI_NAME" --version 2>/dev/null | head -n 1 | tr -d '\r')"
echo "cli=$CLI_NAME installed=$INSTALLED_VERSION expected=${LATEST_VERSION:-<not published>}"

if [[ -z "$LATEST_VERSION" ]]; then
  echo "WARN: skipping version comparison — package not on npm"
elif [[ "$INSTALLED_VERSION" != "$LATEST_VERSION" ]]; then
  echo "ERROR: expected ${CLI_NAME}@${LATEST_VERSION}, got ${CLI_NAME}@${INSTALLED_VERSION}" >&2
  exit 1
fi

echo "==> Sanity: CLI runs"
"$CLI_NAME" --help >/dev/null

echo "OK"
