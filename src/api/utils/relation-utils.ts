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
      // Silently fail and return empty object
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
 * Gets display name from field metadata with fallback to humanized name
 * @param fieldInfo The field info object containing options, display_options, interface_options
 * @param defaultName The default name to use
 * @returns The display name
 */
export function getDisplayName(fieldInfo: any, defaultName: string): string {
  try {
    const options = fieldInfo.options ? parseMetadata(fieldInfo.options) : {};
    const displayOptions = fieldInfo.display_options ? parseMetadata(fieldInfo.display_options) : {};
    const interfaceOptions = fieldInfo.interface_options ? parseMetadata(fieldInfo.interface_options) : {};
    
    // Check for display name in various places
    return options.display || 
           displayOptions.display || 
           interfaceOptions.placeholder || 
           options.note || 
           humanizeName(defaultName);
  } catch (e) {
    return humanizeName(defaultName);
  }
}