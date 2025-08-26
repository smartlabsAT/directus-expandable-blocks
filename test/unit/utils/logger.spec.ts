import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest';

// Mock the logger module to enable logging in tests
vi.mock('@/utils/logger', () => {
  const actualLogger = {
    log: (...args: any[]) => console.log('[ExpandableBlocks]', ...args),
    warn: (...args: any[]) => console.warn('[ExpandableBlocks]', ...args),
    error: (...args: any[]) => console.error('[ExpandableBlocks]', ...args),
    debug: (...args: any[]) => console.log('[ExpandableBlocks:Debug]', ...args)
  };
  return { logger: actualLogger };
});

import { logger } from '@/utils/logger';
import { 
  logAction, 
  logDebug, 
  logWarn, 
  logError, 
  logStateChange, 
  logEvent, 
  logInit, 
  logLifecycle,
  logData,
  logPerformance,
  createScopedLogger 
} from '@/utils/logger-wrapper';

describe('Logger', () => {
  let originalConsole: any;

  beforeEach(() => {
    // Save original console methods
    originalConsole = {
      log: console.log,
      warn: console.warn,
      error: console.error
    };
    
    // Mock console methods
    console.log = vi.fn();
    console.warn = vi.fn();
    console.error = vi.fn();
  });

  afterEach(() => {
    // Restore original console methods
    console.log = originalConsole.log;
    console.warn = originalConsole.warn;
    console.error = originalConsole.error;
  });

  describe('Basic logger functionality', () => {
    it('logs messages with prefix', () => {
      logger.log('Test message');
      expect(console.log).toHaveBeenCalledWith('[ExpandableBlocks]', 'Test message');
    });

    it('logs warnings with prefix', () => {
      logger.warn('Warning message');
      expect(console.warn).toHaveBeenCalledWith('[ExpandableBlocks]', 'Warning message');
    });

    it('always logs errors', () => {
      logger.error('Error message');
      expect(console.error).toHaveBeenCalledWith('[ExpandableBlocks]', 'Error message');
    });

    it('logs debug messages with debug prefix', () => {
      logger.debug('Debug message');
      expect(console.log).toHaveBeenCalledWith('[ExpandableBlocks:Debug]', 'Debug message');
    });

    it('handles multiple arguments', () => {
      logger.log('Message', { data: 'test' }, 123);
      expect(console.log).toHaveBeenCalledWith('[ExpandableBlocks]', 'Message', { data: 'test' }, 123);
    });

    it('handles special values', () => {
      logger.log(null, undefined);
      expect(console.log).toHaveBeenCalledWith('[ExpandableBlocks]', null, undefined);
    });

    it('handles empty calls', () => {
      logger.log();
      expect(console.log).toHaveBeenCalledWith('[ExpandableBlocks]');
    });

    it('handles complex objects', () => {
      const complexObj = {
        nested: {
          array: [1, 2, { deep: true }],
          circular: null as any
        }
      };
      complexObj.nested.circular = complexObj;
      
      logger.log('Complex:', complexObj);
      expect(console.log).toHaveBeenCalledWith('[ExpandableBlocks]', 'Complex:', complexObj);
    });
  });
});

describe('logger-wrapper', () => {
  let originalConsole: any;

  beforeEach(() => {
    originalConsole = {
      log: console.log,
      warn: console.warn,
      error: console.error
    };
    
    console.log = vi.fn();
    console.warn = vi.fn();
    console.error = vi.fn();
  });

  afterEach(() => {
    console.log = originalConsole.log;
    console.warn = originalConsole.warn;
    console.error = originalConsole.error;
  });

  describe('logAction', () => {
    it('logs action with timestamp', () => {
      logAction('TEST_ACTION', { extra: 'data' });
      
      expect(console.log).toHaveBeenCalledWith(
        '[ExpandableBlocks]',
        '🔄 TEST_ACTION:',
        expect.objectContaining({
          timestamp: expect.stringMatching(/^\d{4}-\d{2}-\d{2}T/),
          extra: 'data'
        })
      );
    });

    it('logs action without data', () => {
      logAction('SIMPLE_ACTION');
      
      expect(console.log).toHaveBeenCalledWith(
        '[ExpandableBlocks]',
        '🔄 SIMPLE_ACTION:',
        expect.objectContaining({
          timestamp: expect.any(String)
        })
      );
    });
  });

  describe('logDebug', () => {
    it('logs debug message with context', () => {
      logDebug('Debug message', { context: 'test' });
      
      expect(console.log).toHaveBeenCalledWith(
        '[ExpandableBlocks:Debug]',
        'Debug message',
        { context: 'test' }
      );
    });

    it('logs debug message without context', () => {
      logDebug('Simple debug');
      
      expect(console.log).toHaveBeenCalledWith(
        '[ExpandableBlocks:Debug]',
        'Simple debug',
        {}
      );
    });
  });

  describe('logWarn', () => {
    it('logs warning with context', () => {
      logWarn('Warning message', { level: 'medium' });
      
      expect(console.warn).toHaveBeenCalledWith(
        '[ExpandableBlocks]',
        'Warning message',
        { level: 'medium' }
      );
    });

    it('logs warning without context', () => {
      logWarn('Simple warning');
      
      expect(console.warn).toHaveBeenCalledWith(
        '[ExpandableBlocks]',
        'Simple warning',
        {}
      );
    });
  });

  describe('logError', () => {
    it('logs error with Error object', () => {
      const error = new Error('Test error');
      logError('Error occurred', error, { code: 500 });
      
      expect(console.error).toHaveBeenCalledWith(
        '[ExpandableBlocks]',
        'Error occurred',
        expect.objectContaining({
          error: 'Test error',
          stack: expect.any(String),
          code: 500
        })
      );
    });

    it('logs error with string', () => {
      logError('Error occurred', 'Simple error');
      
      expect(console.error).toHaveBeenCalledWith(
        '[ExpandableBlocks]',
        'Error occurred',
        expect.objectContaining({
          error: 'Simple error',
          stack: undefined
        })
      );
    });

    it('logs error without error object', () => {
      logError('Error occurred');
      
      expect(console.error).toHaveBeenCalledWith(
        '[ExpandableBlocks]',
        'Error occurred',
        expect.objectContaining({
          error: undefined,
          stack: undefined
        })
      );
    });
  });

  describe('logStateChange', () => {
    it('logs state change with all parameters', () => {
      logStateChange('isExpanded', false, true, { blockId: 123 });
      
      expect(console.log).toHaveBeenCalledWith(
        '[ExpandableBlocks]',
        '📝 STATE CHANGE - isExpanded:',
        expect.objectContaining({
          oldValue: false,
          newValue: true,
          timestamp: expect.any(String),
          blockId: 123
        })
      );
    });

    it('logs state change without context', () => {
      logStateChange('items', [], [1, 2, 3]);
      
      expect(console.log).toHaveBeenCalledWith(
        '[ExpandableBlocks]',
        '📝 STATE CHANGE - items:',
        expect.objectContaining({
          oldValue: [],
          newValue: [1, 2, 3],
          timestamp: expect.any(String)
        })
      );
    });
  });

  describe('logEvent', () => {
    it('logs event with data', () => {
      logEvent('BLOCK_ADDED', { id: 'new_1', collection: 'content_text' });
      
      expect(console.log).toHaveBeenCalledWith(
        '[ExpandableBlocks]',
        '🎯 EVENT - BLOCK_ADDED:',
        expect.objectContaining({
          timestamp: expect.any(String),
          id: 'new_1',
          collection: 'content_text'
        })
      );
    });

    it('logs event without data', () => {
      logEvent('SAVE_COMPLETED');
      
      expect(console.log).toHaveBeenCalledWith(
        '[ExpandableBlocks]',
        '🎯 EVENT - SAVE_COMPLETED:',
        expect.objectContaining({
          timestamp: expect.any(String)
        })
      );
    });
  });

  describe('logInit', () => {
    it('logs initialization with config', () => {
      logInit('ExpandableBlocks', { field: 'content_blocks', primaryKey: 123 });
      
      expect(console.log).toHaveBeenCalledWith(
        '[ExpandableBlocks]',
        '🚀 INIT - ExpandableBlocks:',
        expect.objectContaining({
          timestamp: expect.any(String),
          field: 'content_blocks',
          primaryKey: 123
        })
      );
    });

    it('logs initialization without config', () => {
      logInit('Component');
      
      expect(console.log).toHaveBeenCalledWith(
        '[ExpandableBlocks]',
        '🚀 INIT - Component:',
        expect.objectContaining({
          timestamp: expect.any(String)
        })
      );
    });
  });

  describe('logLifecycle', () => {
    it('logs lifecycle event with data', () => {
      logLifecycle('BlockItem', 'mounted', { id: 1 });
      
      expect(console.log).toHaveBeenCalledWith(
        '[ExpandableBlocks:Debug]',
        '[BlockItem] mounted',
        expect.objectContaining({
          timestamp: expect.any(String),
          id: 1
        })
      );
    });

    it('logs lifecycle event without data', () => {
      logLifecycle('BlockList', 'unmounted');
      
      expect(console.log).toHaveBeenCalledWith(
        '[ExpandableBlocks:Debug]',
        '[BlockList] unmounted',
        expect.objectContaining({
          timestamp: expect.any(String)
        })
      );
    });
  });

  describe('logData', () => {
    it('logs data operation', () => {
      logData('LOAD_ITEMS', { count: 5, source: 'api' });
      
      expect(console.log).toHaveBeenCalledWith(
        '[ExpandableBlocks]',
        '💾 DATA - LOAD_ITEMS:',
        expect.objectContaining({
          timestamp: expect.any(String),
          count: 5,
          source: 'api'
        })
      );
    });
  });

  describe('logPerformance', () => {
    it('logs performance metrics', () => {
      logPerformance('render', 123.45, { componentCount: 10 });
      
      expect(console.log).toHaveBeenCalledWith(
        '[ExpandableBlocks:Debug]',
        '⚡ PERFORMANCE - render:',
        expect.objectContaining({
          duration: '123.45ms',
          timestamp: expect.any(String),
          componentCount: 10
        })
      );
    });

    it('logs performance without extra details', () => {
      logPerformance('load', 50);
      
      expect(console.log).toHaveBeenCalledWith(
        '[ExpandableBlocks:Debug]',
        '⚡ PERFORMANCE - load:',
        expect.objectContaining({
          duration: '50ms',
          timestamp: expect.any(String)
        })
      );
    });
  });

  describe('createScopedLogger', () => {
    it('creates scoped logger with all methods', () => {
      const scopedLogger = createScopedLogger('BlockItem');
      
      expect(scopedLogger).toHaveProperty('log');
      expect(scopedLogger).toHaveProperty('debug');
      expect(scopedLogger).toHaveProperty('warn');
      expect(scopedLogger).toHaveProperty('error');
      expect(scopedLogger).toHaveProperty('event');
      expect(scopedLogger).toHaveProperty('stateChange');
    });

    it('logs with scope prefix', () => {
      const scopedLogger = createScopedLogger('BlockItem');
      
      scopedLogger.log('Test message', { id: 1 });
      
      expect(console.log).toHaveBeenCalledWith(
        '[ExpandableBlocks]',
        '🔄 [BlockItem] Test message:',
        expect.objectContaining({
          timestamp: expect.any(String),
          id: 1
        })
      );
    });

    it('logs debug with scope', () => {
      const scopedLogger = createScopedLogger('BlockActions');
      
      scopedLogger.debug('Debug info', { action: 'delete' });
      
      expect(console.log).toHaveBeenCalledWith(
        '[ExpandableBlocks:Debug]',
        '[BlockActions] Debug info',
        { action: 'delete' }
      );
    });

    it('logs warnings with scope', () => {
      const scopedLogger = createScopedLogger('M2AHelper');
      
      scopedLogger.warn('Warning message', { issue: 'validation' });
      
      expect(console.warn).toHaveBeenCalledWith(
        '[ExpandableBlocks]',
        '[M2AHelper] Warning message',
        { issue: 'validation' }
      );
    });

    it('logs errors with scope', () => {
      const scopedLogger = createScopedLogger('DataLoader');
      const error = new Error('Load failed');
      
      scopedLogger.error('Failed to load', error, { attempt: 3 });
      
      expect(console.error).toHaveBeenCalledWith(
        '[ExpandableBlocks]',
        '[DataLoader] Failed to load',
        expect.objectContaining({
          error: 'Load failed',
          stack: expect.any(String),
          attempt: 3
        })
      );
    });

    it('logs events with scope', () => {
      const scopedLogger = createScopedLogger('BlockList');
      
      scopedLogger.event('ITEM_ADDED', { id: 'new_1' });
      
      expect(console.log).toHaveBeenCalledWith(
        '[ExpandableBlocks]',
        '🎯 EVENT - [BlockList] ITEM_ADDED:',
        expect.objectContaining({
          timestamp: expect.any(String),
          id: 'new_1'
        })
      );
    });

    it('logs state changes with scope', () => {
      const scopedLogger = createScopedLogger('BlockState');
      
      scopedLogger.stateChange('expanded', false, true, { blockId: 1 });
      
      expect(console.log).toHaveBeenCalledWith(
        '[ExpandableBlocks]',
        '📝 STATE CHANGE - [BlockState] expanded:',
        expect.objectContaining({
          oldValue: false,
          newValue: true,
          timestamp: expect.any(String),
          blockId: 1
        })
      );
    });
  });
});