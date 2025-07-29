/**
 * Column width helpers for intelligent field type based width calculation
 */

// Default field widths based on Directus field types
export const DEFAULT_FIELD_WIDTHS: Record<string, number> = {
  // Boolean types
  'boolean': 80,
  'toggle': 80,
  
  // Selection types
  'status': 120,
  'select': 150,
  'dropdown': 150,
  'select-dropdown': 150,
  'select-radio': 150,
  'select-multiple': 200,
  'select-dropdown-m2o': 200,
  
  // Date/Time types
  'date': 150,
  'datetime': 180,
  'time': 100,
  'timestamp': 180,
  'dateTime': 180,
  'datetime-created': 180,
  'datetime-updated': 180,
  
  // Numeric types
  'integer': 100,
  'float': 100,
  'decimal': 100,
  'bigInteger': 120,
  
  // Text types
  'string': 200,
  'text': 250,
  'wysiwyg': 300,
  'markdown': 300,
  'code': 250,
  'input': 200,
  'input-rich-text-html': 300,
  'input-rich-text-md': 300,
  'textarea': 250,
  
  // Media types
  'image': 100,
  'file': 150,
  'file-image': 100,
  'files': 200,
  
  // System types
  'uuid': 150,
  'hash': 150,
  'json': 250,
  'csv': 200,
  'geometry': 200,
  'alias': 150,
  
  // User types
  'user': 200,
  'user-created': 200,
  'user-updated': 200,
  
  // Relational types
  'o2m': 200,
  'm2o': 200,
  'm2m': 250,
  'm2a': 250,
  'translations': 250,
  
  // Presentation types
  'presentation-divider': 100,
  'presentation-notice': 200,
  
  // Fallback
  'unknown': 150
};

/**
 * Get default width for a field type
 */
export function getDefaultFieldWidth(fieldType: string): number {
  return DEFAULT_FIELD_WIDTHS[fieldType] || DEFAULT_FIELD_WIDTHS.unknown;
}

/**
 * Determine field type from field info
 * Checks interface first (more specific), then falls back to type
 */
export function getFieldTypeFromInfo(fieldInfo: any): string {
  if (!fieldInfo) return 'unknown';
  
  // Check interface first (more specific)
  if (fieldInfo.interface) {
    // Direct mapping if exists
    if (DEFAULT_FIELD_WIDTHS[fieldInfo.interface]) {
      return fieldInfo.interface;
    }
    
    // Special interface mappings
    switch (fieldInfo.interface) {
      case 'toggle':
      case 'boolean':
        return 'boolean';
      case 'datetime':
      case 'date':
      case 'time':
        return fieldInfo.interface;
      case 'select-dropdown':
      case 'select-radio':
      case 'select-multiple-dropdown':
        return 'select';
      case 'input-rich-text-html':
      case 'input-rich-text-md':
      case 'input-multiline':
        return 'wysiwyg';
      case 'file-image':
        return 'image';
      case 'file':
      case 'files':
        return 'file';
      case 'input':
      case 'input-hash':
        return 'string';
      case 'list-m2m':
      case 'list-o2m':
      case 'list-m2a':
        return fieldInfo.interface.replace('list-', '');
    }
  }
  
  // Fall back to type
  if (fieldInfo.type) {
    // Check if type exists in our widths
    if (DEFAULT_FIELD_WIDTHS[fieldInfo.type]) {
      return fieldInfo.type;
    }
    
    // Map database types to our categories
    switch (fieldInfo.type) {
      case 'boolean':
        return 'boolean';
      case 'integer':
      case 'bigInteger':
      case 'float':
      case 'decimal':
        return fieldInfo.type;
      case 'string':
      case 'text':
        return fieldInfo.type;
      case 'timestamp':
      case 'datetime':
      case 'date':
      case 'time':
        return fieldInfo.type;
      case 'json':
      case 'csv':
        return fieldInfo.type;
      case 'uuid':
      case 'hash':
        return fieldInfo.type;
      default:
        return 'string'; // Default to string for unknown types
    }
  }
  
  return 'unknown';
}

/**
 * Calculate optimal column width based on field info and user preferences
 */
export function calculateColumnWidth(
  fieldInfo: any,
  userPreferences?: Record<string, number>
): string {
  const fieldType = getFieldTypeFromInfo(fieldInfo);
  
  // Check user preferences first
  if (userPreferences && userPreferences[fieldType]) {
    return `minmax(0, ${userPreferences[fieldType]}px)`;
  }
  
  // Use default width
  const defaultWidth = getDefaultFieldWidth(fieldType);
  return `minmax(0, ${defaultWidth}px)`;
}

/**
 * Get a human-readable label for a field type
 */
export function getFieldTypeLabel(fieldType: string): string {
  const labels: Record<string, string> = {
    'boolean': 'Boolean Fields',
    'toggle': 'Toggle Fields',
    'status': 'Status Fields',
    'select': 'Select Fields',
    'date': 'Date Fields',
    'datetime': 'Date & Time Fields',
    'time': 'Time Fields',
    'integer': 'Number Fields',
    'float': 'Decimal Fields',
    'string': 'Text Fields',
    'text': 'Long Text Fields',
    'wysiwyg': 'Rich Text Fields',
    'image': 'Image Fields',
    'file': 'File Fields',
    'uuid': 'ID Fields',
    'user': 'User Fields',
    'o2m': 'One to Many Relations',
    'm2o': 'Many to One Relations',
    'm2m': 'Many to Many Relations',
    'm2a': 'Many to Any Relations',
    'unknown': 'Other Fields'
  };
  
  return labels[fieldType] || fieldType.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase());
}