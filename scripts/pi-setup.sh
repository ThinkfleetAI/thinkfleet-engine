#!/usr/bin/env bash
# Clawdbot Pi Setup Script
# Run on a fresh Raspberry Pi OS (64-bit, Bookworm+):
#   curl -fsSL https://your-domain.com/pi-setup.sh | bash
set -euo pipefail

echo "=== Clawdbot Pi Setup ==="

# --- System packages ---
sudo apt-get update
sudo apt-get install -y \
  git curl build-essential \
  chromium-browser \
  pulseaudio \
  alsa-utils

# --- Node.js 22 via fnm ---
if ! command -v fnm &>/dev/null; then
  curl -fsSL https://fnm.vercel.app/install | bash
  export PATH="$HOME/.local/share/fnm:$PATH"
  eval "$(fnm env)"
fi
fnm install 22
fnm use 22

# --- pnpm ---
if ! command -v pnpm &>/dev/null; then
  corepack enable
  corepack prepare pnpm@latest --activate
fi

# --- Clone repo ---
INSTALL_DIR="$HOME/clawdbot"
if [ ! -d "$INSTALL_DIR" ]; then
  echo "Clone the clawdbot repo to $INSTALL_DIR before running this script."
  echo "  git clone <your-repo-url> $INSTALL_DIR"
  exit 1
fi

cd "$INSTALL_DIR"
pnpm install

# --- Build kiosk ---
cd "$INSTALL_DIR/apps/kiosk"
pnpm run build

# --- Build gateway ---
cd "$INSTALL_DIR"
pnpm run build

# --- Systemd service for gateway ---
sudo tee /etc/systemd/system/clawdbot-gateway.service > /dev/null <<EOF
[Unit]
Description=Clawdbot Gateway
After=network.target

[Service]
Type=simple
User=$USER
WorkingDirectory=$INSTALL_DIR
ExecStart=$(which node) dist/cli.js gateway --bind lan
Restart=always
RestartSec=5
Environment=NODE_ENV=production

[Install]
WantedBy=multi-user.target
EOF

sudo systemctl daemon-reload
sudo systemctl enable clawdbot-gateway.service
sudo systemctl start clawdbot-gateway.service

# --- Chromium kiosk autostart ---
mkdir -p "$HOME/.config/autostart"
cat > "$HOME/.config/autostart/clawdbot-kiosk.desktop" <<EOF
[Desktop Entry]
Type=Application
Name=Clawdbot Kiosk
Exec=chromium-browser --kiosk --noerrdialogs --disable-infobars --no-first-run --autoplay-policy=no-user-gesture-required http://localhost:18789/kiosk/
X-GNOME-Autostart-enabled=true
EOF

# --- Disable screen blanking ---
if [ -f /etc/lightdm/lightdm.conf ]; then
  sudo sed -i 's/^#xserver-command=.*/xserver-command=X -s 0 -dpms/' /etc/lightdm/lightdm.conf 2>/dev/null || true
fi

echo ""
echo "=== Setup complete ==="
echo "Gateway running on port 18789"
echo "Kiosk will launch on next reboot (or run Chromium manually):"
echo "  chromium-browser --kiosk http://localhost:18789/kiosk/"
echo ""
echo "To check gateway status: sudo systemctl status clawdbot-gateway"
echo "To view logs:            sudo journalctl -u clawdbot-gateway -f"
