/**
 * n8n Local Android App Controller
 * Manages localhost connection, daemon lifecycle, Termux/Shizuku intents,
 * local SSL configuration, and webhook debugging.
 */

(function () {
  'use strict';

  // --- Constants & Storage Keys ---
  const STORAGE_KEY_CONFIG = 'n8n_local_config';
  const STORAGE_KEY_LOGS = 'n8n_local_logs';
  const DEFAULT_CONFIG = {
    host: '127.0.0.1',
    port: '5678',
    protocol: 'http',
    webhookPrefix: 'webhook',
    authHeader: '',
    autoConnect: true,
    ignoreCertErrors: false,
    activeView: 'view-embedded'
  };

  // --- State ---
  let appConfig = loadConfig();
  let isConnected = false;
  let isChecking = false;
  let healthPollTimer = null;
  let eventLogs = loadLogs();

  // --- DOM Elements ---
  const elStatusBadge = document.getElementById('global-status-badge');
  const elStatusText = document.getElementById('global-status-text');
  const elEndpointDisplay = document.getElementById('current-endpoint-display');
  const elN8nFrame = document.getElementById('n8n-frame');
  const elOfflineOverlay = document.getElementById('offline-overlay');
  const elOfflineEndpointText = document.getElementById('offline-endpoint-text');
  const elLatencyBadge = document.getElementById('latency-badge');
  const elMetricUrl = document.getElementById('metric-url');
  const elMetricProtocol = document.getElementById('metric-protocol');
  const elMetricHttpStatus = document.getElementById('metric-http-status');
  const elMetricRuntime = document.getElementById('metric-runtime');
  const elLogConsole = document.getElementById('log-console');
  const elToastContainer = document.getElementById('toast-container');

  // Forms & Inputs
  const formConfig = document.getElementById('form-connection-config');
  const inputHost = document.getElementById('cfg-host');
  const inputPort = document.getElementById('cfg-port');
  const selectProtocol = document.getElementById('cfg-protocol');
  const inputWebhookPrefix = document.getElementById('cfg-webhook-prefix');
  const inputAuthHeader = document.getElementById('cfg-auth-header');
  const checkAutoConnect = document.getElementById('cfg-auto-connect');
  const checkIgnoreCert = document.getElementById('cfg-ignore-cert-errors');

  // Webhook Tester Elements
  const selectWhMethod = document.getElementById('wh-method');
  const inputWhPath = document.getElementById('wh-path');
  const textWhPayload = document.getElementById('wh-payload');
  const btnFireWebhook = document.getElementById('btn-fire-webhook');
  const elWhStatus = document.getElementById('wh-response-status');
  const elWhResultBox = document.getElementById('wh-result-box');
  const elWhResultContent = document.getElementById('wh-result-content');

  // --- Lifecycle & Initialization ---
  document.addEventListener('DOMContentLoaded', () => {
    initUIFromConfig();
    setupNavigation();
    setupModals();
    setupEventListeners();
    setupClipboardButtons();
    renderLogs();

    logEvent('INFO', 'n8n Local Android initialized. Target: ' + getBaseUrl());

    if (appConfig.autoConnect) {
      startHealthPolling();
    }
  });

  // --- Configuration Management ---
  function loadConfig() {
    try {
      const raw = localStorage.getItem(STORAGE_KEY_CONFIG);
      if (raw) {
        return Object.assign({}, DEFAULT_CONFIG, JSON.parse(raw));
      }
    } catch (e) {
      console.warn('Failed to parse config from localStorage', e);
    }
    return Object.assign({}, DEFAULT_CONFIG);
  }

  function saveConfig(newConfig) {
    appConfig = Object.assign({}, appConfig, newConfig);
    try {
      localStorage.setItem(STORAGE_KEY_CONFIG, JSON.stringify(appConfig));
      logEvent('INFO', 'Configuration saved: ' + getBaseUrl());
      showToast('Settings saved successfully.');
    } catch (e) {
      console.error('Failed to save config', e);
    }
    updateEndpointDisplays();
  }

  function getBaseUrl() {
    return `${appConfig.protocol}://${appConfig.host}:${appConfig.port}`;
  }

  function initUIFromConfig() {
    inputHost.value = appConfig.host;
    inputPort.value = appConfig.port;
    selectProtocol.value = appConfig.protocol;
    inputWebhookPrefix.value = appConfig.webhookPrefix;
    inputAuthHeader.value = appConfig.authHeader || '';
    checkAutoConnect.checked = !!appConfig.autoConnect;
    checkIgnoreCert.checked = !!appConfig.ignoreCertErrors;

    updateEndpointDisplays();
    switchView(appConfig.activeView || 'view-embedded');
  }

  function updateEndpointDisplays() {
    const url = getBaseUrl();
    if (elEndpointDisplay) elEndpointDisplay.textContent = url;
    if (elOfflineEndpointText) elOfflineEndpointText.textContent = url;
    if (elMetricUrl) elMetricUrl.textContent = url;
    if (elMetricProtocol) elMetricProtocol.textContent = appConfig.protocol.toUpperCase() + (appConfig.protocol === 'https' ? ' (TLS/SSL)' : ' (Cleartext)');
  }

  // --- Health Check & Ping Engine ---
  function getHealthEndpoint() {
    return `${getBaseUrl()}/healthz`;
  }

  async function checkServerHealth() {
    if (isChecking) return;
    isChecking = true;

    setGlobalStatus('checking', 'Pinging...');
    const startTime = performance.now();
    const targetUrl = getHealthEndpoint();

    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 3000);

    const headers = {};
    if (appConfig.authHeader) {
      headers['Authorization'] = appConfig.authHeader;
    }

    try {
      const response = await fetch(targetUrl, {
        method: 'GET',
        headers: headers,
        signal: controller.signal,
        cache: 'no-cache',
        mode: 'cors'
      });

      clearTimeout(timeoutId);
      const elapsed = Math.round(performance.now() - startTime);

      if (response.ok || response.status === 401 || response.status === 200) {
        handleHealthSuccess(elapsed, response.status);
      } else {
        handleHealthFailure(`HTTP ${response.status}`);
      }
    } catch (err) {
      clearTimeout(timeoutId);
      // Try fallback to root path if /healthz isn't standard
      tryFallbackPing(startTime, err);
    } finally {
      isChecking = false;
    }
  }

  async function tryFallbackPing(startTime, primaryError) {
    const rootUrl = getBaseUrl();
    const fallbackController = new AbortController();
    const fallbackTimeout = setTimeout(() => fallbackController.abort(), 2500);

    try {
      const fallbackResponse = await fetch(rootUrl, {
        method: 'HEAD',
        mode: 'no-cors',
        signal: fallbackController.signal,
        cache: 'no-cache'
      });
      clearTimeout(fallbackTimeout);
      const elapsed = Math.round(performance.now() - startTime);
      handleHealthSuccess(elapsed, 'Active (no-cors)');
    } catch (fallbackErr) {
      clearTimeout(fallbackTimeout);
      handleHealthFailure(primaryError.name === 'AbortError' ? 'Timeout (3s)' : 'Connection Refused');
    }
  }

  function handleHealthSuccess(latencyMs, statusCode) {
    isConnected = true;
    setGlobalStatus('connected', 'Online');
    if (elLatencyBadge) elLatencyBadge.textContent = `Latency: ${latencyMs} ms`;
    if (elMetricHttpStatus) elMetricHttpStatus.textContent = typeof statusCode === 'number' ? `OK (${statusCode})` : statusCode;

    if (elOfflineOverlay) {
      elOfflineOverlay.style.display = 'none';
    }

    // Load iframe if not already loaded or pointing to wrong URL
    const targetUrl = getBaseUrl();
    if (elN8nFrame && (elN8nFrame.src === 'about:blank' || !elN8nFrame.src.startsWith(targetUrl))) {
      elN8nFrame.src = targetUrl;
      logEvent('SUCCESS', `Connected to local n8n daemon at ${targetUrl}`);
    }
  }

  function handleHealthFailure(reason) {
    isConnected = false;
    setGlobalStatus('disconnected', 'Offline');
    if (elLatencyBadge) elLatencyBadge.textContent = 'Latency: --';
    if (elMetricHttpStatus) elMetricHttpStatus.textContent = reason;

    if (elOfflineOverlay) {
      elOfflineOverlay.style.display = 'flex';
    }
  }

  function setGlobalStatus(state, label) {
    if (!elStatusBadge || !elStatusText) return;
    elStatusBadge.className = 'status-indicator-badge status-' + state;
    elStatusText.textContent = label;
  }

  function startHealthPolling() {
    if (healthPollTimer) clearInterval(healthPollTimer);
    checkServerHealth();
    healthPollTimer = setInterval(() => {
      // Poll every 5s if disconnected, every 15s if connected
      checkServerHealth();
    }, isConnected ? 15000 : 5000);
  }

  // --- View & Navigation Management ---
  function setupNavigation() {
    const navButtons = document.querySelectorAll('.bottom-nav .nav-item');
    navButtons.forEach(btn => {
      btn.addEventListener('click', () => {
        const targetView = btn.getAttribute('data-target');
        const targetModal = btn.getAttribute('data-modal');

        if (targetView) {
          switchView(targetView);
          navButtons.forEach(b => b.classList.remove('active'));
          btn.classList.add('active');
        } else if (targetModal) {
          openModal(targetModal);
        }
      });
    });

    const btnToggleView = document.getElementById('btn-toggle-view');
    if (btnToggleView) {
      btnToggleView.addEventListener('click', () => {
        const currentActive = document.querySelector('.view-panel.active-view');
        if (currentActive && currentActive.id === 'view-embedded') {
          switchView('view-dashboard');
          setActiveNavButton('view-dashboard');
        } else {
          switchView('view-embedded');
          setActiveNavButton('view-embedded');
        }
      });
    }

    const btnRefreshN8n = document.getElementById('btn-refresh-n8n');
    if (btnRefreshN8n) {
      btnRefreshN8n.addEventListener('click', () => {
        checkServerHealth();
        if (elN8nFrame && isConnected) {
          elN8nFrame.src = getBaseUrl();
          showToast('Reloading n8n canvas...');
        }
      });
    }

    const btnOpenMenu = document.getElementById('btn-open-menu');
    if (btnOpenMenu) {
      btnOpenMenu.addEventListener('click', () => {
        openModal('modal-menu-drawer');
      });
    }

    // Dashboard Quick Actions
    const btnDashOpenCanvas = document.getElementById('btn-dash-open-canvas');
    if (btnDashOpenCanvas) {
      btnDashOpenCanvas.addEventListener('click', () => {
        switchView('view-embedded');
        setActiveNavButton('view-embedded');
      });
    }

    const btnDashPing = document.getElementById('btn-dash-ping');
    if (btnDashPing) {
      btnDashPing.addEventListener('click', () => {
        checkServerHealth();
        showToast('Health check requested.');
      });
    }

    const btnDashLogs = document.getElementById('btn-dash-logs');
    if (btnDashLogs) {
      btnDashLogs.addEventListener('click', () => {
        openModal('modal-logs');
      });
    }

    const btnSwitchToDashboard = document.getElementById('btn-switch-to-dashboard');
    if (btnSwitchToDashboard) {
      btnSwitchToDashboard.addEventListener('click', () => {
        switchView('view-dashboard');
        setActiveNavButton('view-dashboard');
      });
    }

    const btnRetryHealth = document.getElementById('btn-retry-health');
    if (btnRetryHealth) {
      btnRetryHealth.addEventListener('click', () => {
        checkServerHealth();
      });
    }
  }

  function switchView(viewId) {
    document.querySelectorAll('.view-panel').forEach(panel => {
      panel.classList.remove('active-view');
    });
    const target = document.getElementById(viewId);
    if (target) {
      target.classList.add('active-view');
      appConfig.activeView = viewId;
      try {
        localStorage.setItem(STORAGE_KEY_CONFIG, JSON.stringify(appConfig));
      } catch (e) {}
    }
  }

  function setActiveNavButton(viewId) {
    document.querySelectorAll('.bottom-nav .nav-item').forEach(btn => {
      if (btn.getAttribute('data-target') === viewId) {
        btn.classList.add('active');
      } else if (btn.getAttribute('data-target')) {
        btn.classList.remove('active');
      }
    });
  }

  // --- Modal & Drawer Management ---
  function setupModals() {
    // Open modal buttons from drawer or links
    document.querySelectorAll('[data-open-modal]').forEach(btn => {
      btn.addEventListener('click', () => {
        const modalId = btn.getAttribute('data-open-modal');
        closeAllModals();
        openModal(modalId);
      });
    });

    // Close buttons inside modals
    document.querySelectorAll('.close-modal-btn').forEach(btn => {
      btn.addEventListener('click', () => {
        const modal = btn.closest('.modal-backdrop');
        if (modal) closeModal(modal.id);
      });
    });

    // Close when clicking on backdrop outside modal-card / drawer-content
    document.querySelectorAll('.modal-backdrop').forEach(backdrop => {
      backdrop.addEventListener('click', (e) => {
        if (e.target === backdrop) {
          closeModal(backdrop.id);
        }
      });
    });

    // Close with Escape key
    document.addEventListener('keydown', (e) => {
      if (e.key === 'Escape') {
        closeAllModals();
      }
    });
  }

  function openModal(modalId) {
    const modal = document.getElementById(modalId);
    if (modal) {
      modal.removeAttribute('hidden');
      modal.setAttribute('aria-hidden', 'false');
      // Focus first actionable element inside
      const focusable = modal.querySelector('button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])');
      if (focusable) focusable.focus();
    }
  }

  function closeModal(modalId) {
    const modal = document.getElementById(modalId);
    if (modal) {
      modal.setAttribute('hidden', '');
      modal.setAttribute('aria-hidden', 'true');
    }
  }

  function closeAllModals() {
    document.querySelectorAll('.modal-backdrop').forEach(modal => {
      modal.setAttribute('hidden', '');
      modal.setAttribute('aria-hidden', 'true');
    });
  }

  // --- Event Listeners & Orchestration ---
  function setupEventListeners() {
    // Config Form Submit
    if (formConfig) {
      formConfig.addEventListener('submit', (e) => {
        e.preventDefault();
        const updated = {
          host: inputHost.value.trim() || '127.0.0.1',
          port: inputPort.value.trim() || '5678',
          protocol: selectProtocol.value,
          webhookPrefix: inputWebhookPrefix.value.trim() || 'webhook',
          authHeader: inputAuthHeader.value.trim(),
          autoConnect: checkAutoConnect.checked,
          ignoreCertErrors: checkIgnoreCert.checked
        };
        saveConfig(updated);
        checkServerHealth();
      });
    }

    // Reset Defaults
    const btnResetDefaults = document.getElementById('btn-reset-defaults');
    if (btnResetDefaults) {
      btnResetDefaults.addEventListener('click', () => {
        saveConfig(DEFAULT_CONFIG);
        initUIFromConfig();
        checkServerHealth();
      });
    }

    // Termux Launch Triggers
    const btnQuickLaunchTermux = document.getElementById('btn-quick-launch-termux');
    if (btnQuickLaunchTermux) {
      btnQuickLaunchTermux.addEventListener('click', triggerTermuxLaunch);
    }

    const btnExecTermuxStart = document.getElementById('btn-exec-termux-start');
    if (btnExecTermuxStart) {
      btnExecTermuxStart.addEventListener('click', triggerTermuxLaunch);
    }

    const btnExecTermuxStop = document.getElementById('btn-exec-termux-stop');
    if (btnExecTermuxStop) {
      btnExecTermuxStop.addEventListener('click', triggerTermuxStop);
    }

    const btnCopyTermuxCmd = document.getElementById('btn-copy-termux-cmd');
    if (btnCopyTermuxCmd) {
      btnCopyTermuxCmd.addEventListener('click', () => {
        const cmd = 'pm2 start n8n --name "n8n-local" -- --tunnel=false';
        copyToClipboard(cmd, 'Termux CLI command copied.');
      });
    }

    // Shizuku Actions
    const btnExecShizukuKeepalive = document.getElementById('btn-exec-shizuku-keepalive');
    if (btnExecShizukuKeepalive) {
      btnExecShizukuKeepalive.addEventListener('click', () => {
        const shizukuCmd = 'device_config put activity_manager max_phantom_processes 2147483647';
        copyToClipboard(shizukuCmd, 'Shizuku ADB command copied. Paste in rish terminal.');
        logEvent('INFO', 'Shizuku keep-alive instructions triggered.');
      });
    }

    const btnCopyShizukuCmd = document.getElementById('btn-copy-shizuku-cmd');
    if (btnCopyShizukuCmd) {
      btnCopyShizukuCmd.addEventListener('click', () => {
        const cmd = `rish -c "am start -n com.termux/.app.TermuxActivity && termux-wake-lock"`;
        copyToClipboard(cmd, 'Shizuku launch command copied.');
      });
    }

    // SSL Script Copy
    const btnCopySslScript = document.getElementById('btn-copy-ssl-script');
    if (btnCopySslScript) {
      btnCopySslScript.addEventListener('click', () => {
        const sslScript = `mkdir -p ~/.n8n-ssl && cd ~/.n8n-ssl && openssl req -x509 -newkey rsa:2048 -nodes -keyout n8n-local.key -out n8n-local.crt -days 3650 -subj "/CN=localhost" -addext "subjectAltName=DNS:localhost,IP:127.0.0.1"`;
        copyToClipboard(sslScript, 'OpenSSL generation script copied.');
      });
    }

    // Webhook Tester
    if (btnFireWebhook) {
      btnFireWebhook.addEventListener('click', handleFireWebhook);
    }

    // Log Clear & Export
    const btnClearLogs = document.getElementById('btn-clear-logs');
    if (btnClearLogs) {
      btnClearLogs.addEventListener('click', () => {
        eventLogs = [];
        saveLogs();
        renderLogs();
        showToast('Logs cleared.');
      });
    }

    const btnExportLogs = document.getElementById('btn-export-logs');
    if (btnExportLogs) {
      btnExportLogs.addEventListener('click', () => {
        const content = eventLogs.join('\n');
        copyToClipboard(content, 'Logs copied to clipboard.');
      });
    }
  }

  // --- Termux Intent Dispatcher ---
  function triggerTermuxLaunch() {
    logEvent('ACTION', 'Dispatching Termux launch intent...');
    const startScriptCommand = 'pm2 start n8n --name "n8n-local" -- --tunnel=false';

    // Attempt to invoke Termux app URL / custom scheme or deep link
    const termuxUrl = 'termux://open';
    const fallbackLink = 'https://f-droid.org/packages/com.termux/';

    // Fallback notification with copyable command
    copyToClipboard(startScriptCommand, 'Command copied. Opening Termux...');

    try {
      window.location.href = termuxUrl;
    } catch (e) {
      console.warn('Could not launch Termux scheme directly', e);
    }

    setTimeout(() => {
      checkServerHealth();
    }, 2500);
  }

  function triggerTermuxStop() {
    logEvent('ACTION', 'Triggering Termux stop command...');
    const stopCmd = 'pm2 stop n8n-local';
    copyToClipboard(stopCmd, 'Stop command copied to clipboard.');
    setTimeout(() => {
      checkServerHealth();
    }, 1500);
  }

  // --- Webhook Tester Handler ---
  async function handleFireWebhook() {
    const method = selectWhMethod.value;
    const path = inputWhPath.value.trim().replace(/^\/+/, '');
    const payloadText = textWhPayload.value.trim();
    const url = `${getBaseUrl()}/${path}`;

    elWhStatus.textContent = 'Sending...';
    elWhStatus.style.color = 'var(--text-secondary)';
    elWhResultBox.style.display = 'block';
    elWhResultContent.textContent = 'Waiting for response from ' + url + '...';

    const options = {
      method: method,
      headers: {
        'Accept': 'application/json, text/plain, */*'
      }
    };

    if (appConfig.authHeader) {
      options.headers['Authorization'] = appConfig.authHeader;
    }

    if (method !== 'GET' && method !== 'HEAD' && payloadText) {
      try {
        JSON.parse(payloadText); // validate JSON syntax
        options.headers['Content-Type'] = 'application/json';
        options.body = payloadText;
      } catch (jsonErr) {
        options.headers['Content-Type'] = 'text/plain';
        options.body = payloadText;
      }
    }

    const startTime = performance.now();
    try {
      const res = await fetch(url, options);
      const elapsed = Math.round(performance.now() - startTime);
      const text = await res.text();

      let formatted = text;
      try {
        const parsed = JSON.parse(text);
        formatted = JSON.stringify(parsed, null, 2);
      } catch (_) {}

      elWhStatus.textContent = `HTTP ${res.status} (${elapsed}ms)`;
      elWhStatus.style.color = res.ok ? 'var(--status-success)' : 'var(--status-danger)';
      elWhResultContent.textContent = formatted || '[Empty Response Body]';
      logEvent(res.ok ? 'SUCCESS' : 'WARN', `Webhook ${method} ${path} -> HTTP ${res.status}`);
    } catch (err) {
      const elapsed = Math.round(performance.now() - startTime);
      elWhStatus.textContent = `Network Error (${elapsed}ms)`;
      elWhStatus.style.color = 'var(--status-danger)';
      elWhResultContent.textContent = `Error: ${err.message}\nMake sure n8n is running at ${getBaseUrl()} and that the Webhook node is Active.`;
      logEvent('ERROR', `Webhook ${method} ${path} failed: ${err.message}`);
    }
  }

  // --- Clipboard & Toast Helpers ---
  function setupClipboardButtons() {
    document.querySelectorAll('.copy-btn').forEach(btn => {
      btn.addEventListener('click', () => {
        const targetId = btn.getAttribute('data-target');
        const targetEl = document.getElementById(targetId);
        if (targetEl) {
          copyToClipboard(targetEl.textContent.trim(), 'Copied to clipboard.');
        }
      });
    });
  }

  function copyToClipboard(text, message) {
    if (navigator.clipboard && navigator.clipboard.writeText) {
      navigator.clipboard.writeText(text).then(() => {
        showToast(message || 'Copied to clipboard.');
      }).catch(() => {
        fallbackCopy(text, message);
      });
    } else {
      fallbackCopy(text, message);
    }
  }

  function fallbackCopy(text, message) {
    const tempInput = document.createElement('textarea');
    tempInput.value = text;
    tempInput.style.position = 'fixed';
    tempInput.style.opacity = '0';
    document.body.appendChild(tempInput);
    tempInput.select();
    try {
      document.execCommand('copy');
      showToast(message || 'Copied to clipboard.');
    } catch (e) {
      showToast('Could not copy to clipboard.');
    }
    document.body.removeChild(tempInput);
  }

  function showToast(msg) {
    if (!elToastContainer) return;
    const toast = document.createElement('div');
    toast.className = 'toast';
    toast.textContent = msg;
    elToastContainer.appendChild(toast);
    setTimeout(() => {
      if (toast.parentNode) {
        toast.parentNode.removeChild(toast);
      }
    }, 3000);
  }

  // --- Logger ---
  function logEvent(level, message) {
    const timestamp = new Date().toLocaleTimeString();
    const entry = `[${timestamp}] [${level}] ${message}`;
    eventLogs.unshift(entry);
    if (eventLogs.length > 80) eventLogs.pop();
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
    if (!elLogConsole) return;
    elLogConsole.textContent = eventLogs.join('\n');
  }

})();
