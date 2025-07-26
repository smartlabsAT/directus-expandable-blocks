/**
 * Utility to get logger from services or fallback to console
 */
export function getLogger(services?: any): any {
  return services?.logger || console;
}