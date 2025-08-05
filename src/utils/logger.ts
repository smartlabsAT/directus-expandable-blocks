/**
 * Logger utility for development debugging
 * 
 * Logging is automatically enabled in development mode.
 * In production, you can manually enable it by:
 * - Setting window.EXPANDABLE_BLOCKS_DEBUG = true in the browser console
 * - Or setting localStorage.setItem('EXPANDABLE_BLOCKS_DEBUG', 'true')
 */

// Check if we're in development mode
const isDevelopment = process.env.NODE_ENV === 'development' || 
                     import.meta.env?.MODE === 'development' ||
                     import.meta.env?.DEV === true;

// Enable debug based on environment or manual override
const DEBUG = isDevelopment || 
             (typeof window !== 'undefined' && (
               (window as any).EXPANDABLE_BLOCKS_DEBUG === true ||
               localStorage?.getItem('EXPANDABLE_BLOCKS_DEBUG') === 'true'
             ));

export const logger = {
  log: (...args: any[]) => {
    if (DEBUG) console.log('[ExpandableBlocks]', ...args);
  },
  
  warn: (...args: any[]) => {
    if (DEBUG) console.warn('[ExpandableBlocks]', ...args);
  },
  
  error: (...args: any[]) => {
    // Always log errors in development, optional in production
    if (DEBUG || isDevelopment) {
      console.error('[ExpandableBlocks]', ...args);
    }
  },
  
  debug: (...args: any[]) => {
    if (DEBUG) console.log('[ExpandableBlocks:Debug]', ...args);
  },
  
  // Helper functions for runtime control
  isEnabled: () => DEBUG,
  
  enable: () => {
    if (typeof window !== 'undefined') {
      localStorage.setItem('EXPANDABLE_BLOCKS_DEBUG', 'true');
      (window as any).EXPANDABLE_BLOCKS_DEBUG = true;
      console.log('[ExpandableBlocks] Logging enabled. Refresh the page to see all logs.');
    }
  },
  
  disable: () => {
    if (typeof window !== 'undefined') {
      localStorage.removeItem('EXPANDABLE_BLOCKS_DEBUG');
      delete (window as any).EXPANDABLE_BLOCKS_DEBUG;
      console.log('[ExpandableBlocks] Logging disabled. Refresh the page to apply.');
    }
  }
};