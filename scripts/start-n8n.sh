#!/data/data/com.termux/files/usr/bin/bash
# =====================================================================
# start-n8n.sh
# Production runner for local n8n daemon running inside Debian proot container.
# =====================================================================

# Prevent Android CPU sleep
termux-wake-lock

echo "[*] Starting PostgreSQL and n8n inside Debian proot container..."

# Run PostgreSQL start and n8n exec inside the container
exec proot-distro login debian -- sh -c '
  service postgresql start || pg_ctlcluster 15 main start || true
  
  # Database Configuration
  export DB_TYPE=postgresdb
  export DB_POSTGRESDB_DATABASE=n8n
  export DB_POSTGRESDB_HOST=127.0.0.1
export DB_POSTGRESDB_PORT=5432
  export DB_POSTGRESDB_USER=root
  export DB_POSTGRESDB_PASSWORD=""

  # Network & Host Binding
  export N8N_HOST="127.0.0.1"
  export N8N_PORT=5678
  export N8N_PROTOCOL="http"
  export WEBHOOK_URL="http://127.0.0.1:5678/"

  exec n8n start
'