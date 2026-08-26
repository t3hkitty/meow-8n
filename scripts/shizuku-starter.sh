#!/system/bin/sh
# ==============================================================================
# shizuku-starter.sh
# Privileged helper to execute ADB-level optimizations and keep n8n alive
# Run via: rish scripts/shizuku-starter.sh
# ==============================================================================

echo "[+] Adjusting Android Phantom Process Killer limits via Shizuku/ADB..."
device_config put activity_manager max_phantom_processes 2147483647

echo "[+] Whitelisting Termux and n8n Local from battery restrictions..."
dumpsys deviceidle whitelist +com.termux
dumpsys deviceidle whitelist +io.n8n.local.app

echo "[+] Starting Termux service in background..."
am start-foreground-service -n com.termux/.app.TermuxService

echo "[SUCCESS] Background execution guard active."
