#!/usr/bin/env node

import { spawn } from 'child_process';
import { createInterface } from 'readline';
import { readFileSync } from 'fs';
import { networkInterfaces } from 'os';
import { fileURLToPath } from 'url';
import { dirname, resolve } from 'path';
import http from 'http';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const ROOT = resolve(__dirname, '..');
const SERVER_DIR = resolve(ROOT, 'server');

// Read app slug from app.json for constructing dev client URLs
let appSlug = 'dslm';
try {
  const appJson = JSON.parse(readFileSync(resolve(ROOT, 'app.json'), 'utf8'));
  appSlug = appJson.expo?.slug || appJson.expo?.name || appSlug;
} catch {}


// ─── CLI Parsing ─────────────────────────────────────────────────────────────

const args = process.argv.slice(2);
function hasFlag(name) {
  return args.includes(`--${name}`);
}
function getFlagValue(name, fallback) {
  const idx = args.indexOf(`--${name}`);
  if (idx === -1 || idx + 1 >= args.length) return fallback;
  return args[idx + 1];
}

const opts = {
  tunnel: hasFlag('tunnel'),
  ngrok: hasFlag('ngrok'),
  port: parseInt(getFlagValue('port', '4000'), 10),
  expo: !hasFlag('no-expo'),
  server: !hasFlag('no-server'),
};

// ─── State ───────────────────────────────────────────────────────────────────

const BUFFER_SIZE = 200;

class RingBuffer {
  constructor(size) {
    this.size = size;
    this.buf = [];
  }
  push(line) {
    this.buf.push(line);
    if (this.buf.length > this.size) this.buf.shift();
  }
  last(n) {
    return this.buf.slice(-n);
  }
}

const procs = {
  server: { proc: null, status: 'stopped', log: new RingBuffer(BUFFER_SIZE), label: 'API Server' },
  expo: { proc: null, status: 'stopped', log: new RingBuffer(BUFFER_SIZE), label: 'Expo' },
  ngrok: { proc: null, status: 'stopped', log: new RingBuffer(BUFFER_SIZE), label: 'Ngrok' },
};

let ngrokUrl = null;
let expoUrl = null;
let expoMetroPort = null;
let currentView = 'dashboard'; // 'dashboard' | '1' | '2' | '3'
let qrcodeTerminal = null;
let shuttingDown = false;

// ─── Helpers ─────────────────────────────────────────────────────────────────

function getLocalIP() {
  const nets = networkInterfaces();
  for (const name of Object.keys(nets)) {
    for (const net of nets[name]) {
      if (net.family === 'IPv4' && !net.internal) return net.address;
    }
  }
  return '127.0.0.1';
}

const localIP = getLocalIP();

const C = {
  reset: '\x1b[0m',
  bold: '\x1b[1m',
  dim: '\x1b[2m',
  red: '\x1b[31m',
  green: '\x1b[32m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  cyan: '\x1b[36m',
  white: '\x1b[37m',
  bgBlue: '\x1b[44m',
  clear: '\x1b[2J\x1b[H',
};

function statusIcon(status) {
  switch (status) {
    case 'running': return `${C.green}\u25cf running${C.reset}`;
    case 'starting': return `${C.yellow}\u25cf starting${C.reset}`;
    case 'stopped': return `${C.dim}\u25cb stopped${C.reset}`;
    case 'crashed': return `${C.red}\u25cf crashed${C.reset}`;
    default: return `${C.dim}? ${status}${C.reset}`;
  }
}

function clearScreen() {
  process.stdout.write(C.clear);
}

// ─── QR Code ─────────────────────────────────────────────────────────────────

async function loadQRCode() {
  try {
    qrcodeTerminal = (await import('qrcode-terminal')).default;
  } catch {
    // qrcode-terminal not installed, skip QR display
  }
}

function generateQR(url) {
  return new Promise((res) => {
    if (!qrcodeTerminal) {
      res(null);
      return;
    }
    qrcodeTerminal.generate(url, { small: true }, (qr) => res(qr));
  });
}

// ─── Process Spawning ────────────────────────────────────────────────────────

function appendLog(key, data) {
  const lines = data.toString().split('\n');
  for (const line of lines) {
    if (line.trim()) procs[key].log.push(line);
  }
}

function startServer() {
  if (!opts.server) return;
  procs.server.status = 'starting';

  const proc = spawn('npm', ['run', 'dev'], {
    cwd: SERVER_DIR,
    stdio: ['pipe', 'pipe', 'pipe'],
    env: { ...process.env, PORT: String(opts.port) },
  });

  procs.server.proc = proc;

  proc.stdout.on('data', (data) => {
    appendLog('server', data);
    const text = data.toString();
    if (text.includes('listening') || text.includes('started') || text.includes('ready') || text.includes(`${opts.port}`)) {
      procs.server.status = 'running';
      refreshView();
    }
  });

  proc.stderr.on('data', (data) => appendLog('server', data));

  proc.on('close', (code) => {
    if (!shuttingDown) {
      procs.server.status = code === 0 ? 'stopped' : 'crashed';
      procs.server.log.push(`[process exited with code ${code}]`);
      refreshView();
    }
  });

  // Assume running after a short delay if we haven't detected it
  setTimeout(() => {
    if (procs.server.status === 'starting') {
      procs.server.status = 'running';
      refreshView();
    }
  }, 5000);
}

function startExpo() {
  if (!opts.expo) return;
  procs.expo.status = 'starting';

  const expoArgs = ['start'];
  if (opts.tunnel) expoArgs.push('--tunnel');

  // Run Expo CLI directly (not via npx) so we can patch isTTY without
  // affecting npm/npx's own display code. The --require preload makes
  // Expo think it's in a TTY so it shows the QR code and dev client URL.
  const patchPath = resolve(__dirname, 'patch-tty.cjs');
  const expoCli = resolve(ROOT, 'node_modules/expo/bin/cli');
  const proc = spawn(process.execPath, ['--require', patchPath, expoCli, ...expoArgs], {
    cwd: ROOT,
    stdio: ['pipe', 'pipe', 'pipe'],
    env: { ...process.env, FORCE_COLOR: '1' },
  });

  procs.expo.proc = proc;

  const handleExpoOutput = (data) => {
    appendLog('expo', data);
    const text = data.toString();
    // Auto-answer prompts
    if (text.includes('Use port') || text.includes('already in use')) {
      proc.stdin.write('Y\n');
    }
    // Strip ANSI codes for URL/status matching (Expo uses color/underline on URLs)
    const plain = text.replace(/\x1b\[[0-9;]*m/g, '');
    if (!expoUrl) {
      // Try full dev client URL first (TTY mode)
      const metroMatch = plain.match(/Metro waiting on\s+(exp\S+)/);
      if (metroMatch) {
        expoUrl = metroMatch[1];
        refreshView();
      } else {
        // Non-TTY: "Waiting on <url>" — construct dev client URL with LAN IP
        const waitMatch = plain.match(/Waiting on\s+(https?:\/\/\S+)/);
        if (waitMatch) {
          let metroUrl = waitMatch[1];
          // Replace localhost/127.0.0.1 with LAN IP for device access
          metroUrl = metroUrl.replace('localhost', localIP).replace('127.0.0.1', localIP);
          // Save metro port for tunnel URL discovery
          try { expoMetroPort = new URL(metroUrl).port || '8081'; } catch { expoMetroPort = '8081'; }
          expoUrl = `exp+${appSlug}://expo-development-client/?url=${encodeURIComponent(metroUrl)}`;
          refreshView();
          // If tunnel mode, try to discover the actual tunnel URL
          if (opts.tunnel) {
            setTimeout(pollExpoTunnelUrl, 2000);
          }
        }
      }
    }
    if (plain.includes('Metro waiting') || plain.includes('Waiting on') || plain.includes('Logs for your project') || plain.includes('development build') || plain.includes('Bundler is ready') || plain.includes('Tunnel ready')) {
      procs.expo.status = 'running';
      refreshView();
    }
  };

  proc.stdout.on('data', handleExpoOutput);
  proc.stderr.on('data', handleExpoOutput);

  proc.on('close', (code) => {
    if (!shuttingDown) {
      procs.expo.status = code === 0 ? 'stopped' : 'crashed';
      procs.expo.log.push(`[process exited with code ${code}]`);
      refreshView();
    }
  });

  setTimeout(() => {
    if (procs.expo.status === 'starting') {
      procs.expo.status = 'running';
      refreshView();
    }
  }, 15000);
}

function startNgrok() {
  if (!opts.ngrok) return;
  procs.ngrok.status = 'starting';

  const proc = spawn('ngrok', ['http', String(opts.port), '--log=stdout'], {
    cwd: ROOT,
    stdio: ['pipe', 'pipe', 'pipe'],
  });

  procs.ngrok.proc = proc;

  proc.stdout.on('data', (data) => {
    appendLog('ngrok', data);
    const text = data.toString();
    if (text.includes('started tunnel') || text.includes('url=')) {
      procs.ngrok.status = 'running';
      pollNgrokUrl();
    }
  });

  proc.stderr.on('data', (data) => appendLog('ngrok', data));

  proc.on('close', (code) => {
    if (!shuttingDown) {
      procs.ngrok.status = code === 0 ? 'stopped' : 'crashed';
      procs.ngrok.log.push(`[process exited with code ${code}]`);
      refreshView();
    }
  });

  // Poll for ngrok URL after a delay
  setTimeout(() => {
    if (procs.ngrok.status === 'starting') {
      procs.ngrok.status = 'running';
    }
    pollNgrokUrl();
  }, 3000);
}

function pollNgrokUrl() {
  const req = http.get('http://localhost:4040/api/tunnels', (res) => {
    let body = '';
    res.on('data', (chunk) => body += chunk);
    res.on('end', () => {
      try {
        const data = JSON.parse(body);
        const tunnel = data.tunnels?.find(t => t.proto === 'https') || data.tunnels?.[0];
        if (tunnel) {
          ngrokUrl = tunnel.public_url;
          refreshView();
        }
      } catch {}
    });
  });
  req.on('error', () => {
    // Retry after a bit
    setTimeout(pollNgrokUrl, 2000);
  });
}

function pollExpoTunnelUrl(retries = 5) {
  if (!expoMetroPort || retries <= 0) return;
  // Query Expo dev server — when tunnel is active, the response headers
  // or a redirect may reveal the tunnel URL
  const req = http.get(`http://localhost:${expoMetroPort}`, (res) => {
    let body = '';
    res.on('data', (chunk) => body += chunk);
    res.on('end', () => {
      // Look for exp.direct or tunnel URL in response body/headers
      const tunnelMatch = body.match(/(https?:\/\/[^\s"']+\.exp\.direct[^\s"']*)/);
      if (tunnelMatch) {
        const tunnelUrl = tunnelMatch[1];
        expoUrl = `exp+${appSlug}://expo-development-client/?url=${encodeURIComponent(tunnelUrl)}`;
        refreshView();
      } else {
        // Retry — tunnel may not be fully propagated yet
        setTimeout(() => pollExpoTunnelUrl(retries - 1), 3000);
      }
    });
  });
  req.on('error', () => {
    setTimeout(() => pollExpoTunnelUrl(retries - 1), 3000);
  });
}

// ─── Display ─────────────────────────────────────────────────────────────────

function stripAnsi(s) {
  return s.replace(/\x1b\[[0-9;]*m/g, '');
}

async function renderDashboard() {
  clearScreen();

  const W = 72;
  const line = '\u2550'.repeat(W);
  const pad = (s, w) => {
    const remaining = w - stripAnsi(s).length;
    return remaining > 0 ? s + ' '.repeat(remaining) : s;
  };
  const boxLine = (content) => `${C.cyan}\u2551${C.reset}${pad(content, W)}${C.cyan}\u2551${C.reset}`;
  const center = (s, w) => {
    const len = stripAnsi(s).length;
    const left = Math.floor((w - len) / 2);
    const right = w - len - left;
    return ' '.repeat(Math.max(0, left)) + s + ' '.repeat(Math.max(0, right));
  };

  const rows = [];
  rows.push(`${C.cyan}\u2554${line}\u2557${C.reset}`);
  rows.push(boxLine(center(`${C.bold}DSLM Dev Environment${C.reset}`, W)));
  rows.push(`${C.cyan}\u2560${line}\u2563${C.reset}`);

  // Process status
  if (opts.server) {
    rows.push(boxLine(`  [1] API Server    ${statusIcon(procs.server.status)}  :${opts.port}`));
  }
  if (opts.expo) {
    rows.push(boxLine(`  [2] Expo          ${statusIcon(procs.expo.status)}`));
  }
  if (opts.ngrok) {
    rows.push(boxLine(`  [3] Ngrok         ${statusIcon(procs.ngrok.status)}`));
  }

  rows.push(`${C.cyan}\u2560${line}\u2563${C.reset}`);

  // URLs
  if (opts.server) {
    rows.push(boxLine(`  ${C.dim}Local API:${C.reset}  http://${localIP}:${opts.port}`));
  }
  if (ngrokUrl) {
    rows.push(boxLine(`  ${C.dim}Ngrok API:${C.reset}  ${ngrokUrl}`));
  }
  if (expoUrl) {
    rows.push(boxLine(`  ${C.dim}Expo:${C.reset}       ${expoUrl}`));
  }

  rows.push(boxLine(''));

  // QR codes — side by side when both present
  const qrEntries = [];
  if (expoUrl) qrEntries.push({ label: 'Expo Dev Server', url: expoUrl });
  if (ngrokUrl) qrEntries.push({ label: 'Ngrok API', url: ngrokUrl });

  const qrBlocks = [];
  for (const entry of qrEntries) {
    const qr = await generateQR(entry.url);
    if (qr) {
      const qrLines = qr.split('\n').filter(l => l.length > 0);
      qrBlocks.push({ label: entry.label, lines: qrLines });
    }
  }

  if (qrBlocks.length === 2) {
    // Side-by-side layout
    const COL_W = Math.floor((W - 6) / 2); // 2 margin + 2 gap + 2 margin
    const GAP = 4;

    // Labels
    const lbl0 = center(`${C.bold}${qrBlocks[0].label}${C.reset}`, COL_W);
    const lbl1 = center(`${C.bold}${qrBlocks[1].label}${C.reset}`, COL_W);
    rows.push(boxLine(`  ${lbl0}${' '.repeat(GAP)}${lbl1}  `));

    // QR lines merged side by side
    const maxLines = Math.max(qrBlocks[0].lines.length, qrBlocks[1].lines.length);
    for (let i = 0; i < maxLines; i++) {
      const left = i < qrBlocks[0].lines.length ? qrBlocks[0].lines[i] : '';
      const right = i < qrBlocks[1].lines.length ? qrBlocks[1].lines[i] : '';
      const leftPad = COL_W - stripAnsi(left).length;
      const rightStr = right;
      const combined = `  ${left}${' '.repeat(Math.max(0, leftPad))}${' '.repeat(GAP)}${rightStr}`;
      rows.push(boxLine(combined));
    }
    rows.push(boxLine(''));
  } else if (qrBlocks.length === 1) {
    // Single QR centered
    rows.push(boxLine(center(`${C.bold}${qrBlocks[0].label}${C.reset}`, W)));
    for (const qrLine of qrBlocks[0].lines) {
      rows.push(boxLine(`  ${qrLine}`));
    }
    rows.push(boxLine(''));
  }

  // Key hints
  const keys = [];
  if (opts.server) keys.push('1');
  if (opts.expo) keys.push('2');
  if (opts.ngrok) keys.push('3');
  const keyRange = keys.length > 0 ? `${keys[0]}-${keys[keys.length - 1]} logs` : '';
  const hint = `Keys: ${keyRange} | s status | q quit`;
  rows.push(boxLine(`  ${C.dim}${hint}${C.reset}`));
  rows.push(`${C.cyan}\u255a${line}\u255d${C.reset}`);

  console.log(rows.join('\n'));
}

function renderLog(key) {
  clearScreen();
  const p = procs[key];
  console.log(`${C.bold}${C.cyan}── ${p.label} Log ── ${statusIcon(p.status)} ${C.dim}(press s for dashboard, q to quit)${C.reset}`);
  console.log();
  const lines = p.log.last(50);
  if (lines.length === 0) {
    console.log(`${C.dim}  No output yet...${C.reset}`);
  } else {
    for (const line of lines) {
      console.log(`  ${line}`);
    }
  }
}

function refreshView() {
  if (shuttingDown) return;
  switch (currentView) {
    case 'dashboard': renderDashboard(); break;
    case '1': renderLog('server'); break;
    case '2': renderLog('expo'); break;
    case '3': renderLog('ngrok'); break;
  }
}

// ─── Input Handling ──────────────────────────────────────────────────────────

function setupInput() {
  if (!process.stdin.isTTY) return;

  process.stdin.setRawMode(true);
  process.stdin.resume();
  process.stdin.setEncoding('utf8');

  process.stdin.on('data', (key) => {
    // Ctrl+C
    if (key === '\u0003') {
      shutdown();
      return;
    }

    switch (key) {
      case '1':
        if (opts.server) { currentView = '1'; renderLog('server'); }
        break;
      case '2':
        if (opts.expo) { currentView = '2'; renderLog('expo'); }
        break;
      case '3':
        if (opts.ngrok) { currentView = '3'; renderLog('ngrok'); }
        break;
      case 's':
        currentView = 'dashboard';
        renderDashboard();
        break;
      case 'q':
        shutdown();
        break;
    }
  });
}

// ─── Shutdown ────────────────────────────────────────────────────────────────

async function shutdown() {
  if (shuttingDown) return;
  shuttingDown = true;

  clearScreen();
  console.log(`\n${C.yellow}Shutting down...${C.reset}\n`);

  const active = Object.values(procs).filter(p => p.proc && !p.proc.killed);

  // Send SIGTERM
  for (const p of active) {
    try {
      p.proc.kill('SIGTERM');
      console.log(`  ${C.dim}Sent SIGTERM to ${p.label}${C.reset}`);
    } catch {}
  }

  // Wait 2s then SIGKILL stragglers
  await new Promise(r => setTimeout(r, 2000));

  for (const p of active) {
    try {
      if (!p.proc.killed) {
        p.proc.kill('SIGKILL');
        console.log(`  ${C.red}Sent SIGKILL to ${p.label}${C.reset}`);
      }
    } catch {}
  }

  console.log(`\n${C.green}Goodbye!${C.reset}\n`);

  if (process.stdin.isTTY) {
    process.stdin.setRawMode(false);
  }
  process.exit(0);
}

process.on('SIGINT', shutdown);
process.on('SIGTERM', shutdown);

// ─── Main ────────────────────────────────────────────────────────────────────

async function main() {
  await loadQRCode();

  // Start processes
  startServer();
  startExpo();
  startNgrok();

  // Show dashboard
  await renderDashboard();

  // Set up interactive input
  setupInput();

  // Periodic refresh while on dashboard
  setInterval(() => {
    if (currentView === 'dashboard') renderDashboard();
  }, 10000);
}

main().catch((err) => {
  console.error('Fatal error:', err);
  process.exit(1);
});
