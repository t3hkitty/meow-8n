# 🐾 meow-8n: Anymd database & Sync Service 🐾

```text
    /\_/\           
   ( >.< )  _______
    > ^ <  /       \
   /     \|  meow!  |
  /  | |  | \_______/
  \_/ \_/ /
```

## 🌸 Overview
This project provides a serverless, local-first database adapter using **Anymd**. By running on-demand workflow executions, it compiles incoming payloads into standard Markdown files with structured YAML frontmatter and commits them directly to your target GitHub repository.

No heavy Node.js `n8n` dependencies, PostgreSQL servers, or `isolated-vm` daemons are needed!

---

## 🚀 Setup & Execution

### 1. Bootstrap on Termux (Android)
To install Python 3 and setup dependencies inside native Termux:
```bash
bash scripts/setup-termux-anymd.sh
```

### 2. Run Queue Watcher Daemon
To process files dropped in the execution queue on-demand:
```bash
bash scripts/start-anymd.sh
```

### 3. Trigger On-Demand Manually
To execute a workflow file directly:
```bash
python3 scripts/anymd_runner.py --workflow n8n-githubonly-anymd-workflow.json --payload '{"body": {"owner": "user", "repository": "repo"}}'
```
