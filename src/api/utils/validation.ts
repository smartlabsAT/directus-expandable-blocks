import { InvalidCollectionError } from '../types/errors';

/**
 * Security configuration for API validation
 */
export const SecurityConfig = {
  // Maximum allowed IDs in a single request
  MAX_IDS_PER_REQUEST: 100,
  
  // Maximum allowed field depth to prevent deep queries
  MAX_FIELD_DEPTH: 3,
  
  // Maximum allowed filter complexity
  MAX_FILTER_DEPTH: 5,
  
  // Rate limiting
  RATE_LIMIT_WINDOW_MS: 60 * 1000, // 1 minute
  RATE_LIMIT_MAX_REQUESTS: 100,
  
  // Allowed ID patterns (alphanumeric, uuid, numeric)
  ID_PATTERNS: {
    numeric: /^\d+$/,
    uuid: /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i,
    alphanumeric: /^[a-zA-Z0-9_-]+$/
  }
};

/**
 * Get allowed collections from environment or use defaults
 * In production, this should be configured via environment variables
 */
export function getAllowedCollections(): Set<string> {
  const envCollections = process.env.EXPANDABLE_BLOCKS_ALLOWED_COLLECTIONS;
  
  if (envCollections) {
    return new Set(envCollections.split(',').map(c => c.trim()));
  }
  
  // Default allowed collections - should be configured per deployment
  return new Set([
    'content_headline',
    'content_text',
    'content_image',
    'content_button',
    'content_video',
    'content_gallery',
    'content_accordion',
    'content_quote',
    'test_all_fields',
    'pages',
    'page_blocks'
  ]);
}

/**
 * Validate collection name against whitelist
 */
export function validateCollection(collection: string): void {
  if (!collection || typeof collection !== 'string') {
    throw new InvalidCollectionError('Collection name is required');
  }
  
  // Check against whitelist
  const allowedCollections = getAllowedCollections();
  if (!allowedCollections.has(collection)) {
    throw new InvalidCollectionError(`Collection '${collection}' is not allowed`);
  }
  
  // Additional security check for collection name format
  if (!/^[a-zA-Z][a-zA-Z0-9_]*$/.test(collection)) {
    throw new InvalidCollectionError('Invalid collection name format');
  }
}

/**
 * Validate and sanitize IDs
 */
export function validateIds(ids: any[]): (string | number)[] {
  if (!Array.isArray(ids)) {
    throw new Error('IDs must be an array');
  }
  
  if (ids.length === 0) {
    throw new Error('At least one ID is required');
  }
  
  if (ids.length > SecurityConfig.MAX_IDS_PER_REQUEST) {
    throw new Error(`Too many IDs requested. Maximum allowed: ${SecurityConfig.MAX_IDS_PER_REQUEST}`);
  }
  
  return ids.map((id, index) => {
    // Allow numeric IDs
    if (typeof id === 'number' && Number.isInteger(id) && id > 0) {
      return id;
    }
    
    // Allow string IDs that match our patterns
    if (typeof id === 'string') {
      const trimmedId = id.trim();
      
      // Check numeric string
      if (SecurityConfig.ID_PATTERNS.numeric.test(trimmedId)) {
        return parseInt(trimmedId, 10);
      }
      
      // Check UUID
      if (SecurityConfig.ID_PATTERNS.uuid.test(trimmedId)) {
        return trimmedId;
      }
      
      // Check alphanumeric
      if (SecurityConfig.ID_PATTERNS.alphanumeric.test(trimmedId) && trimmedId.length <= 255) {
        return trimmedId;
      }
    }
    
    throw new Error(`Invalid ID at index ${index}: ${JSON.stringify(id)}`);
  });
}

/**
 * Validate and sanitize field names
 */
export function validateFields(fields: any): string[] {
  if (!fields) {
    return ['*'];
  }
  
  let fieldArray: string[];
  
  if (typeof fields === 'string') {
    if (fields === '*') {
      return ['*'];
    }
    fieldArray = fields.split(',').map(f => f.trim());
  } else if (Array.isArray(fields)) {
    fieldArray = fields;
  } else {
    throw new Error('Fields must be a string or array');
  }
  
  // Validate each field
  return fieldArray.map(field => {
    if (typeof field !== 'string') {
      throw new Error('Field names must be strings');
    }
    
    const trimmedField = field.trim();
    
    // Allow * for all fields
    if (trimmedField === '*') {
      return '*';
    }
    
    // Check field name format (alphanumeric, underscore, dot for relations)
    if (!/^[a-zA-Z][a-zA-Z0-9_]*(\.[a-zA-Z][a-zA-Z0-9_]*)*$/.test(trimmedField)) {
      throw new Error(`Invalid field name: ${trimmedField}`);
    }
    
    // Check field depth
    const depth = trimmedField.split('.').length;
    if (depth > SecurityConfig.MAX_FIELD_DEPTH) {
      throw new Error(`Field depth exceeds maximum allowed (${SecurityConfig.MAX_FIELD_DEPTH}): ${trimmedField}`);
    }
    
    return trimmedField;
  });
}

/**
 * Validate filter object depth to prevent complex queries
 */
export function validateFilterDepth(obj: any, currentDepth = 0): void {
  if (currentDepth > SecurityConfig.MAX_FILTER_DEPTH) {
    throw new Error(`Filter depth exceeds maximum allowed (${SecurityConfig.MAX_FILTER_DEPTH})`);
  }
  
  if (obj && typeof obj === 'object') {
    for (const key in obj) {
      if (obj.hasOwnProperty(key)) {
        validateFilterDepth(obj[key], currentDepth + 1);
      }
    }
  }
}

/**
 * Sanitize and validate filter object
 */
export function validateFilter(filter: any): any {
  if (!filter) {
    return undefined;
  }
  
  // Parse if string
  let filterObj = filter;
  if (typeof filter === 'string') {
    try {
      filterObj = JSON.parse(filter);
    } catch (error) {
      throw new Error('Invalid JSON in filter parameter');
    }
  }
  
  // Check filter depth
  validateFilterDepth(filterObj);
  
  // TODO: Add more specific filter validation based on Directus filter format
  
  return filterObj;
}

/**
 * Validate sort parameter
 */
export function validateSort(sort: any): string[] | undefined {
  if (!sort) {
    return undefined;
  }
  
  let sortArray: string[];
  
  if (typeof sort === 'string') {
    sortArray = sort.split(',').map(s => s.trim());
  } else if (Array.isArray(sort)) {
    sortArray = sort;
  } else {
    throw new Error('Sort must be a string or array');
  }
  
  return sortArray.map(field => {
    if (typeof field !== 'string') {
      throw new Error('Sort fields must be strings');
    }
    
    const trimmedField = field.trim();
    
    // Remove leading - for descending sort
    const fieldName = trimmedField.startsWith('-') ? trimmedField.substring(1) : trimmedField;
    
    // Validate field name
    if (!/^[a-zA-Z][a-zA-Z0-9_]*(\.[a-zA-Z][a-zA-Z0-9_]*)*$/.test(fieldName)) {
      throw new Error(`Invalid sort field: ${fieldName}`);
    }
    
    return trimmedField;
  });
}

/**
 * Validate pagination parameters
 */
export function validatePagination(limit: any, offset: any): { limit: number; offset: number } {
  let validatedLimit = 10;
  let validatedOffset = 0;
  
  if (limit !== undefined) {
    const parsedLimit = typeof limit === 'string' ? parseInt(limit, 10) : limit;
    if (!Number.isInteger(parsedLimit) || parsedLimit < -1 || parsedLimit > 1000) {
      throw new Error('Invalid limit parameter. Must be between -1 and 1000');
    }
    validatedLimit = parsedLimit;
  }
  
  if (offset !== undefined) {
    const parsedOffset = typeof offset === 'string' ? parseInt(offset, 10) : offset;
    if (!Number.isInteger(parsedOffset) || parsedOffset < 0) {
      throw new Error('Invalid offset parameter. Must be >= 0');
    }
    validatedOffset = parsedOffset;
  }
  
  return { limit: validatedLimit, offset: validatedOffset };
}

/**
 * Check if running in production environment
 */
export function isProduction(): boolean {
  return process.env.NODE_ENV === 'production';
}