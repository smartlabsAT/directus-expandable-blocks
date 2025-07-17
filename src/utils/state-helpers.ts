/**
 * State management utility functions
 * 
 * This module provides common state management utilities used throughout the expandable-blocks extension.
 * It centralizes state tracking, cloning, comparison, and dirty state management patterns.
 */

import { Ref } from 'vue';
import { logger } from './logger';

/**
 * Deep equality check for objects
 * Compares two values for deep equality, handling nested objects and arrays
 */
export function deepEqual(a: any, b: any): boolean {
  if (a === b) return true;
  if (a == null || b == null) return false;
  if (typeof a !== typeof b) return false;
  if (typeof a !== 'object') return false;
  
  if (Array.isArray(a) !== Array.isArray(b)) return false;
  
  const keysA = Object.keys(a);
  const keysB = Object.keys(b);
  if (keysA.length !== keysB.length) return false;
  
  for (const key of keysA) {
    if (!keysB.includes(key)) return false;
    if (!deepEqual(a[key], b[key])) return false;
  }
  
  return true;
}

/**
 * Deep clone an object
 * Creates a deep copy of an object, handling nested structures, arrays, and dates
 */
export function deepClone<T>(obj: T): T {
  // Handle primitive types and null
  if (obj === null || typeof obj !== 'object') {
    return obj;
  }
  
  // Handle undefined
  if (obj === undefined) {
    return obj;
  }
  
  // Handle Date
  if (obj instanceof Date) {
    return new Date(obj.getTime()) as any;
  }
  
  // Handle Array
  if (Array.isArray(obj)) {
    return obj.map(item => deepClone(item)) as any;
  }
  
  // Handle Object
  const clonedObj = {} as any;
  for (const key in obj) {
    if (obj.hasOwnProperty(key)) {
      clonedObj[key] = deepClone(obj[key]);
    }
  }
  
  return clonedObj;
}

/**
 * State tracking manager for managing original states and dirty flags
 */
export class StateTracker<T = any> {
  private originalStates: Map<string, T> = new Map();
  private dirtyFlags: Map<string, boolean> = new Map();
  
  constructor(private debugName?: string) {}
  
  /**
   * Store the original state for an item
   */
  storeOriginalState(id: string, state: T): void {
    this.originalStates.set(id, deepClone(state));
    if (this.debugName) {
      logger.debug(`[${this.debugName}] Stored original state for ${id}`);
    }
  }
  
  /**
   * Get the original state for an item
   */
  getOriginalState(id: string): T | undefined {
    return this.originalStates.get(id);
  }
  
  /**
   * Check if an item has an original state stored
   */
  hasOriginalState(id: string): boolean {
    return this.originalStates.has(id);
  }
  
  /**
   * Mark an item as dirty or clean
   */
  setDirtyFlag(id: string, isDirty: boolean): void {
    this.dirtyFlags.set(id, isDirty);
    if (this.debugName) {
      logger.debug(`[${this.debugName}] Marked ${id} as ${isDirty ? 'dirty' : 'clean'}`);
    }
  }
  
  /**
   * Check if an item is marked as dirty
   */
  isDirty(id: string): boolean {
    return this.dirtyFlags.get(id) || false;
  }
  
  /**
   * Check if an item has changed from its original state
   */
  hasChanged(id: string, currentState: T): boolean {
    const original = this.originalStates.get(id);
    if (!original) return true; // If no original state, consider it changed
    return !deepEqual(currentState, original);
  }
  
  /**
   * Reset an item to its original state
   */
  resetToOriginal(id: string): T | undefined {
    const original = this.originalStates.get(id);
    if (original) {
      this.dirtyFlags.set(id, false);
      return deepClone(original);
    }
    return undefined;
  }
  
  /**
   * Remove all tracking for an item
   */
  removeTracking(id: string): void {
    this.originalStates.delete(id);
    this.dirtyFlags.delete(id);
    if (this.debugName) {
      logger.debug(`[${this.debugName}] Removed tracking for ${id}`);
    }
  }
  
  /**
   * Clear all tracking
   */
  clearAll(): void {
    this.originalStates.clear();
    this.dirtyFlags.clear();
    if (this.debugName) {
      logger.debug(`[${this.debugName}] Cleared all tracking`);
    }
  }
  
  /**
   * Get all tracked IDs
   */
  getTrackedIds(): string[] {
    return Array.from(this.originalStates.keys());
  }
  
  /**
   * Get all dirty IDs
   */
  getDirtyIds(): string[] {
    return Array.from(this.dirtyFlags.entries())
      .filter(([_, isDirty]) => isDirty)
      .map(([id]) => id);
  }
  
  /**
   * Get debug info
   */
  getDebugInfo(): Record<string, any> {
    return {
      originalStatesCount: this.originalStates.size,
      dirtyFlagsCount: this.dirtyFlags.size,
      dirtyIds: this.getDirtyIds(),
      trackedIds: this.getTrackedIds()
    };
  }
}

/**
 * Create a snapshot of the current state
 * Useful for creating restore points
 */
export function createStateSnapshot<T>(state: T): T {
  return deepClone(state);
}

/**
 * Compare two arrays for equality (order-sensitive)
 */
export function arraysEqual<T>(a: T[], b: T[]): boolean {
  if (a.length !== b.length) return false;
  return a.every((item, index) => deepEqual(item, b[index]));
}

/**
 * Compare two arrays for equality (order-insensitive)
 */
export function arraysEqualUnordered<T>(a: T[], b: T[]): boolean {
  if (a.length !== b.length) return false;
  
  // For simple types, use a more efficient approach
  if (a.length > 0 && (typeof a[0] === 'string' || typeof a[0] === 'number')) {
    const sortedA = [...a].sort();
    const sortedB = [...b].sort();
    return sortedA.every((item, index) => item === sortedB[index]);
  }
  
  // For complex objects, check each item exists in the other array
  return a.every(itemA => b.some(itemB => deepEqual(itemA, itemB))) &&
         b.every(itemB => a.some(itemA => deepEqual(itemA, itemB)));
}

/**
 * Track changes to an order/sequence of items
 */
export class OrderTracker {
  private originalOrder: (string | number)[] = [];
  
  constructor(private debugName?: string) {}
  
  /**
   * Store the original order
   */
  storeOriginalOrder(order: (string | number)[]): void {
    this.originalOrder = [...order];
    if (this.debugName) {
      logger.debug(`[${this.debugName}] Stored original order:`, order);
    }
  }
  
  /**
   * Check if the order has changed
   */
  hasOrderChanged(currentOrder: (string | number)[]): boolean {
    return !arraysEqual(this.originalOrder, currentOrder);
  }
  
  /**
   * Get the original order
   */
  getOriginalOrder(): (string | number)[] {
    return [...this.originalOrder];
  }
  
  /**
   * Clear the stored order
   */
  clear(): void {
    this.originalOrder = [];
  }
}

/**
 * Batch state update helper
 * Useful for updating multiple states while maintaining consistency
 */
export class BatchStateUpdater<T> {
  private updates: Map<string, T> = new Map();
  
  /**
   * Queue an update
   */
  queueUpdate(id: string, state: T): void {
    this.updates.set(id, state);
  }
  
  /**
   * Apply all queued updates to a state tracker
   */
  applyTo(tracker: StateTracker<T>): void {
    for (const [id, state] of this.updates) {
      tracker.storeOriginalState(id, state);
    }
    this.updates.clear();
  }
  
  /**
   * Get pending updates count
   */
  getPendingCount(): number {
    return this.updates.size;
  }
  
  /**
   * Clear all pending updates
   */
  clear(): void {
    this.updates.clear();
  }
}

/**
 * Create a reactive state diff helper
 * Returns a function that computes the diff between original and current state
 */
export function createStateDiff<T>(
  getOriginal: () => T,
  getCurrent: () => T
): () => { hasChanges: boolean; changes: string[] } {
  return () => {
    const original = getOriginal();
    const current = getCurrent();
    
    if (!original || !current) {
      return { hasChanges: false, changes: [] };
    }
    
    const changes: string[] = [];
    const checkChanges = (obj1: any, obj2: any, path = '') => {
      if (obj1 === obj2) return;
      if (obj1 == null || obj2 == null) {
        changes.push(path || 'root');
        return;
      }
      if (typeof obj1 !== 'object' || typeof obj2 !== 'object') {
        if (obj1 !== obj2) changes.push(path || 'root');
        return;
      }
      
      const allKeys = new Set([...Object.keys(obj1), ...Object.keys(obj2)]);
      for (const key of allKeys) {
        const newPath = path ? `${path}.${key}` : key;
        if (!(key in obj1)) {
          changes.push(`${newPath} (added)`);
        } else if (!(key in obj2)) {
          changes.push(`${newPath} (removed)`);
        } else {
          checkChanges(obj1[key], obj2[key], newPath);
        }
      }
    };
    
    checkChanges(original, current);
    return { hasChanges: changes.length > 0, changes };
  };
}

/**
 * Safe JSON stringify for debugging
 * Handles circular references and functions
 */
export function safeStringify(obj: any, space?: number): string {
  const seen = new WeakSet();
  return JSON.stringify(obj, (key, value) => {
    if (typeof value === 'object' && value !== null) {
      if (seen.has(value)) {
        return '[Circular]';
      }
      seen.add(value);
    }
    if (typeof value === 'function') {
      return '[Function]';
    }
    return value;
  }, space);
}