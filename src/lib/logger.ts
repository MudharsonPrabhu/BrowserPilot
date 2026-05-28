/**
 * Structured JSON logger for BrowserPilot.
 * Outputs structured log entries with timestamps, levels, and context.
 */

export type LogLevel = 'debug' | 'info' | 'warn' | 'error' | 'fatal';

interface LogEntry {
  timestamp: string;
  level: LogLevel;
  message: string;
  component: string;
  context?: Record<string, unknown>;
  error?: {
    name: string;
    message: string;
    stack?: string;
  };
}

const LOG_LEVELS: Record<LogLevel, number> = {
  debug: 0,
  info: 1,
  warn: 2,
  error: 3,
  fatal: 4,
};

const currentLevel: LogLevel = (process.env.LOG_LEVEL as LogLevel) || 'info';

function shouldLog(level: LogLevel): boolean {
  return LOG_LEVELS[level] >= LOG_LEVELS[currentLevel];
}

function formatEntry(entry: LogEntry): string {
  return JSON.stringify(entry);
}

function createEntry(
  level: LogLevel,
  component: string,
  message: string,
  context?: Record<string, unknown>,
  error?: Error
): LogEntry {
  const entry: LogEntry = {
    timestamp: new Date().toISOString(),
    level,
    message,
    component,
  };

  if (context && Object.keys(context).length > 0) {
    entry.context = context;
  }

  if (error) {
    entry.error = {
      name: error.name,
      message: error.message,
      stack: error.stack,
    };
  }

  return entry;
}

export function createLogger(component: string) {
  const log = (
    level: LogLevel,
    message: string,
    context?: Record<string, unknown>,
    error?: Error
  ) => {
    if (!shouldLog(level)) return;

    const entry = createEntry(level, component, message, context, error);
    const formatted = formatEntry(entry);

    switch (level) {
      case 'debug':
        console.debug(formatted);
        break;
      case 'info':
        console.info(formatted);
        break;
      case 'warn':
        console.warn(formatted);
        break;
      case 'error':
      case 'fatal':
        console.error(formatted);
        break;
    }

    return entry;
  };

  return {
    debug: (message: string, context?: Record<string, unknown>) =>
      log('debug', message, context),
    info: (message: string, context?: Record<string, unknown>) =>
      log('info', message, context),
    warn: (message: string, context?: Record<string, unknown>) =>
      log('warn', message, context),
    error: (message: string, context?: Record<string, unknown>, error?: Error) =>
      log('error', message, context, error),
    fatal: (message: string, context?: Record<string, unknown>, error?: Error) =>
      log('fatal', message, context, error),
  };
}

export type Logger = ReturnType<typeof createLogger>;
