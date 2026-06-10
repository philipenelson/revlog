type LogContext = Record<string, unknown>;
type Level = "error" | "warn" | "info" | "debug";

const isProduction = process.env.NODE_ENV === "production";

function log(level: Level, message: string, context?: LogContext): void {
  if (isProduction) return;
  if (context) {
    console[level](message, context);
  } else {
    console[level](message);
  }
}

export const logger = {
  error: (message: string, context?: LogContext) => log("error", message, context),
  warn: (message: string, context?: LogContext) => log("warn", message, context),
  info: (message: string, context?: LogContext) => log("info", message, context),
  debug: (message: string, context?: LogContext) => log("debug", message, context),
};
