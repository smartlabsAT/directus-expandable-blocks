import type { Logger, DirectusServices } from '../types/directus-api';

/**
 * Utility to get logger from services or fallback to console
 */
export function getLogger(services?: DirectusServices): Logger {
  return services?.logger || console;
}