#!/bin/bash
# dev-install: Install apt packages and record them for persistence across restarts.
#
# Usage: dev-install <package1> [package2] ...
#
# Packages are installed via apt-get and added to a manifest file on the PVC.
# On pod restart, the init container reads this manifest and replays the install
# so packages survive across restarts automatically.
#
# Manifest: ~/.thinkfleet/dev-packages.json
set -euo pipefail

MANIFEST="${HOME}/.thinkfleet/dev-packages.json"

if [ $# -eq 0 ]; then
  echo "Usage: dev-install <package1> [package2] ..."
  echo ""
  echo "Installs apt packages and records them for persistence across restarts."
  echo ""
  if [ -f "$MANIFEST" ]; then
    echo "Currently tracked packages:"
    jq -r '.apt // [] | .[]' "$MANIFEST" 2>/dev/null || echo "  (none)"
  fi
  exit 1
fi

# Check available disk space (need at least 100MB)
AVAIL=$(df -BM --output=avail "${HOME}/.thinkfleet" 2>/dev/null | tail -1 | tr -d ' M' || echo "999")
if [ "$AVAIL" -lt 100 ] 2>/dev/null; then
  echo "[dev-install] ERROR: Less than 100MB free on storage volume. Cannot install packages."
  echo "[dev-install] Current available: ${AVAIL}MB"
  exit 1
fi

# Install the packages
echo "[dev-install] Installing: $*"
sudo apt-get update -qq
sudo DEBIAN_FRONTEND=noninteractive apt-get install -y --no-install-recommends "$@"
sudo apt-get clean
sudo rm -rf /var/lib/apt/lists/*

# Ensure manifest directory exists
mkdir -p "$(dirname "$MANIFEST")"

# Initialize manifest if it doesn't exist
if [ ! -f "$MANIFEST" ]; then
  echo '{"apt":[],"pip":[],"npm":[]}' > "$MANIFEST"
fi

# Add each package to the manifest (dedup)
for pkg in "$@"; do
  EXISTING=$(jq -r --arg p "$pkg" '.apt // [] | index($p)' "$MANIFEST" 2>/dev/null)
  if [ "$EXISTING" = "null" ] || [ -z "$EXISTING" ]; then
    jq --arg p "$pkg" '.apt = (.apt // []) + [$p]' "$MANIFEST" > "${MANIFEST}.tmp" && mv "${MANIFEST}.tmp" "$MANIFEST"
    echo "[dev-install] Added '$pkg' to persistent manifest"
  else
    echo "[dev-install] '$pkg' already in manifest"
  fi
done

echo "[dev-install] Done. Packages will persist across restarts."
