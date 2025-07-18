import { logger } from './logger';

/**
 * Logger wrapper functions to reduce code duplication and standardize logging patterns
 */

// Re-export logger for backward compatibility
export { logger };

/**
 * Log an action with automatic formatting and timestamp
 */
export function logAction(action: string, data?: Record<string, any>): void {
  logger.log(`🔄 ${action}:`, {
    timestamp: new Date().toISOString(),
    ...data
  });
}

/**
 * Log a debug message with context
 */
export function logDebug(message: string, context?: Record<string, any>): void {
  logger.debug(message, context || {});
}

/**
 * Log a warning with context
 */
export function logWarn(message: string, context?: Record<string, any>): void {
  logger.warn(message, context || {});
}

/**
 * Log an error with context
 */
export function logError(message: string, error?: Error | any, context?: Record<string, any>): void {
  logger.error(message, {
    error: error?.message || error,
    stack: error?.stack,
    ...context
  });
}

/**
 * Log a state change
 */
export function logStateChange(stateName: string, oldValue: any, newValue: any, context?: Record<string, any>): void {
  logger.log(`📝 STATE CHANGE - ${stateName}:`, {
    oldValue,
    newValue,
    timestamp: new Date().toISOString(),
    ...context
  });
}

/**
 * Log an event
 */
export function logEvent(eventName: string, eventData?: Record<string, any>): void {
  logger.log(`🎯 EVENT - ${eventName}:`, {
    timestamp: new Date().toISOString(),
    ...eventData
  });
}

/**
 * Log initialization
 */
export function logInit(componentName: string, config?: Record<string, any>): void {
  logger.log(`🚀 INIT - ${componentName}:`, {
    timestamp: new Date().toISOString(),
    ...config
  });
}

/**
 * Log a lifecycle event
 */
export function logLifecycle(componentName: string, event: string, data?: Record<string, any>): void {
  logger.debug(`[${componentName}] ${event}`, {
    timestamp: new Date().toISOString(),
    ...data
  });
}

/**
 * Log API or data operations
 */
export function logData(operation: string, details: Record<string, any>): void {
  logger.log(`💾 DATA - ${operation}:`, {
    timestamp: new Date().toISOString(),
    ...details
  });
}

/**
 * Log performance metrics
 */
export function logPerformance(operation: string, duration: number, details?: Record<string, any>): void {
  logger.debug(`⚡ PERFORMANCE - ${operation}:`, {
    duration: `${duration}ms`,
    timestamp: new Date().toISOString(),
    ...details
  });
}

/**
 * Create a scoped logger for a specific component
 */
export function createScopedLogger(scope: string) {
  return {
    log: (message: string, data?: any) => logAction(`[${scope}] ${message}`, data),
    debug: (message: string, data?: any) => logDebug(`[${scope}] ${message}`, data),
    warn: (message: string, data?: any) => logWarn(`[${scope}] ${message}`, data),
    error: (message: string, error?: any, data?: any) => logError(`[${scope}] ${message}`, error, data),
    event: (event: string, data?: any) => logEvent(`[${scope}] ${event}`, data),
    stateChange: (state: string, old: any, value: any, data?: any) => 
      logStateChange(`[${scope}] ${state}`, old, value, data)
  };
}