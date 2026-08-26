# 🐾 meow-8n: Cloud-Synced AnyMD Webhook DB 🐾

```text
    /\_/\           🐾 now with 100% remote VPS sidecar!
   ( >.< )  _______
    > ^ <  /       \
   /     \|  meow!  |
  /  | |  | \_______/
  \_/ \_/ /
```

## 🌸 Overview
This project provides a remote, cloud-hosted **n8n database sync sidecar** for **AnyMD**. Webhook payloads sent from the AnyMD app are dispatched directly to your n8n cloud instance, which converts them to structured Markdown with YAML frontmatter and commits them to your GitHub repository.

---

## ⚡ Key Architecture
* **Zero Local Dependencies:** The AnyMD Android app functions purely as an HTTP webhook client targeting `https://n8n.lorikitty.me/webhook/anymd-db`. No Termux or on-device Node.js servers needed!
* **Isolated Sidecar:** n8n runs in a dedicated Docker container bound to `127.0.0.1:5678` with data isolated at `/opt/n8n/data` on the VPS.
* **Caddy Reverse Proxy:** Handles SSL and proxy routes traffic safely to n8n.
* **Automated Daily Backups:** Systemd daily timer invokes `/home/ubuntu/app/scripts/backup-n8n.sh` to package `/opt/n8n/data` into timestamped zip files with a 7-day retention limit.

---

## 🚀 Ingestion Endpoint
Target Endpoint: `https://n8n.lorikitty.me/webhook/anymd-db` (or `https://n8n.lorik.me/webhook/anymd-db`)

### Payload Format:
```json
{
  "owner": "github-username",
  "repository": "anymd-vault",
  "vault": "sandbox_vault",
  "filename": "Zettel_20260825.md",
  "frontmatter": {
    "type": "journal_log",
    "title": "Cozy Evening",
    "tags": ["#lifeboat", "#journal"]
  },
  "content": "This is the body of the markdown record."
}
```

```text
      (\_/)
     (='.'=)  🐾 keep your blackbox safe & cute!
     (")_(")
```
