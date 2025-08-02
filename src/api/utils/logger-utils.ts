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

/**
 * Create a service-specific logger with automatic prefixing
 * @param serviceName The name of the service
 * @param services Directus services
 * @returns Logger with service name prefix
 */
export function createServiceLogger(
  serviceName: string, 
  services?: DirectusServices
): Logger {
  const logger = getLogger(services);
  
  return {
    info: (msg: string, ...args: any[]) => logger.info(`[${serviceName}] ${msg}`, ...args),
    error: (msg: string, ...args: any[]) => logger.error(`[${serviceName}] ${msg}`, ...args),
    warn: (msg: string, ...args: any[]) => logger.warn(`[${serviceName}] ${msg}`, ...args),
    debug: (msg: string, ...args: any[]) => logger.debug(`[${serviceName}] ${msg}`, ...args),
    trace: logger.trace ? ((msg: string, ...args: any[]) => logger.trace!(`[${serviceName}] ${msg}`, ...args)) : () => {},
    fatal: logger.fatal ? ((msg: string, ...args: any[]) => logger.fatal!(`[${serviceName}] ${msg}`, ...args)) : () => {}
  };
}