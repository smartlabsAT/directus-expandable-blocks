/**
 * Response schemas and types for API endpoints
 */

/**
 * Error response format
 */
export interface ErrorResponse {
  errors: Array<{
    message: string;
    extensions: {
      code: string;
    };
  }>;
}

/**
 * Metadata endpoint response
 */
export interface MetadataResponse {
  collection: string;
  possibleLocations: any[];
  searchableFields: any[];
  displayableFields?: any[]; // All fields that can be displayed in UI
  translationInfo: {
    hasTranslations: boolean;
    [key: string]: any;
  };
  collectionMetadata: {
    totalFields: number;
    translatableCount: number;
    systemFieldsCount: number;
    [key: string]: any;
  };
  cached_at: string;
}

/**
 * Search endpoint response
 */
export interface SearchResponse {
  data: any[];
  meta: {
    total_count: number;
    filter_count: number;
    limit: number;
    offset: number;
    page?: number;
    page_count?: number;
  };
}

/**
 * Detail endpoint response
 */
export interface DetailResponse {
  data: Array<{
    [key: string]: any;
    usage_locations: UsageLocation[];
    usage_summary: UsageSummary;
  }>;
}

/**
 * Usage location structure
 */
export interface UsageLocation {
  id: string | number;
  collection: string;
  collection_display: string;
  title: string;
  status: string | null;
  field: string;
  field_display: string;
  sort: number | null;
  path: any[] | null;
  edit_url: string;
}

/**
 * Usage summary structure
 */
export interface UsageSummary {
  total_count: number;
  by_collection: Record<string, number>;
  by_status: Record<string, number>;
}

/**
 * Create error response
 */
export function createErrorResponse(message: string, code: string = 'INTERNAL_SERVER_ERROR'): ErrorResponse {
  return {
    errors: [{
      message,
      extensions: { code }
    }]
  };
}

/**
 * Create validation error response
 */
export function createValidationError(message: string): ErrorResponse {
  return createErrorResponse(message, 'INVALID_PAYLOAD');
}

/**
 * Create permission error response
 */
export function createPermissionError(message: string = 'You do not have permission to access this resource'): ErrorResponse {
  return createErrorResponse(message, 'FORBIDDEN');
}