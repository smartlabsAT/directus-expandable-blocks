/**
 * String formatting utilities for API services
 */

/**
 * Format a collection name for display
 * Converts snake_case to Title Case
 * @param collection The collection name (e.g., 'user_profiles')
 * @returns Formatted name (e.g., 'User Profiles')
 */
export function formatCollectionName(collection: string): string {
  return collection
    .split('_')
    .map(part => part.charAt(0).toUpperCase() + part.slice(1))
    .join(' ');
}

/**
 * Format a field name for display
 * Converts snake_case to Title Case
 * @param field The field name (e.g., 'created_at')
 * @returns Formatted name (e.g., 'Created At')
 */
export function formatFieldName(field: string): string {
  return field
    .split('_')
    .map(part => part.charAt(0).toUpperCase() + part.slice(1))
    .join(' ');
}

/**
 * Convert camelCase to snake_case
 * @param str The camelCase string
 * @returns snake_case string
 */
export function camelToSnake(str: string): string {
  return str.replace(/[A-Z]/g, letter => `_${letter.toLowerCase()}`);
}

/**
 * Convert snake_case to camelCase
 * @param str The snake_case string
 * @returns camelCase string
 */
export function snakeToCamel(str: string): string {
  return str.replace(/_([a-z])/g, (_, letter) => letter.toUpperCase());
}