/**
 * DSLM Server Logger
 * Professional, color-coded logging with consistent formatting
 */

import { logViewer } from './log-viewer';

// ANSI color codes
const colors = {
  reset: '\x1b[0m',
  bright: '\x1b[1m',
  dim: '\x1b[2m',

  // Foreground
  black: '\x1b[30m',
  red: '\x1b[31m',
  green: '\x1b[32m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  magenta: '\x1b[35m',
  cyan: '\x1b[36m',
  white: '\x1b[37m',
  gray: '\x1b[90m',

  // Background
  bgRed: '\x1b[41m',
  bgGreen: '\x1b[42m',
  bgYellow: '\x1b[43m',
  bgBlue: '\x1b[44m',
};

type LogLevel = 'DEBUG' | 'INFO' | 'WARN' | 'ERROR';

const levelColors: Record<LogLevel, string> = {
  DEBUG: colors.gray,
  INFO: colors.cyan,
  WARN: colors.yellow,
  ERROR: colors.red,
};

const levelLabels: Record<LogLevel, string> = {
  DEBUG: 'DBG',
  INFO: 'INF',
  WARN: 'WRN',
  ERROR: 'ERR',
};

function formatTimestamp(): string {
  const now = new Date();
  const hours = now.getHours().toString().padStart(2, '0');
  const minutes = now.getMinutes().toString().padStart(2, '0');
  const seconds = now.getSeconds().toString().padStart(2, '0');
  const ms = now.getMilliseconds().toString().padStart(3, '0');
  return `${hours}:${minutes}:${seconds}.${ms}`;
}

function formatMessage(level: LogLevel, context: string, message: string, meta?: object): string {
  const timestamp = formatTimestamp();
  const levelColor = levelColors[level];
  const levelLabel = levelLabels[level];

  let output = `${colors.gray}${timestamp}${colors.reset} `;
  output += `${levelColor}${levelLabel}${colors.reset} `;
  output += `${colors.bright}${colors.blue}[DSLM-SERVER]${colors.reset} `;
  output += `${colors.magenta}${context}${colors.reset} `;
  output += message;

  if (meta && Object.keys(meta).length > 0) {
    output += ` ${colors.dim}${JSON.stringify(meta)}${colors.reset}`;
  }

  return output;
}

class Logger {
  private context: string;
  private debugEnabled: boolean;

  constructor(context: string = 'app') {
    this.context = context;
    this.debugEnabled = process.env.DEBUG === 'true' || process.env.NODE_ENV === 'development';
  }

  private broadcast(level: LogLevel, message: string, meta?: object): void {
    try {
      logViewer.broadcast({
        timestamp: formatTimestamp(),
        level,
        source: 'server',
        context: this.context,
        message,
        meta,
      });
    } catch {
      // Ignore broadcast errors (e.g., before WebSocket is initialized)
    }
  }

  debug(message: string, meta?: object): void {
    if (this.debugEnabled) {
      console.log(formatMessage('DEBUG', this.context, message, meta));
      this.broadcast('DEBUG', message, meta);
    }
  }

  info(message: string, meta?: object): void {
    console.log(formatMessage('INFO', this.context, message, meta));
    this.broadcast('INFO', message, meta);
  }

  warn(message: string, meta?: object): void {
    console.warn(formatMessage('WARN', this.context, message, meta));
    this.broadcast('WARN', message, meta);
  }

  error(message: string, error?: Error | unknown, meta?: object): void {
    const errorMeta = error instanceof Error
      ? { ...meta, error: error.message, stack: error.stack?.split('\n').slice(0, 3).join(' | ') }
      : { ...meta, error: String(error) };
    console.error(formatMessage('ERROR', this.context, message, errorMeta));
    this.broadcast('ERROR', message, errorMeta);
  }

  // Create a child logger with a different context
  child(context: string): Logger {
    return new Logger(`${this.context}:${context}`);
  }
}

// Pre-configured loggers for different modules
export const logger = new Logger('server');

export function createLogger(context: string): Logger {
  return new Logger(context);
}

// HTTP request logging
export function formatRequest(method: string, path: string, statusCode: number, duration: number): string {
  const statusColor = statusCode >= 500 ? colors.red
    : statusCode >= 400 ? colors.yellow
    : statusCode >= 300 ? colors.cyan
    : colors.green;

  const methodColor = {
    GET: colors.green,
    POST: colors.blue,
    PUT: colors.yellow,
    PATCH: colors.yellow,
    DELETE: colors.red,
  }[method] || colors.white;

  const timestamp = formatTimestamp();

  // Broadcast to log viewer
  try {
    logViewer.broadcast({
      timestamp,
      level: statusCode >= 500 ? 'ERROR' : statusCode >= 400 ? 'WARN' : 'INFO',
      source: 'server',
      context: 'http',
      message: `${method} ${path}`,
      meta: { status: statusCode, duration: `${duration}ms` },
    });
  } catch {
    // Ignore broadcast errors
  }

  return `${colors.gray}${timestamp}${colors.reset} ` +
    `${colors.cyan}INF${colors.reset} ` +
    `${colors.bright}${colors.blue}[DSLM-SERVER]${colors.reset} ` +
    `${colors.magenta}http${colors.reset} ` +
    `${methodColor}${method.padEnd(6)}${colors.reset} ` +
    `${path} ` +
    `${statusColor}${statusCode}${colors.reset} ` +
    `${colors.gray}${duration}ms${colors.reset}`;
}

// Startup banner
export function printStartupBanner(port: number): void {
  const line = '─'.repeat(50);

  console.log('');
  console.log(`${colors.blue}${line}${colors.reset}`);
  console.log(`${colors.bright}${colors.blue}  DSLM Server${colors.reset}`);
  console.log(`${colors.gray}  Deep Space Logistics Module - API Server${colors.reset}`);
  console.log(`${colors.blue}${line}${colors.reset}`);
  console.log('');
  console.log(`  ${colors.green}Status${colors.reset}    Running`);
  console.log(`  ${colors.green}Port${colors.reset}      ${port}`);
  console.log(`  ${colors.green}Health${colors.reset}    http://localhost:${port}/health`);
  console.log(`  ${colors.green}Logs${colors.reset}      http://localhost:${port}/logs`);
  console.log('');
  console.log(`  ${colors.cyan}Endpoints${colors.reset}`);
  console.log(`  ${colors.gray}├─${colors.reset} POST   /api/auth/login`);
  console.log(`  ${colors.gray}├─${colors.reset} GET    /api/categories`);
  console.log(`  ${colors.gray}├─${colors.reset} GET    /api/ctbs`);
  console.log(`  ${colors.gray}├─${colors.reset} GET    /api/items`);
  console.log(`  ${colors.gray}├─${colors.reset} GET    /api/shipments`);
  console.log(`  ${colors.gray}├─${colors.reset} POST   /api/sync/push`);
  console.log(`  ${colors.gray}└─${colors.reset} GET    /api/users ${colors.dim}(admin)${colors.reset}`);
  console.log('');
  console.log(`${colors.blue}${line}${colors.reset}`);
  console.log('');
}

// Shutdown message
export function printShutdownMessage(): void {
  console.log('');
  logger.info('Server shutting down gracefully...');
}

export default logger;
