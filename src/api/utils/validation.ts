import { ValidationError } from '../errors';
import { 
  API_LIMITS, 
  PATTERNS, 
  ERROR_MESSAGES, 
  FIELD_CONSTANTS
} from '../constants';

/**
 * Validate collection name format for security
 */
export function validateCollection(collection: string): void {
  if (!collection) {
    throw new ValidationError(ERROR_MESSAGES.COLLECTION_REQUIRED);
  }
  
  // Security check for collection name format to prevent injection attacks
  if (!PATTERNS.COLLECTION_NAME.test(collection)) {
    throw new ValidationError(ERROR_MESSAGES.COLLECTION_INVALID_FORMAT);
  }
  
  // No whitelist check - rely on Directus permissions instead
}

/**
 * Validate and sanitize IDs
 */
export function validateIds(ids: any[]): (string | number)[] {
  if (!Array.isArray(ids)) {
    throw new ValidationError('IDs must be an array');
  }
  
  if (ids.length === 0) {
    throw new ValidationError(ERROR_MESSAGES.IDS_EMPTY);
  }
  
  if (ids.length > API_LIMITS.MAX_IDS_PER_REQUEST) {
    throw new ValidationError(ERROR_MESSAGES.IDS_TOO_MANY);
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
      if (PATTERNS.NUMERIC_ID.test(trimmedId)) {
        return parseInt(trimmedId, 10);
      }
      
      // Check UUID
      if (PATTERNS.UUID_ID.test(trimmedId)) {
        return trimmedId;
      }
      
      // Check alphanumeric
      if (PATTERNS.ALPHANUMERIC_ID.test(trimmedId) && trimmedId.length <= 255) {
        return trimmedId;
      }
    }
    
    throw new ValidationError(`${ERROR_MESSAGES.INVALID_ID} at index ${index}: ${JSON.stringify(id)}`);
  });
}

/**
 * Validate and sanitize field names
 */
export function validateFields(fields: any): string[] {
  if (!fields) {
    return [FIELD_CONSTANTS.ALL_FIELDS];
  }
  
  let fieldArray: string[];
  
  if (typeof fields === 'string') {
    if (fields === FIELD_CONSTANTS.ALL_FIELDS) {
      return [FIELD_CONSTANTS.ALL_FIELDS];
    }
    fieldArray = fields.split(',').map(f => f.trim());
  } else if (Array.isArray(fields)) {
    fieldArray = fields;
  } else {
    throw new ValidationError('Fields must be a string or array');
  }
  
  // Validate each field
  return fieldArray.map(field => {
    if (typeof field !== 'string') {
      throw new ValidationError('Field names must be strings');
    }
    
    const trimmedField = field.trim();
    
    // Allow * for all fields
    if (trimmedField === '*') {
      return '*';
    }
    
    // Check field name format (alphanumeric, underscore, dot for relations)
    if (!PATTERNS.FIELD_NAME.test(trimmedField)) {
      throw new ValidationError(`${ERROR_MESSAGES.INVALID_FIELD}: ${trimmedField}`);
    }
    
    // Check field depth
    const depth = trimmedField.split(FIELD_CONSTANTS.FIELD_SEPARATOR).length;
    if (depth > API_LIMITS.MAX_FIELD_DEPTH) {
      throw new ValidationError(`Field depth exceeds maximum allowed (${API_LIMITS.MAX_FIELD_DEPTH}): ${trimmedField}`);
    }
    
    return trimmedField;
  });
}

/**
 * Validate filter object depth to prevent complex queries
 */
export function validateFilterDepth(obj: any, currentDepth = 0): void {
  if (currentDepth > API_LIMITS.MAX_FILTER_DEPTH) {
    throw new ValidationError(`Filter depth exceeds maximum allowed (${API_LIMITS.MAX_FILTER_DEPTH})`);
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