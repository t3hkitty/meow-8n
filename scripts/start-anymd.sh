#!/data/data/com.termux/files/usr/bin/bash
# =====================================================================
# start-anymd.sh
# Run the on-demand Anymd queue watcher daemon in Termux.
# =====================================================================

export ANYMD_QUEUE_DIR="${1:-queue}"
echo "[+] Starting Anymd runner queue watcher..."
python3 scripts/anymd_watcher.py
