/**
 * Logger utility for development debugging
 * Enable by setting window.EXPANDABLE_BLOCKS_DEBUG = true in the browser console
 */

const DEBUG = typeof window !== 'undefined' && (window as any).EXPANDABLE_BLOCKS_DEBUG === true;
export const logger = {
  log: (...args: any[]) => {
    if (DEBUG) console.log('[ExpandableBlocks]', ...args);
  },
  
  warn: (...args: any[]) => {
    if (DEBUG) console.warn('[ExpandableBlocks]', ...args);
  },
  
  error: (...args: any[]) => {
    // Always log errors
    console.error('[ExpandableBlocks]', ...args);
  },
  
  debug: (...args: any[]) => {
    if (DEBUG) console.log('[ExpandableBlocks:Debug]', ...args);
  }
};