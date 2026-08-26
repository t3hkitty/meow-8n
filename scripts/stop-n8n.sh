#!/data/data/com.termux/files/usr/bin/bash
# ==============================================================================
# stop-n8n.sh
# Graceful shutdown script for local n8n daemon
# ==============================================================================

echo "[*] Stopping local n8n daemon..."

if command -v pm2 >/dev/null 2>&1; then
    pm2 stop n8n-local || true
    echo "[+] PM2 process stopped."
fi

# Fallback process kill if running standalone
pkill -f "n8n" || true

# Release Wake Lock if desired
termux-wake-unlock || true

echo "[+] Local n8n daemon stopped successfully."
