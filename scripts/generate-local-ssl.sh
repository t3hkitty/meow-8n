#!/data/data/com.termux/files/usr/bin/bash
# ==============================================================================
# generate-local-ssl.sh
# Generates local self-signed TLS certificates with SAN for localhost & 127.0.0.1
# ==============================================================================

set -e

SSL_DIR="$HOME/.n8n-ssl"
mkdir -p "$SSL_DIR"
cd "$SSL_DIR"

echo "[+] Generating 2048-bit RSA Private Key and X.509 Certificate..."

openssl req -x509 -newkey rsa:2048 -nodes \
  -keyout n8n-local.key \
  -out n8n-local.crt \
  -days 3650 \
  -subj "/C=US/ST=California/L=Local/O=n8nLocal/CN=localhost" \
  -addext "subjectAltName=DNS:localhost,IP:127.0.0.1,IP:0.0.0.0"

chmod 600 n8n-local.key
chmod 644 n8n-local.crt

echo "[+] SSL Certificates successfully generated in $SSL_DIR:"
ls -la "$SSL_DIR"

echo ""
echo "To start n8n with local HTTPS, execute:"
echo "--------------------------------------------------------"
echo "export N8N_PROTOCOL=https"
echo "export N8N_SSL_KEY=$SSL_DIR/n8n-local.key"
echo "export N8N_SSL_CERT=$SSL_DIR/n8n-local.crt"
echo "export WEBHOOK_URL=https://localhost:5678/"
echo "n8n start"
echo "--------------------------------------------------------"
