#!/data/data/com.termux/files/usr/bin/bash
# =====================================================================
# setup-termux-n8n.sh
# Core bootstrapping script for running n8n inside a Debian proot-distro container.
# ====================================================================

set -e

echo "[+] Updating Termux package indexes..."
pkg update -y && pkg upgrade -y

echo "[+] Installing proot-distro and termux-api..."
pkg install -y proot-distro termux-api

echo "[+] Installing Debian container via proot-distro..."
proot-distro install debian

echo "[+] Bootstrapping Debian environment (Node.js 20, PostgreSQL, n8n)..."
proot-distro login debian -- sh -c '
  apt-get update && apt-get upgrade -y
  apt-get install -y curl sudo gnupg build-essential postgresql postgresql-contrib
  curl -fsSL https://deb.nodesource.com/setup_20.x | bash -
  apt-get install -y nodejs
  npm install -g n8n pm2 --unsafe-perm
  
  # Configure PostgreSQL inside Debian
  service postgresql start
  sudo -u postgres psql -c "ALTER USER postgres WITH PASSWORD \'\';"
  sudo -u postgres createuser --superuser root || true
  sudo -u postgres createdb n8n -O root || true
'

echo "===================================================================="
echo "[SUCCESS] n8n local environment is ready inside Debian proot container."
echo "To start n8n, run: ./scripts/start-n8n.sh"
echo "===================================================================="