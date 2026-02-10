#!/usr/bin/env bash
# ThinkFleet Engine — Install Script
# Usage: curl -fsSL https://thinkfleet.dev/install.sh | bash
set -euo pipefail

BOLD='\033[1m'
DIM='\033[2m'
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[0;33m'
CYAN='\033[0;36m'
NC='\033[0m'

banner() {
  echo ""
  echo -e "${CYAN}${BOLD}"
  echo "  _____ _     _       _    _____ _           _   "
  echo " |_   _| |   (_)     | |  |  ___| |         | |  "
  echo "   | | | |__  _ _ __ | | _| |_  | | ___  ___| |_ "
  echo "   | | | '_ \| | '_ \| |/ /  _| | |/ _ \/ _ \ __|"
  echo "   | | | | | | | | | |   <| |   | |  __/  __/ |_ "
  echo "   \_/ |_| |_|_|_| |_|_|\_\_|   |_|\___|\___|\__|"
  echo ""
  echo -e "  ${NC}${BOLD}ThinkFleet Engine${NC} — Open-source AI agent runtime"
  echo ""
}

info()  { echo -e "${GREEN}[info]${NC}  $*"; }
warn()  { echo -e "${YELLOW}[warn]${NC}  $*"; }
error() { echo -e "${RED}[error]${NC} $*" >&2; }

require_cmd() {
  if ! command -v "$1" >/dev/null 2>&1; then
    error "Missing required command: ${BOLD}$1${NC}"
    echo "  Install it and re-run this script."
    exit 1
  fi
}

detect_os() {
  case "$(uname -s)" in
    Linux*)  echo "linux" ;;
    Darwin*) echo "macos" ;;
    MINGW*|MSYS*|CYGWIN*) echo "windows" ;;
    *)       echo "unknown" ;;
  esac
}

# ---------------------------------------------------------------------------
# Main
# ---------------------------------------------------------------------------

banner

OS="$(detect_os)"
INSTALL_MODE="${THINKFLEET_INSTALL_MODE:-}"

# Step 1: Choose installation mode
if [[ -z "$INSTALL_MODE" ]]; then
  echo -e "${BOLD}How would you like to run ThinkFleet Engine?${NC}"
  echo ""
  echo -e "  ${CYAN}1)${NC} ${BOLD}ThinkFleet Cloud${NC} ${DIM}(recommended)${NC}"
  echo "     Managed hosting, automatic updates, built-in channels,"
  echo "     credential vault, billing, and multi-agent orchestration."
  echo "     Free tier available — no credit card required."
  echo ""
  echo -e "  ${CYAN}2)${NC} ${BOLD}Self-hosted (local)${NC}"
  echo "     Run the engine on your own machine or server."
  echo "     You manage security, updates, and infrastructure."
  echo ""
  echo -e "  ${CYAN}3)${NC} ${BOLD}Self-hosted (Docker)${NC}"
  echo "     Run in Docker with guided setup."
  echo "     Requires Docker and Docker Compose."
  echo ""

  read -rp "Choose [1/2/3]: " choice
  case "$choice" in
    1) INSTALL_MODE="cloud" ;;
    2) INSTALL_MODE="local" ;;
    3) INSTALL_MODE="docker" ;;
    *)
      error "Invalid choice. Run the script again."
      exit 1
      ;;
  esac
fi

# ---------------------------------------------------------------------------
# Cloud (SaaS) path
# ---------------------------------------------------------------------------
if [[ "$INSTALL_MODE" == "cloud" ]]; then
  echo ""
  info "Opening ThinkFleet Cloud signup..."
  echo ""
  echo -e "  ${BOLD}Sign up or log in:${NC}"
  echo -e "  ${CYAN}https://app.thinkfleet.dev${NC}"
  echo ""
  echo "  After signing up:"
  echo "  1. Create an organization"
  echo "  2. Create an agent from the dashboard"
  echo "  3. The agent runs in our managed infrastructure"
  echo "  4. Connect channels (Discord, Telegram, Slack, SMS, etc.)"
  echo "  5. Add API keys and credentials from the Settings page"
  echo ""
  echo -e "  ${DIM}Your agent is fully managed — no local install needed.${NC}"
  echo -e "  ${DIM}Billing, updates, and security are handled for you.${NC}"
  echo ""

  # Try to open browser
  if command -v open >/dev/null 2>&1; then
    open "https://app.thinkfleet.dev" 2>/dev/null || true
  elif command -v xdg-open >/dev/null 2>&1; then
    xdg-open "https://app.thinkfleet.dev" 2>/dev/null || true
  fi

  echo -e "${GREEN}${BOLD}Want to also install the CLI for local development?${NC}"
  read -rp "Install thinkfleet-engine CLI? [y/N]: " install_cli
  if [[ "$install_cli" =~ ^[Yy] ]]; then
    INSTALL_MODE="local"
  else
    echo ""
    info "Done! Visit https://app.thinkfleet.dev to get started."
    exit 0
  fi
fi

# ---------------------------------------------------------------------------
# Security notice for self-hosted
# ---------------------------------------------------------------------------
if [[ "$INSTALL_MODE" == "local" || "$INSTALL_MODE" == "docker" ]]; then
  echo ""
  echo -e "${YELLOW}${BOLD}=== SECURITY NOTICE ===${NC}"
  echo ""
  echo -e "  ${BOLD}You are choosing to self-host ThinkFleet Engine.${NC}"
  echo "  Please read and understand the following:"
  echo ""
  echo -e "  ${RED}1. Gateway Security${NC}"
  echo "     The web interface and gateway are designed for ${BOLD}local/private${NC}"
  echo "     ${BOLD}network use only${NC}. Do NOT expose them to the public internet"
  echo "     without a reverse proxy, TLS, and authentication."
  echo ""
  echo -e "  ${RED}2. API Keys & Credentials${NC}"
  echo "     You are responsible for securing API keys stored locally."
  echo "     Keys are encrypted at rest, but the encryption key lives"
  echo "     on the same machine. Use a secrets manager for production."
  echo ""
  echo -e "  ${RED}3. Tool Execution${NC}"
  echo "     The engine can execute shell commands, run scripts, and"
  echo "     access the filesystem. Run it in an isolated environment"
  echo "     (container, VM, or dedicated user) — never as root."
  echo ""
  echo -e "  ${RED}4. Updates${NC}"
  echo "     You are responsible for keeping the engine updated."
  echo "     Security patches are published as new npm versions."
  echo "     Run: ${CYAN}npm update -g thinkfleet-engine${NC}"
  echo ""
  echo -e "  ${RED}5. Node.js Requirement${NC}"
  echo "     Requires ${BOLD}Node.js 22.12.0+${NC} (LTS) for security patches."
  echo "     See SECURITY.md for details on required CVE fixes."
  echo ""
  echo -e "  ${DIM}Full security guide: https://docs.thinkfleet.dev/security${NC}"
  echo -e "  ${DIM}For managed hosting with built-in security: https://app.thinkfleet.dev${NC}"
  echo ""

  read -rp "I understand the security responsibilities. Continue? [y/N]: " confirm
  if [[ ! "$confirm" =~ ^[Yy] ]]; then
    echo ""
    info "Installation cancelled."
    echo "  Consider ThinkFleet Cloud for managed hosting: https://app.thinkfleet.dev"
    exit 0
  fi
fi

# ---------------------------------------------------------------------------
# Docker path
# ---------------------------------------------------------------------------
if [[ "$INSTALL_MODE" == "docker" ]]; then
  require_cmd docker

  if ! docker compose version >/dev/null 2>&1; then
    error "Docker Compose not available (try: docker compose version)"
    exit 1
  fi

  echo ""
  info "Starting Docker setup..."
  echo ""

  # Check if we're in the repo (docker-setup.sh available)
  SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
  if [[ -f "$SCRIPT_DIR/docker-setup.sh" ]]; then
    exec bash "$SCRIPT_DIR/docker-setup.sh"
  fi

  # Otherwise, clone and run
  info "Cloning ThinkFleet Engine..."
  TMPDIR="$(mktemp -d)"
  trap 'rm -rf "$TMPDIR"' EXIT

  require_cmd git
  git clone --depth 1 https://github.com/thinkfleet/thinkfleet-engine.git "$TMPDIR/thinkfleet-engine"
  exec bash "$TMPDIR/thinkfleet-engine/docker-setup.sh"
fi

# ---------------------------------------------------------------------------
# Local (npm) install path
# ---------------------------------------------------------------------------
if [[ "$INSTALL_MODE" == "local" ]]; then
  require_cmd node

  # Check Node.js version
  NODE_MAJOR="$(node -p 'process.versions.node.split(".")[0]')"
  if [[ "$NODE_MAJOR" -lt 22 ]]; then
    error "Node.js 22+ required (found: $(node -v))"
    echo ""
    echo "  Install Node.js 22 LTS:"
    if [[ "$OS" == "macos" ]]; then
      echo "    brew install node@22"
    else
      echo "    curl -fsSL https://deb.nodesource.com/setup_22.x | sudo -E bash -"
      echo "    sudo apt-get install -y nodejs"
    fi
    echo ""
    echo "  Or use a version manager: https://github.com/nvm-sh/nvm"
    exit 1
  fi

  # Detect package manager
  if command -v pnpm >/dev/null 2>&1; then
    PM="pnpm"
  elif command -v npm >/dev/null 2>&1; then
    PM="npm"
  else
    error "npm or pnpm required."
    exit 1
  fi

  echo ""
  info "Installing ThinkFleet Engine via ${BOLD}$PM${NC}..."
  echo ""

  $PM install -g thinkfleet-engine@latest

  # Verify installation
  if ! command -v thinkfleet-engine >/dev/null 2>&1; then
    # Try thinkfleet alias
    if command -v thinkfleet >/dev/null 2>&1; then
      CLI_CMD="thinkfleet"
    else
      error "Installation completed but CLI not found on PATH."
      echo "  Try opening a new terminal, or add the npm global bin to PATH:"
      echo "  export PATH=\"\$($PM bin -g):\$PATH\""
      exit 1
    fi
  else
    CLI_CMD="thinkfleet-engine"
  fi

  echo ""
  info "Installed: $($CLI_CMD --version 2>/dev/null || echo 'thinkfleet-engine')"
  echo ""

  # Optional: Connect to SaaS
  echo -e "${BOLD}Connect to ThinkFleet Cloud?${NC}"
  echo "  This lets you manage credentials, channels, and billing"
  echo "  from the web dashboard while running the engine locally."
  echo ""
  read -rp "Connect to ThinkFleet Cloud? [y/N]: " connect_saas

  if [[ "$connect_saas" =~ ^[Yy] ]]; then
    echo ""
    echo -e "  ${BOLD}Steps to connect:${NC}"
    echo "  1. Sign up at ${CYAN}https://app.thinkfleet.dev${NC}"
    echo "  2. Create an organization and agent"
    echo "  3. Go to Agent Settings > Self-hosted"
    echo "  4. Copy the connection command and run it:"
    echo ""
    echo -e "     ${CYAN}$CLI_CMD connect --saas-url <url> --agent-id <id> --token <token>${NC}"
    echo ""
    echo "  This sets THINKFLEET_SAAS_API_URL, THINKFLEET_AGENT_DB_ID,"
    echo "  and THINKFLEET_GATEWAY_TOKEN in your local config."
    echo ""
  fi

  # Run onboarding
  echo -e "${BOLD}Run the setup wizard now?${NC}"
  read -rp "Run onboarding? [Y/n]: " run_onboard

  if [[ ! "$run_onboard" =~ ^[Nn] ]]; then
    echo ""
    $CLI_CMD onboard --install-daemon
  else
    echo ""
    info "Skipped onboarding. Run it later:"
    echo "  $CLI_CMD onboard --install-daemon"
  fi

  echo ""
  echo -e "${GREEN}${BOLD}Installation complete!${NC}"
  echo ""
  echo "  Commands:"
  echo "    $CLI_CMD status          # Check engine health"
  echo "    $CLI_CMD dashboard       # Open web dashboard"
  echo "    $CLI_CMD plugins list    # List installed plugins"
  echo "    $CLI_CMD doctor          # Diagnose issues"
  echo ""
  echo -e "  ${DIM}Docs: https://docs.thinkfleet.dev${NC}"
  echo -e "  ${DIM}SaaS: https://app.thinkfleet.dev${NC}"
  echo ""
fi
