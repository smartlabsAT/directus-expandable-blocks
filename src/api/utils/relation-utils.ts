import { ParsedMetadata } from '../types/RelationTypes';

/**
 * Safely parses JSON metadata
 * @param meta The metadata to parse (can be string or object)
 * @returns Parsed metadata object or empty object on error
 */
export function parseMetadata(meta: any): ParsedMetadata {
  if (!meta) {
    return {};
  }
  
  if (typeof meta === 'string') {
    try {
      return JSON.parse(meta);
    } catch (e) {
      console.warn('Failed to parse metadata:', e);
      return {};
    }
  }
  
  return meta;
}

/**
 * Converts snake_case or kebab-case strings to Title Case
 * @param name The string to humanize
 * @returns Human-readable string
 */
export function humanizeName(name: string): string {
  return name
    .split(/[_-]/)
    .map(word => word.charAt(0).toUpperCase() + word.slice(1))
    .join(' ');
}

/**
 * Extracts field name from metadata or returns fallback
 * @param meta The metadata object
 * @param fieldKey The field key to look for
 * @param fallback The fallback value
 * @returns The field name
 */
export function getFieldFromMeta(meta: any, fieldKey: string, fallback: string): string {
  const parsed = parseMetadata(meta);
  return parsed[fieldKey] || fallback;
}

/**
 * Gets display name from metadata with fallback to humanized name
 * @param meta The metadata object
 * @param defaultName The default name to use
 * @returns The display name
 */
export function getDisplayName(meta: any, defaultName: string): string {
  const parsed = parseMetadata(meta);
  return parsed.display || parsed.name || humanizeName(defaultName);
}