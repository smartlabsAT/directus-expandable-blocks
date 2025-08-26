import { vi } from 'vitest';

// Common mock for logger-wrapper used across all tests
// This is a function to avoid hoisting issues with vi.mock
export const createLoggerWrapperMock = () => ({
  logger: {
    debug: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
    log: vi.fn(),
    info: vi.fn()
  },
  logDebug: vi.fn(),
  logError: vi.fn(),
  logWarn: vi.fn(),
  logAction: vi.fn(),
  logStateChange: vi.fn(),
  logEvent: vi.fn(),
  logInit: vi.fn(),
  logLifecycle: vi.fn(),
  logData: vi.fn(),
  logPerformance: vi.fn(),
  createScopedLogger: vi.fn(() => ({
    debug: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
    log: vi.fn(),
    info: vi.fn(),
    stateChange: vi.fn(),
    event: vi.fn(),
    action: vi.fn(),
    init: vi.fn(),
    lifecycle: vi.fn(),
    data: vi.fn(),
    performance: vi.fn()
  }))
});