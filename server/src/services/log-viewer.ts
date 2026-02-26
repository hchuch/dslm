/**
 * DSLM Log Viewer Service
 * Real-time log streaming via WebSocket
 */

import { WebSocket, WebSocketServer } from 'ws';
import { Server } from 'http';

interface LogEntry {
  timestamp: string;
  level: 'DEBUG' | 'INFO' | 'WARN' | 'ERROR';
  source: 'server' | 'expo' | 'system';
  context: string;
  message: string;
  meta?: object;
}

class LogViewerService {
  private wss: WebSocketServer | null = null;
  private clients: Set<WebSocket> = new Set();
  private logBuffer: LogEntry[] = [];
  private maxBufferSize = 500;

  initialize(server: Server): void {
    this.wss = new WebSocketServer({ server, path: '/ws/logs' });

    this.wss.on('connection', (ws) => {
      this.clients.add(ws);

      // Send buffered logs to new client
      ws.send(JSON.stringify({
        type: 'history',
        logs: this.logBuffer,
      }));

      ws.on('close', () => {
        this.clients.delete(ws);
      });

      ws.on('error', () => {
        this.clients.delete(ws);
      });
    });
  }

  broadcast(entry: LogEntry): void {
    // Add to buffer
    this.logBuffer.push(entry);
    if (this.logBuffer.length > this.maxBufferSize) {
      this.logBuffer.shift();
    }

    // Broadcast to all connected clients
    const message = JSON.stringify({ type: 'log', log: entry });
    for (const client of this.clients) {
      if (client.readyState === WebSocket.OPEN) {
        client.send(message);
      }
    }
  }

  getClientCount(): number {
    return this.clients.size;
  }
}

export const logViewer = new LogViewerService();

// HTML page for the log viewer
export const logViewerHTML = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>DSLM Log Viewer</title>
  <style>
    * {
      box-sizing: border-box;
      margin: 0;
      padding: 0;
    }

    body {
      font-family: 'SF Mono', 'Menlo', 'Monaco', 'Consolas', monospace;
      background: #0d1117;
      color: #c9d1d9;
      height: 100vh;
      display: flex;
      flex-direction: column;
    }

    .header {
      background: #161b22;
      border-bottom: 1px solid #30363d;
      padding: 12px 20px;
      display: flex;
      align-items: center;
      justify-content: space-between;
      flex-shrink: 0;
    }

    .header h1 {
      font-size: 16px;
      font-weight: 600;
      color: #58a6ff;
      display: flex;
      align-items: center;
      gap: 8px;
    }

    .header h1::before {
      content: '';
      width: 8px;
      height: 8px;
      background: #3fb950;
      border-radius: 50%;
      animation: pulse 2s infinite;
    }

    @keyframes pulse {
      0%, 100% { opacity: 1; }
      50% { opacity: 0.5; }
    }

    .controls {
      display: flex;
      gap: 12px;
      align-items: center;
    }

    .filter-group {
      display: flex;
      gap: 4px;
    }

    .filter-btn {
      background: #21262d;
      border: 1px solid #30363d;
      color: #8b949e;
      padding: 6px 12px;
      border-radius: 6px;
      cursor: pointer;
      font-size: 12px;
      font-family: inherit;
      transition: all 0.15s;
    }

    .filter-btn:hover {
      background: #30363d;
      color: #c9d1d9;
    }

    .filter-btn.active {
      background: #388bfd;
      border-color: #388bfd;
      color: #fff;
    }

    .level-filters {
      display: flex;
      gap: 4px;
    }

    .level-btn {
      background: #21262d;
      border: 1px solid #30363d;
      padding: 6px 10px;
      border-radius: 6px;
      cursor: pointer;
      font-size: 11px;
      font-family: inherit;
      transition: all 0.15s;
    }

    .level-btn.debug { color: #8b949e; }
    .level-btn.info { color: #58a6ff; }
    .level-btn.warn { color: #d29922; }
    .level-btn.error { color: #f85149; }

    .level-btn:hover {
      background: #30363d;
    }

    .level-btn.active {
      border-color: currentColor;
      background: #30363d;
    }

    .search-box {
      background: #21262d;
      border: 1px solid #30363d;
      color: #c9d1d9;
      padding: 6px 12px;
      border-radius: 6px;
      font-size: 12px;
      font-family: inherit;
      width: 200px;
    }

    .search-box:focus {
      outline: none;
      border-color: #388bfd;
    }

    .clear-btn {
      background: #21262d;
      border: 1px solid #30363d;
      color: #f85149;
      padding: 6px 12px;
      border-radius: 6px;
      cursor: pointer;
      font-size: 12px;
      font-family: inherit;
      transition: all 0.15s;
    }

    .clear-btn:hover {
      background: #f85149;
      color: #fff;
      border-color: #f85149;
    }

    .log-container {
      flex: 1;
      overflow-y: auto;
      padding: 0;
    }

    .log-entry {
      display: flex;
      padding: 4px 20px;
      border-bottom: 1px solid #21262d;
      font-size: 12px;
      line-height: 1.6;
    }

    .log-entry:hover {
      background: #161b22;
    }

    .log-entry.debug { opacity: 0.7; }
    .log-entry.info .level { color: #58a6ff; }
    .log-entry.warn { background: rgba(210, 153, 34, 0.1); }
    .log-entry.warn .level { color: #d29922; }
    .log-entry.error { background: rgba(248, 81, 73, 0.1); }
    .log-entry.error .level { color: #f85149; }

    .timestamp {
      color: #484f58;
      width: 90px;
      flex-shrink: 0;
    }

    .level {
      width: 40px;
      flex-shrink: 0;
      font-weight: 600;
    }

    .source {
      color: #388bfd;
      width: 60px;
      flex-shrink: 0;
    }

    .context {
      color: #a371f7;
      width: 100px;
      flex-shrink: 0;
    }

    .message {
      flex: 1;
      word-break: break-word;
    }

    .meta {
      color: #484f58;
      margin-left: 8px;
      max-width: 400px;
      overflow: hidden;
      text-overflow: ellipsis;
      white-space: nowrap;
    }

    .status-bar {
      background: #161b22;
      border-top: 1px solid #30363d;
      padding: 8px 20px;
      display: flex;
      justify-content: space-between;
      font-size: 11px;
      color: #8b949e;
      flex-shrink: 0;
    }

    .connection-status {
      display: flex;
      align-items: center;
      gap: 6px;
    }

    .connection-dot {
      width: 6px;
      height: 6px;
      border-radius: 50%;
      background: #f85149;
    }

    .connection-dot.connected {
      background: #3fb950;
    }

    .empty-state {
      display: flex;
      flex-direction: column;
      align-items: center;
      justify-content: center;
      height: 100%;
      color: #484f58;
    }

    .empty-state svg {
      width: 48px;
      height: 48px;
      margin-bottom: 16px;
      opacity: 0.5;
    }
  </style>
</head>
<body>
  <div class="header">
    <h1>DSLM Log Viewer</h1>
    <div class="controls">
      <div class="filter-group">
        <button class="filter-btn active" data-source="all">All</button>
        <button class="filter-btn" data-source="server">Server</button>
        <button class="filter-btn" data-source="expo">Expo</button>
      </div>
      <div class="level-filters">
        <button class="level-btn debug active" data-level="DEBUG">DBG</button>
        <button class="level-btn info active" data-level="INFO">INF</button>
        <button class="level-btn warn active" data-level="WARN">WRN</button>
        <button class="level-btn error active" data-level="ERROR">ERR</button>
      </div>
      <input type="text" class="search-box" placeholder="Filter logs..." id="search">
      <button class="clear-btn" id="clear">Clear</button>
    </div>
  </div>

  <div class="log-container" id="logs">
    <div class="empty-state" id="empty">
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
        <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"></path>
        <polyline points="14 2 14 8 20 8"></polyline>
        <line x1="16" y1="13" x2="8" y2="13"></line>
        <line x1="16" y1="17" x2="8" y2="17"></line>
        <polyline points="10 9 9 9 8 9"></polyline>
      </svg>
      <div>Waiting for logs...</div>
    </div>
  </div>

  <div class="status-bar">
    <div class="connection-status">
      <div class="connection-dot" id="connectionDot"></div>
      <span id="connectionStatus">Connecting...</span>
    </div>
    <div id="logCount">0 logs</div>
  </div>

  <script>
    const logsContainer = document.getElementById('logs');
    const emptyState = document.getElementById('empty');
    const connectionDot = document.getElementById('connectionDot');
    const connectionStatus = document.getElementById('connectionStatus');
    const logCountEl = document.getElementById('logCount');
    const searchInput = document.getElementById('search');
    const clearBtn = document.getElementById('clear');

    let logs = [];
    let filters = {
      source: 'all',
      levels: new Set(['DEBUG', 'INFO', 'WARN', 'ERROR']),
      search: ''
    };
    let autoScroll = true;

    // WebSocket connection
    const wsProtocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
    const ws = new WebSocket(wsProtocol + '//' + window.location.host + '/ws/logs');

    ws.onopen = () => {
      connectionDot.classList.add('connected');
      connectionStatus.textContent = 'Connected';
    };

    ws.onclose = () => {
      connectionDot.classList.remove('connected');
      connectionStatus.textContent = 'Server stopped - closing...';
      // Try to close the window (works if opened programmatically)
      setTimeout(() => {
        window.close();
        // If window.close() didn't work (browser security), show message
        setTimeout(() => {
          document.body.innerHTML = '<div style="display:flex;align-items:center;justify-content:center;height:100vh;flex-direction:column;gap:16px;"><h1 style="color:#f85149;">Server Stopped</h1><p style="color:#8b949e;">You can close this tab.</p></div>';
        }, 500);
      }, 500);
    };

    ws.onmessage = (event) => {
      const data = JSON.parse(event.data);

      if (data.type === 'history') {
        logs = data.logs;
        renderLogs();
      } else if (data.type === 'log') {
        logs.push(data.log);
        if (logs.length > 1000) logs.shift();
        renderLogs();
      }
    };

    function renderLogs() {
      const filtered = logs.filter(log => {
        if (filters.source !== 'all' && log.source !== filters.source) return false;
        if (!filters.levels.has(log.level)) return false;
        if (filters.search) {
          const searchLower = filters.search.toLowerCase();
          return log.message.toLowerCase().includes(searchLower) ||
                 log.context.toLowerCase().includes(searchLower) ||
                 (log.meta && JSON.stringify(log.meta).toLowerCase().includes(searchLower));
        }
        return true;
      });

      logCountEl.textContent = filtered.length + ' logs';

      if (filtered.length === 0) {
        emptyState.style.display = 'flex';
        logsContainer.querySelectorAll('.log-entry').forEach(el => el.remove());
        return;
      }

      emptyState.style.display = 'none';

      // Check if scrolled to bottom before update
      const wasAtBottom = logsContainer.scrollHeight - logsContainer.scrollTop <= logsContainer.clientHeight + 50;

      // Clear and re-render
      logsContainer.querySelectorAll('.log-entry').forEach(el => el.remove());

      const fragment = document.createDocumentFragment();
      filtered.forEach(log => {
        const entry = document.createElement('div');
        entry.className = 'log-entry ' + log.level.toLowerCase();

        const metaStr = log.meta ? JSON.stringify(log.meta) : '';

        entry.innerHTML = \`
          <span class="timestamp">\${log.timestamp}</span>
          <span class="level">\${log.level.substring(0, 3)}</span>
          <span class="source">\${log.source}</span>
          <span class="context">\${log.context}</span>
          <span class="message">\${escapeHtml(log.message)}</span>
          \${metaStr ? '<span class="meta">' + escapeHtml(metaStr) + '</span>' : ''}
        \`;

        fragment.appendChild(entry);
      });

      logsContainer.appendChild(fragment);

      // Auto-scroll if was at bottom
      if (wasAtBottom && autoScroll) {
        logsContainer.scrollTop = logsContainer.scrollHeight;
      }
    }

    function escapeHtml(text) {
      const div = document.createElement('div');
      div.textContent = text;
      return div.innerHTML;
    }

    // Source filter buttons
    document.querySelectorAll('.filter-btn').forEach(btn => {
      btn.addEventListener('click', () => {
        document.querySelectorAll('.filter-btn').forEach(b => b.classList.remove('active'));
        btn.classList.add('active');
        filters.source = btn.dataset.source;
        renderLogs();
      });
    });

    // Level filter buttons
    document.querySelectorAll('.level-btn').forEach(btn => {
      btn.addEventListener('click', () => {
        btn.classList.toggle('active');
        const level = btn.dataset.level;
        if (filters.levels.has(level)) {
          filters.levels.delete(level);
        } else {
          filters.levels.add(level);
        }
        renderLogs();
      });
    });

    // Search
    searchInput.addEventListener('input', (e) => {
      filters.search = e.target.value;
      renderLogs();
    });

    // Clear
    clearBtn.addEventListener('click', () => {
      logs = [];
      renderLogs();
    });

    // Detect manual scroll
    logsContainer.addEventListener('scroll', () => {
      const atBottom = logsContainer.scrollHeight - logsContainer.scrollTop <= logsContainer.clientHeight + 50;
      autoScroll = atBottom;
    });
  </script>
</body>
</html>`;
