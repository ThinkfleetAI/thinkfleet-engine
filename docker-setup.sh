#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
COMPOSE_FILE="$ROOT_DIR/docker-compose.yml"
EXTRA_COMPOSE_FILE="$ROOT_DIR/docker-compose.extra.yml"
IMAGE_NAME="${THINKFLEETBOT_IMAGE:-thinkfleetbot:local}"
EXTRA_MOUNTS="${THINKFLEETBOT_EXTRA_MOUNTS:-}"
HOME_VOLUME_NAME="${THINKFLEETBOT_HOME_VOLUME:-}"

require_cmd() {
  if ! command -v "$1" >/dev/null 2>&1; then
    echo "Missing dependency: $1" >&2
    exit 1
  fi
}

require_cmd docker
if ! docker compose version >/dev/null 2>&1; then
  echo "Docker Compose not available (try: docker compose version)" >&2
  exit 1
fi

mkdir -p "${THINKFLEETBOT_CONFIG_DIR:-$HOME/.thinkfleetbot}"
mkdir -p "${THINKFLEETBOT_WORKSPACE_DIR:-$HOME/thinkfleet}"

export THINKFLEETBOT_CONFIG_DIR="${THINKFLEETBOT_CONFIG_DIR:-$HOME/.thinkfleetbot}"
export THINKFLEETBOT_WORKSPACE_DIR="${THINKFLEETBOT_WORKSPACE_DIR:-$HOME/thinkfleet}"
export THINKFLEETBOT_GATEWAY_PORT="${THINKFLEETBOT_GATEWAY_PORT:-18789}"
export THINKFLEETBOT_BRIDGE_PORT="${THINKFLEETBOT_BRIDGE_PORT:-18790}"
export THINKFLEETBOT_GATEWAY_BIND="${THINKFLEETBOT_GATEWAY_BIND:-lan}"
export THINKFLEETBOT_IMAGE="$IMAGE_NAME"
export THINKFLEETBOT_DOCKER_APT_PACKAGES="${THINKFLEETBOT_DOCKER_APT_PACKAGES:-}"

if [[ -z "${THINKFLEETBOT_GATEWAY_TOKEN:-}" ]]; then
  if command -v openssl >/dev/null 2>&1; then
    THINKFLEETBOT_GATEWAY_TOKEN="$(openssl rand -hex 32)"
  else
    THINKFLEETBOT_GATEWAY_TOKEN="$(python3 - <<'PY'
import secrets
print(secrets.token_hex(32))
PY
)"
  fi
fi
export THINKFLEETBOT_GATEWAY_TOKEN

COMPOSE_FILES=("$COMPOSE_FILE")
COMPOSE_ARGS=()

write_extra_compose() {
  local home_volume="$1"
  shift
  local -a mounts=("$@")
  local mount

  cat >"$EXTRA_COMPOSE_FILE" <<'YAML'
services:
  thinkfleetbot-gateway:
    volumes:
YAML

  if [[ -n "$home_volume" ]]; then
    printf '      - %s:/home/node\n' "$home_volume" >>"$EXTRA_COMPOSE_FILE"
    printf '      - %s:/home/node/.thinkfleetbot\n' "$THINKFLEETBOT_CONFIG_DIR" >>"$EXTRA_COMPOSE_FILE"
    printf '      - %s:/home/node/thinkfleet\n' "$THINKFLEETBOT_WORKSPACE_DIR" >>"$EXTRA_COMPOSE_FILE"
  fi

  for mount in "${mounts[@]}"; do
    printf '      - %s\n' "$mount" >>"$EXTRA_COMPOSE_FILE"
  done

  cat >>"$EXTRA_COMPOSE_FILE" <<'YAML'
  thinkfleetbot-cli:
    volumes:
YAML

  if [[ -n "$home_volume" ]]; then
    printf '      - %s:/home/node\n' "$home_volume" >>"$EXTRA_COMPOSE_FILE"
    printf '      - %s:/home/node/.thinkfleetbot\n' "$THINKFLEETBOT_CONFIG_DIR" >>"$EXTRA_COMPOSE_FILE"
    printf '      - %s:/home/node/thinkfleet\n' "$THINKFLEETBOT_WORKSPACE_DIR" >>"$EXTRA_COMPOSE_FILE"
  fi

  for mount in "${mounts[@]}"; do
    printf '      - %s\n' "$mount" >>"$EXTRA_COMPOSE_FILE"
  done

  if [[ -n "$home_volume" && "$home_volume" != *"/"* ]]; then
    cat >>"$EXTRA_COMPOSE_FILE" <<YAML
volumes:
  ${home_volume}:
YAML
  fi
}

VALID_MOUNTS=()
if [[ -n "$EXTRA_MOUNTS" ]]; then
  IFS=',' read -r -a mounts <<<"$EXTRA_MOUNTS"
  for mount in "${mounts[@]}"; do
    mount="${mount#"${mount%%[![:space:]]*}"}"
    mount="${mount%"${mount##*[![:space:]]}"}"
    if [[ -n "$mount" ]]; then
      VALID_MOUNTS+=("$mount")
    fi
  done
fi

if [[ -n "$HOME_VOLUME_NAME" || ${#VALID_MOUNTS[@]} -gt 0 ]]; then
  write_extra_compose "$HOME_VOLUME_NAME" "${VALID_MOUNTS[@]}"
  COMPOSE_FILES+=("$EXTRA_COMPOSE_FILE")
fi
for compose_file in "${COMPOSE_FILES[@]}"; do
  COMPOSE_ARGS+=("-f" "$compose_file")
done
COMPOSE_HINT="docker compose"
for compose_file in "${COMPOSE_FILES[@]}"; do
  COMPOSE_HINT+=" -f ${compose_file}"
done

ENV_FILE="$ROOT_DIR/.env"
upsert_env() {
  local file="$1"
  shift
  local -a keys=("$@")
  local tmp
  tmp="$(mktemp)"
  declare -A seen=()

  if [[ -f "$file" ]]; then
    while IFS= read -r line || [[ -n "$line" ]]; do
      local key="${line%%=*}"
      local replaced=false
      for k in "${keys[@]}"; do
        if [[ "$key" == "$k" ]]; then
          printf '%s=%s\n' "$k" "${!k-}" >>"$tmp"
          seen["$k"]=1
          replaced=true
          break
        fi
      done
      if [[ "$replaced" == false ]]; then
        printf '%s\n' "$line" >>"$tmp"
      fi
    done <"$file"
  fi

  for k in "${keys[@]}"; do
    if [[ -z "${seen[$k]:-}" ]]; then
      printf '%s=%s\n' "$k" "${!k-}" >>"$tmp"
    fi
  done

  mv "$tmp" "$file"
}

upsert_env "$ENV_FILE" \
  THINKFLEETBOT_CONFIG_DIR \
  THINKFLEETBOT_WORKSPACE_DIR \
  THINKFLEETBOT_GATEWAY_PORT \
  THINKFLEETBOT_BRIDGE_PORT \
  THINKFLEETBOT_GATEWAY_BIND \
  THINKFLEETBOT_GATEWAY_TOKEN \
  THINKFLEETBOT_IMAGE \
  THINKFLEETBOT_EXTRA_MOUNTS \
  THINKFLEETBOT_HOME_VOLUME \
  THINKFLEETBOT_DOCKER_APT_PACKAGES

echo "==> Building Docker image: $IMAGE_NAME"
docker build \
  --build-arg "THINKFLEETBOT_DOCKER_APT_PACKAGES=${THINKFLEETBOT_DOCKER_APT_PACKAGES}" \
  -t "$IMAGE_NAME" \
  -f "$ROOT_DIR/Dockerfile" \
  "$ROOT_DIR"

echo ""
echo "==> Starting gateway"
docker compose "${COMPOSE_ARGS[@]}" up -d thinkfleetbot-gateway

PORT="${THINKFLEETBOT_GATEWAY_PORT}"
echo "==> Waiting for gateway to be ready..."
for i in $(seq 1 30); do
  if curl -sf -H "Authorization: Bearer ${THINKFLEETBOT_GATEWAY_TOKEN}" "http://127.0.0.1:${PORT}/health" >/dev/null 2>&1; then
    echo "Gateway is ready."
    break
  fi
  sleep 1
done

SETUP_URL="http://127.0.0.1:${PORT}/setup?token=${THINKFLEETBOT_GATEWAY_TOKEN}"

echo ""
echo "Gateway running with host port mapping."
echo "Config: $THINKFLEETBOT_CONFIG_DIR"
echo "Workspace: $THINKFLEETBOT_WORKSPACE_DIR"
echo "Token: $THINKFLEETBOT_GATEWAY_TOKEN"
echo ""
echo "==> Open the setup wizard to complete configuration:"
echo "  $SETUP_URL"
echo ""

# Try to open the browser automatically
if command -v open >/dev/null 2>&1; then
  open "$SETUP_URL" 2>/dev/null || true
elif command -v xdg-open >/dev/null 2>&1; then
  xdg-open "$SETUP_URL" 2>/dev/null || true
fi

echo "Commands:"
echo "  ${COMPOSE_HINT} logs -f thinkfleetbot-gateway"
echo "  ${COMPOSE_HINT} exec thinkfleetbot-gateway node dist/index.js health --token \"$THINKFLEETBOT_GATEWAY_TOKEN\""
