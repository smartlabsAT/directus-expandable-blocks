/**
 * Helper functions for expandable-blocks extension
 */

import type { JunctionRecord, ItemRecord, CollectionInfo } from '../types';

/**
 * Build fields string for M2A queries
 */
export function buildM2AFieldsString(allowedCollections: CollectionInfo[]): string {
  if (allowedCollections.length === 0) {
    return '*,item.*';
  }
  
  const itemFields = allowedCollections
    .map(col => `item:${col.collection}.*`)
    .join(',');
  
  return `*,${itemFields}`;
}

/**
 * Extract title from item data
 */
export function extractItemTitle(item: ItemRecord | JunctionRecord): string {
  // First check if item is an object before using 'in' operator
  if (!item || typeof item !== 'object') {
    return 'Untitled Block';
  }
  
  const itemData = 'item' in item && typeof item.item === 'object' 
    ? item.item 
    : item;
  
  if (!itemData || typeof itemData !== 'object') {
    return 'Untitled Block';
  }
  
  return (itemData as ItemRecord).title || 
         (itemData as ItemRecord).name || 
         (itemData as ItemRecord).headline || 
         (itemData as ItemRecord).label ||
         (itemData as ItemRecord).heading ||
         'Untitled Block';
}

/**
 * Get actual item ID from junction record
 */
export function getActualItemId(item: JunctionRecord): string | number {
  if (item.item && typeof item.item === 'object') {
    return item.item.id;
  }
  return item.id;
}

/**
 * Check if item is new (not saved to database)
 */
export function isNewItem(item: JunctionRecord): boolean {
  const id = String(item.id);
  return !item.id || id.startsWith('new_') || id.startsWith('temp_') || id.startsWith('dup_');
}

/**
 * Parse allowed collections from various formats
 */
export function parseAllowedCollections(
  allowedCollections: string[] | string | undefined
): string[] {
  if (!allowedCollections) return [];
  
  if (Array.isArray(allowedCollections)) {
    return allowedCollections;
  }
  
  if (typeof allowedCollections === 'string') {
    return allowedCollections
      .split(',')
      .map(c => c.trim())
      .filter(c => c.length > 0);
  }
  
  return [];
}

/**
 * Deep clone an object
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