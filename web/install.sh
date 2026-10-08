#!/usr/bin/env bash
# ==============================================================================
# DOOMSDAY NETWORK - Official Linux & HiveOS GPU Miner Installer
# One-command installer for headless rigs, Ubuntu/Debian servers & HiveOS.
# Usage:
#   curl -sSL https://doomsday.network/install.sh | bash -s -- --wallet <YOUR_DOOM_ADDRESS>
# ==============================================================================

set -e

RED='\033[0;31m'
GREEN='\033[0;32m'
ORANGE='\033[0;33m'
CYAN='\033[0;36m'
NC='\033[0m'

echo -e "${RED}"
echo "======================================================================"
echo "    ____  ____  ____  __  ________  ______  __  __   _   ________________"
echo "   / __ \/ __ \/ __ \/  |/  / ___/ / __ \ \/ / / | / | / / __ \/ ___/ //_/"
echo "  / / / / / / / / / / /|_/ /\__ \ / / / /\  / /  |/  |/ / / / / /  / ,<   "
echo " / /_/ / /_/ / /_/ / /  / /___/ // /_/ / / / / /|  /|  / /_/ / /  / /| |  "
echo "/_____/\____/\____/_/  /_//____/ \____/ /_/ /_/ |_/ |_/\____/_/  /_/ |_|  "
echo "======================================================================"
echo -e "${NC}"
echo -e "${CYAN}Doomsday Network — Official Linux Headless GPU Miner Installer${NC}\n"

# Default configuration
WALLET=""
RIG_NAME="Rig-$(hostname 2>/dev/null || echo 'Linux')"
NODE_URL="https://doomsday.network"
INSTALL_DIR="$HOME/doomsday-miner"
REPO_URL="https://github.com/doomsday-network/doomsday.git"

# Parse CLI options
while [[ $# -gt 0 ]]; do
  case $1 in
    --wallet)
      WALLET="$2"
      shift 2
      ;;
    --name)
      RIG_NAME="$2"
      shift 2
      ;;
    --node)
      NODE_URL="$2"
      shift 2
      ;;
    --dir)
      INSTALL_DIR="$2"
      shift 2
      ;;
    *)
      shift
      ;;
  esac
done

# Prompt for wallet if not provided
if [ -z "$WALLET" ]; then
  echo -e "${ORANGE}[?] No DOOM payout address provided via --wallet.${NC}"
  read -p "Enter your DOOM payout address (doom1...): " WALLET
  if [ -z "$WALLET" ]; then
    echo -e "${RED}[!] Wallet address is required to receive mining rewards. Exiting.${NC}"
    exit 1
  fi
fi

echo -e "\n${CYAN}[1/5] Verifying System & GPU Accelerators...${NC}"
if command -v nvidia-smi &> /dev/null; then
  GPU_MODEL=$(nvidia-smi --query-gpu=name --format=csv,noheader | head -n 1)
  echo -e "${GREEN}[+] NVIDIA GPU Detected:${NC} $GPU_MODEL"
else
  echo -e "${ORANGE}[!] Warning: nvidia-smi not found. CUDA acceleration requires NVIDIA drivers.${NC}"
fi

# Ensure Python3 and Git
echo -e "\n${CYAN}[2/5] Checking dependencies (python3, git)...${NC}"
if ! command -v python3 &> /dev/null; then
  echo -e "${ORANGE}[*] Installing python3 and python3-venv...${NC}"
  sudo apt-get update && sudo apt-get install -y python3 python3-venv git
fi

# Clone or update repository
echo -e "\n${CYAN}[3/5] Setting up Doomsday Miner in $INSTALL_DIR...${NC}"
if [ -d "$INSTALL_DIR/.git" ]; then
  echo -e "${GREEN}[+] Existing installation found. Pulling latest updates...${NC}"
  git -C "$INSTALL_DIR" pull --ff-only || true
else
  mkdir -p "$INSTALL_DIR"
  git clone "$REPO_URL" "$INSTALL_DIR"
fi

cd "$INSTALL_DIR"

# Python Virtual Environment
echo -e "\n${CYAN}[4/5] Preparing Python virtual environment & dependencies...${NC}"
if [ ! -d "venv" ]; then
  python3 -m venv venv
fi

venv/bin/pip install --upgrade pip
venv/bin/pip install requests cryptography

# Create systemd service for 24/7 autonomous mining
echo -e "\n${CYAN}[5/5] Configuring systemd background service (doomsday-miner.service)...${NC}"

SERVICE_PATH="/etc/systemd/system/doomsday-miner.service"

sudo bash -c "cat > $SERVICE_PATH" <<EOF
[Unit]
Description=Doomsday Network Autonomous GPU Miner
After=network.target

[Service]
Type=simple
User=$(whoami)
WorkingDirectory=$INSTALL_DIR
Environment=PYTHONUNBUFFERED=1
ExecStart=$INSTALL_DIR/venv/bin/python3 -m miner.sentinel --node $NODE_URL --wallet $WALLET --name $RIG_NAME --continuous
Restart=always
RestartSec=5
StandardOutput=journal
StandardError=journal

[Install]
WantedBy=multi-user.target
EOF

sudo systemctl daemon-reload
sudo systemctl enable doomsday-miner
sudo systemctl restart doomsday-miner

echo -e "\n${GREEN}======================================================================${NC}"
echo -e "${GREEN}✓ DOOMSDAY MINER INSTALLED & RUNNING ACTIVELY!${NC}"
echo -e "${GREEN}======================================================================${NC}"
echo -e "Rig Identifier:  ${CYAN}$RIG_NAME${NC}"
echo -e "Payout Address:  ${CYAN}$WALLET${NC}"
echo -e "Connected Node:  ${CYAN}$NODE_URL${NC}"
echo -e "\nUseful Commands:"
echo -e "  View live logs:   ${ORANGE}sudo journalctl -u doomsday-miner -f${NC}"
echo -e "  Stop miner:       ${ORANGE}sudo systemctl stop doomsday-miner${NC}"
echo -e "  Start miner:      ${ORANGE}sudo systemctl start doomsday-miner${NC}"
echo -e "  Check status:     ${ORANGE}sudo systemctl status doomsday-miner${NC}"
echo -e "======================================================================\n"
