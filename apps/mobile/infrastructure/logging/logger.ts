type LogContext = Record<string, unknown>;
type Level = 'error' | 'warn' | 'info' | 'debug';

// Same V1 strategy as web (apps/web/src/infrastructure/logging/logger.ts):
// dev console, silent in production. __DEV__ is RN's own dev-build flag.
function log(level: Level, message: string, context?: LogContext): void {
  if (!__DEV__) return;
  if (context) {
    console[level](message, context);
  } else {
    console[level](message);
  }
}

export const logger = {
  error: (message: string, context?: LogContext) => log('error', message, context),
  warn: (message: string, context?: LogContext) => log('warn', message, context),
  info: (message: string, context?: LogContext) => log('info', message, context),
  debug: (message: string, context?: LogContext) => log('debug', message, context),
};
