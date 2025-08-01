/**
 * String formatting utilities for API services
 */

/**
 * Format a name for display
 * Converts snake_case or kebab-case to Title Case
 * @param name The name to format (e.g., 'user_profiles' or 'user-profiles')
 * @returns Formatted name (e.g., 'User Profiles')
 */
export function formatName(name: string): string {
  return name
    .split(/[_-]/)
    .map(part => part.charAt(0).toUpperCase() + part.slice(1))
    .join(' ');
}

/**
 * Format a collection name for display
 * @deprecated Use formatName() instead
 * @param collection The collection name
 * @returns Formatted name
 */
export function formatCollectionName(collection: string): string {
  return formatName(collection);
}

/**
 * Format a field name for display
 * @deprecated Use formatName() instead
 * @param field The field name
 * @returns Formatted name
 */
export function formatFieldName(field: string): string {
  return formatName(field);
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