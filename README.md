🐾 meow-n8n: GitHubOnly AnyMD Database Sync Service 🐾
```text
    /\_/\           🐾 setup options inside!
   ( >.< )  _______
    > ^ <  /       \
   /     \|  meow!  |
  /  | |  | \_______/
  \_/ \_/ /
```
🌸 Overview
This project provides a GitHub-only n8n database service designed to act as a serverless, local-first database adapter for your AnyMD vault [cite: 340]. By forwarding webhook payloads directly to your target GitHub repository, n8n automatically compiles the data into structured Markdown files with custom YAML frontmatter—providing secure, version-controlled records hosted entirely for free under standard Git [cite: 340].
---
🚀 n8n Setup & Ingestion Methods (Choose One)
You can configure and deploy your n8n workflow using any of the following four methods.
> [!WARNING]
> Since **GitHub Pages is a static hosting platform, it cannot host active n8n background processes natively** [cite: 339]. Therefore, Option 4 is **not an automatic, self-contained hosting method**; you must run or host your active n8n instance on one of the other environments (local PC, Termux, or VPS) to process, format, and commit incoming webhook payloads [cite: 339, 340].
1. Locally on PC/Mac (Free & Private)
Run n8n directly on your local developer machine using Node.js or Docker:
npm (Requires Node.js):
```bash
  npm install n8n -g
  n8n start
  ```
Docker:
```bash
  docker run -it --rm --name n8n -p 5678:5678 n8n/n8n
  ```
Open your browser and navigate to `http://localhost:5678` [cite: 339].
2. Locally on Android via Termux (Free & Offline)
Maintain a fully local, self-contained n8n daemon inside the sandboxed Termux environment on your mobile device:
Install Termux from F-Droid [cite: 339].
Run the setup command:
```bash
  pkg update -y && pkg install -y nodejs-lts python build-essential git openssl
  npm install -g n8n pm2
  pm2 start n8n --name "n8n-local" -- --tunnel=false
  ``` [cite: 339]
* Access the interface locally at `http://127.0.0.1:5678` [cite: 339].
Access the interface locally at `http://127.0.0.1:5678` [cite: 339].
3. VPS / Cloud Deployment (24/7 Webhooks)
Deploy n8n to a remote virtual private server (such as a free Oracle Cloud ARM64 instance) for constant connectivity:
Sync this setup folder to your VPS at `/home/ubuntu/app` [cite: 339].
Launch using PM2 or Docker Compose to expose secure, persistent webhook endpoints [cite: 339].
4. GitHub-Only "Serverless" Sync (Not Automatic) ⚠️
Save and compile your AnyMD vaults directly to a static GitHub Pages repository without keeping an active VPS backend running [cite: 1, 339, 340]:
Important: This is not a hosting method for the n8n application. Because GitHub Pages is purely static, you cannot host your active n8n workflows directly inside the repository.
Mechanism: You must execute your active n8n workspace locally (via Option 1 or 2) or use a cloud runner [cite: 339].
Sync Flow: Incoming data webhooks are intercepted by your active n8n instance, converted to Markdown, and committed to your repository via the GitHub Repositories API (`PUT /repos/{owner}/{repo}/contents/`) [cite: 340]. Each commit automatically triggers GitHub's static Jekyll builder to regenerate your Pages site, making your new files visible on refresh [cite: 51, 340]!
---
🏛️ Configuration Instructions
Import the Workflow:
Open your n8n workspace dashboard.
Click Add Workflow ──► Import from File.
Select `n8n-githubonly-anymd-workflow.json` [cite: 340].
Configure Credentials:
Set up a GitHub OAuth2 credential or Personal Access Token (PAT) with `repo` permissions in n8n [cite: 340].
Attach it to the Push to GitHub Repo node.
Test Ingestion:
Send a `POST` request to the active webhook URL with this JSON payload [cite: 340]:
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
   ``` [cite: 340]
