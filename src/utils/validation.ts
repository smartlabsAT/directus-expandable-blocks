/**
 * Validation utilities for the expandable blocks extension
 * 
 * This module provides common validation functions to reduce code duplication
 * across composables and ensure consistent validation logic.
 */

/**
 * Check if a primary key is valid for operations
 * @param primaryKey - The primary key to validate
 * @returns true if the key is valid, false if it's new/temporary
 */
export function isValidPrimaryKey(primaryKey: string | number | undefined): boolean {
  return !(!primaryKey || primaryKey === '+' || primaryKey === 'new');
}

/**
 * Check if an item is an object (not just an ID)
 * @param item - The item to check
 * @returns true if item is an object, false if it's null or a primitive
 */
export function isItemObject(item: any): item is Record<string, any> {
  return typeof item === 'object' && item !== null;
}

/**
 * Check if a value is not null and not undefined
 * @param value - The value to check
 * @returns true if value is neither null nor undefined
 */
export function isNotNullish<T>(value: T | null | undefined): value is T {
  return value !== null && value !== undefined;
}

/**
 * Check if an ID represents a new/temporary item
 * @param id - The ID to check
 * @returns true if the ID represents a new item
 */
export function isTemporaryId(id: string | number | undefined): boolean {
  if (!id) return true;
  const idStr = String(id);
  return idStr.startsWith('temp_') || idStr.startsWith('idx_') || idStr.startsWith('new_') || idStr.startsWith('dup_') || idStr.startsWith('existing_');
}

/**
 * Validate that a collection name is provided
 * @param collection - The collection name to validate
 * @returns true if collection name is valid
 */
export function isValidCollection(collection: string | undefined): collection is string {
  return typeof collection === 'string' && collection.length > 0;
}

/**
 * Check if a field configuration is valid for M2A relationships
 * @param field - The field configuration to validate
 * @returns true if field has required M2A properties
 */
export function isValidM2AField(field: any): boolean {
  return (
    field &&
    typeof field === 'object' &&
    typeof field.field === 'string' &&
    field.field.length > 0
  );
}