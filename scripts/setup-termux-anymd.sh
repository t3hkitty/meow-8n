#!/data/data/com.termux/files/usr/bin/bash
# =====================================================================
# setup-termux-anymd.sh
# Bootstrap Python and dependencies for local on-demand Anymd runner.
# =====================================================================

set -e

echo "[+] Updating Termux package indexes..."
pkg update -y

echo "[+] Installing Python 3, Git, and essential tools..."
pkg install -y python git openssl

echo "[+] Installing pip packages..."
pip install --upgrade pip
pip install pyyaml requests

echo "===================================================================="
echo "[SUCCESS] Anymd local runner environment is ready."
echo "Workflow engine runs on-demand via scripts/anymd-runner.py"
echo "===================================================================="
