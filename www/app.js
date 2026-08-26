(function () {
  'use strict';

  const STORAGE_KEY_LOGS = 'anymd_local_logs';
  let eventLogs = loadLogs();

  const elLogConsole = document.getElementById('log-console');
  const btnExecWatch = document.getElementById('btn-exec-anymd-watch');
  const btnExecRun = document.getElementById('btn-exec-anymd-run');
  const btnCopyWatcherCmd = document.getElementById('btn-copy-watcher-cmd');
  const btnFireWebhook = document.getElementById('btn-fire-webhook');
  const textWhPayload = document.getElementById('wh-payload');
  const elWhResultBox = document.getElementById('wh-result-box');
  const elWhResultContent = document.getElementById('wh-result-content');

  document.addEventListener('DOMContentLoaded', () => {
    setupEventListeners();
    logEvent('INFO', 'meow-8n Anymd Companion initialized 🐾');
    renderLogs();
  });

  function setupEventListeners() {
    if (btnExecWatch) {
      btnExecWatch.addEventListener('click', () => {
        const cmd = 'bash scripts/start-anymd.sh';
        copyToClipboard(cmd, 'Watcher command copied! Run in Termux.');
        logEvent('ACTION', 'Watch command copied to clipboard.');
      });
    }

    if (btnExecRun) {
      btnExecRun.addEventListener('click', () => {
        const payload = textWhPayload.value.trim();
        const cmd = `python3 scripts/anymd_runner.py --workflow n8n-githubonly-anymd-workflow.json --payload '${payload}'`;
        copyToClipboard(cmd, 'On-demand execution command copied!');
        logEvent('ACTION', 'Run command copied to clipboard.');
      });
    }

    if (btnCopyWatcherCmd) {
      btnCopyWatcherCmd.addEventListener('click', () => {
        const cmd = 'bash scripts/start-anymd.sh';
        copyToClipboard(cmd, 'Copied start-anymd.sh command.');
      });
    }

    if (btnFireWebhook) {
      btnFireWebhook.addEventListener('click', handleFireWebhook);
    }
  }

  async function handleFireWebhook() {
    const payloadText = textWhPayload.value.trim();
    const targetUrl = document.getElementById('wh-target-url')?.value.trim() || 'https://n8n.lorikitty.me/webhook/anymd-db';
    elWhResultBox.style.display = 'block';
    elWhResultContent.textContent = 'Sending payload to cloud webhook...';
    logEvent('HTTP', `Dispatching POST request to ${targetUrl}`);

    try {
      const parsed = JSON.parse(payloadText);
      const response = await fetch(targetUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(parsed)
      });
      
      const resText = await response.text();
      let resJson;
      try {
        resJson = JSON.parse(resText);
      } catch (e) {
        resJson = null;
      }

      if (response.ok) {
        elWhResultContent.textContent = resJson ? JSON.stringify(resJson, null, 2) : resText;
        logEvent('SUCCESS', 'Cloud compilation and GitHub sync completed successfully!');
      } else {
        elWhResultContent.textContent = `Error Status ${response.status}:\n${resText}`;
        logEvent('ERROR', `Cloud webhook rejected request: ${response.status}`);
      }
    } catch (err) {
      elWhResultContent.textContent = 'Error dispatching request:\n' + err.message;
      logEvent('ERROR', `Failed dispatch: ${err.message}`);
    }
  }

  function copyToClipboard(text, msg) {
    const tempInput = document.createElement('textarea');
    tempInput.value = text;
    document.body.appendChild(tempInput);
    tempInput.select();
    try {
      document.execCommand('copy');
      alert(msg || 'Copied!');
    } catch (e) {
      console.error('Failed to copy', e);
    }
    document.body.removeChild(tempInput);
  }

  function logEvent(level, message) {
    const timestamp = new Date().toLocaleTimeString();
    const entry = `[${timestamp}] [${level}] ${message}`;
    eventLogs.unshift(entry);
    if (eventLogs.length > 50) eventLogs.pop();
    saveLogs();
    renderLogs();
  }

  function loadLogs() {
    try {
      const raw = localStorage.getItem(STORAGE_KEY_LOGS);
      if (raw) return JSON.parse(raw);
    } catch (e) {}
    return [];
  }

  function saveLogs() {
    try {
      localStorage.setItem(STORAGE_KEY_LOGS, JSON.stringify(eventLogs));
    } catch (e) {}
  }

  function renderLogs() {
    if (elLogConsole) {
      elLogConsole.textContent = eventLogs.join('\n');
    }
  }

})();
