# 🐾 meow-8n: GitHubOnly n8n Database Sync Service 🐾

```text
    /\_/\           🐾 setup options inside!
   ( >.< )  _______
    > ^ <  /       \
   /     \|  meow!  |
  /  | |  | \_______/
  \_/ \_/ /
```

## 🌸 Overview
This project provides a **GitHub-only n8n service** that acts as a serverless, local-first database adapter. By forwarding webhooks through n8n directly to your target GitHub repository, it converts incoming payloads into standard **AnyMD** Markdown files with structured YAML frontmatter—storing your records securely, privately, and for free under standard Git version control.

---

## 🚀 n8n Hosting Methods (Choose One)

You can run n8n using any of the following three methods:

### 1. Locally on PC/Mac (Free)
Run n8n on your local machine using npm or Docker:
* **npm (Requires Node.js)**:
  ```bash
  npm install n8n -g
  n8n start
  ```
* **Docker**:
  ```bash
  docker run -it --rm --name n8n -p 5678:5678 n8n/n8n
  ```
* Open your browser and navigate to `http://localhost:5678`.

### 2. Locally on Android via Termux (Free & Offline)
Run a fully self-contained n8n daemon inside the Termux environment:
* Install **Termux** from F-Droid.
* Run the setup command:
  ```bash
  pkg update -y && pkg install -y nodejs-lts python build-essential git openssl
  npm install -g n8n pm2
  pm2 start n8n --name "n8n-local" -- --tunnel=false
  ```
* Access the interface locally at `http://127.0.0.1:5678`.

### 3. VPS / Cloud Deployment (24/7 Webhooks)
Deploy n8n to a remote virtual private server (e.g., Oracle Cloud ARM64 node):
* Sync this setup to your VPS at `/home/ubuntu/app`.
* Launch using PM2 or Docker Compose to expose secure webhook endpoints.

---

## 🏛️ Configuration Instructions

1. **Import the Workflow**:
   * Open your n8n workspace dashboard.
   * Click **Add Workflow** ──► **Import from File**.
   * Select [`n8n-githubonly-anymd-workflow.json`](n8n-githubonly-anymd-workflow.json).

2. **Configure Credentials**:
   * Set up a GitHub OAuth2 credential or Personal Access Token (PAT) with `repo` permissions in n8n.
   * Attach it to the **Push to GitHub Repo** node.

3. **Test Ingestion**:
   Send a `POST` request to the active webhook URL with this JSON payload:
   ```json
   {
     "owner": "your-github-username",
     "repository": "your-anymd-vault-repo",
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
