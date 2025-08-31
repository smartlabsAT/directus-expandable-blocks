/**
 * Generic logger utilities for shared components
 * Allows consuming extensions to customize logging prefix
 */

const DEBUG = true;

interface LogContext {
  [key: string]: any;
}

/**
 * Create a scoped logger with custom prefix
 */
export function createScopedLogger(prefix: string = '[SharedComponent]') {
  return {
    log: (message: string, context?: LogContext) => {
      if (DEBUG) {
        if (context) {
          console.log(`${prefix} ${message}`, context);
        } else {
          console.log(`${prefix} ${message}`);
        }
      }
    },

    debug: (message: string, context?: LogContext) => {
      if (DEBUG) {
        if (context) {
          console.log(`${prefix} [DEBUG] ${message}`, context);
        } else {
          console.log(`${prefix} [DEBUG] ${message}`);
        }
      }
    },

    error: (message: string, error?: Error | any, context?: LogContext) => {
      // Errors always log, even if DEBUG is false
      if (error && context) {
        console.error(`${prefix} [ERROR] ${message}`, error, context);
      } else if (error) {
        console.error(`${prefix} [ERROR] ${message}`, error);
      } else if (context) {
        console.error(`${prefix} [ERROR] ${message}`, context);
      } else {
        console.error(`${prefix} [ERROR] ${message}`);
      }
    },

    warn: (message: string, context?: LogContext) => {
      if (DEBUG) {
        if (context) {
          console.warn(`${prefix} [WARN] ${message}`, context);
        } else {
          console.warn(`${prefix} [WARN] ${message}`);
        }
      }
    },

    action: (message: string, context?: LogContext) => {
      if (DEBUG) {
        if (context) {
          console.log(`${prefix} [ACTION] ${message}`, context);
        } else {
          console.log(`${prefix} [ACTION] ${message}`);
        }
      }
    },

    stateChange: (property: string, oldValue: any, newValue: any) => {
      if (DEBUG) {
        console.log(`${prefix} [STATE] ${property} changed`, {
          from: oldValue,
          to: newValue
        });
      }
    },

    event: (eventName: string, context?: LogContext) => {
      if (DEBUG) {
        if (context) {
          console.log(`${prefix} [EVENT] ${eventName}`, context);
        } else {
          console.log(`${prefix} [EVENT] ${eventName}`);
        }
      }
    },

    init: (componentName: string, context?: LogContext) => {
      if (DEBUG) {
        if (context) {
          console.log(`${prefix} [INIT] ${componentName}`, context);
        } else {
          console.log(`${prefix} [INIT] ${componentName}`);
        }
      }
    },

    lifecycle: (componentName: string, lifecycle: string, context?: LogContext) => {
      if (DEBUG) {
        if (context) {
          console.log(`${prefix} [LIFECYCLE] ${componentName} ${lifecycle}`, context);
        } else {
          console.log(`${prefix} [LIFECYCLE] ${componentName} ${lifecycle}`);
        }
      }
    },

    data: (operation: string, context?: LogContext) => {
      if (DEBUG) {
        if (context) {
          console.log(`${prefix} [DATA] ${operation}`, context);
        } else {
          console.log(`${prefix} [DATA] ${operation}`);
        }
      }
    },

    performance: (operation: string, timeMs: number, context?: LogContext) => {
      if (DEBUG) {
        if (context) {
          console.log(`${prefix} [PERF] ${operation} took ${timeMs}ms`, context);
        } else {
          console.log(`${prefix} [PERF] ${operation} took ${timeMs}ms`);
        }
      }
    }
  };
}

/**
 * Default logger functions for backward compatibility
 */
export const logDebug = (message: string, context?: LogContext) => {
  createScopedLogger().debug(message, context);
};

export const logError = (message: string, error?: Error | any, context?: LogContext) => {
  createScopedLogger().error(message, error, context);
};

export const logWarn = (message: string, context?: LogContext) => {
  createScopedLogger().warn(message, context);
};

export const logAction = (message: string, context?: LogContext) => {
  createScopedLogger().action(message, context);
};

export const logStateChange = (property: string, oldValue: any, newValue: any) => {
  createScopedLogger().stateChange(property, oldValue, newValue);
};

export const logEvent = (eventName: string, context?: LogContext) => {
  createScopedLogger().event(eventName, context);
};

export const logInit = (componentName: string, context?: LogContext) => {
  createScopedLogger().init(componentName, context);
};

export const logLifecycle = (componentName: string, lifecycle: string, context?: LogContext) => {
  createScopedLogger().lifecycle(componentName, lifecycle, context);
};

export const logData = (operation: string, context?: LogContext) => {
  createScopedLogger().data(operation, context);
};

export const logPerformance = (operation: string, timeMs: number, context?: LogContext) => {
  createScopedLogger().performance(operation, timeMs, context);
};