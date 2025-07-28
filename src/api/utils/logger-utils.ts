import type { Logger, DirectusServices } from '../types/directus-api';

/**
 * No-op logger implementation for when no logger is available
 */
const noOpLogger: Logger = {
  info: () => {},
  warn: () => {},
  error: () => {},
  debug: () => {},
  trace: () => {},
  fatal: () => {}
};

/**
 * Utility to get logger from services or fallback to no-op logger
 */
export function getLogger(services?: DirectusServices): Logger {
  return services?.logger || noOpLogger;
}