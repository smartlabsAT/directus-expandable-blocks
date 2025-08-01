/**
 * API Constants - All magic numbers and strings in one place
 */

/**
 * HTTP Status Codes
 */
export const HTTP_STATUS = {
  OK: 200,
  NO_CONTENT: 204,
  BAD_REQUEST: 400,
  FORBIDDEN: 403,
  NOT_FOUND: 404,
  TOO_MANY_REQUESTS: 429,
  INTERNAL_SERVER_ERROR: 500,
} as const;

/**
 * Error Messages
 */
export const ERROR_MESSAGES = {
  COLLECTION_REQUIRED: 'Collection name is required',
  COLLECTION_NOT_ALLOWED: 'Collection is not allowed',
  COLLECTION_INVALID_FORMAT: 'Invalid collection name format',
  IDS_REQUIRED: 'ids array is required',
  IDS_EMPTY: 'At least one ID is required',
  IDS_TOO_MANY: 'Too many IDs requested',
  INVALID_ID: 'Invalid ID format',
  INVALID_FIELD: 'Invalid field name',
  INVALID_FILTER: 'Invalid filter parameter',
  INVALID_SORT: 'Invalid sort parameter',
  INVALID_LIMIT: 'Invalid limit parameter. Must be between -1 and 1000',
  INVALID_OFFSET: 'Invalid offset parameter. Must be >= 0',
  ACCESS_DENIED: 'Access denied',
  GENERIC_ERROR: 'An error occurred processing your request',
  RATE_LIMIT_EXCEEDED: 'Rate limit exceeded. Please retry after',
} as const;

/**
 * Field Names and Special Values
 */
export const FIELD_CONSTANTS = {
  ALL_FIELDS: '*',
  ID_FIELD: 'id',
  STATUS_FIELD: 'status',
  SORT_FIELD: 'sort',
  FIELD_SEPARATOR: '.',
  FIELD_PREFIX_DESCENDING: '-',
} as const;

/**
 * Cache Time-To-Live values (in seconds)
 */
export const CACHE_TTL = {
  SHORT: 300,      // 5 minutes
  MEDIUM: 1800,    // 30 minutes
  LONG: 3600,      // 1 hour
  VERY_LONG: 86400 // 24 hours
} as const;

/**
 * API Limits
 */
export const API_LIMITS = {
  MAX_IDS_PER_REQUEST: 100,
  MAX_FIELD_DEPTH: 3,
  MAX_FILTER_DEPTH: 5,
  DEFAULT_LIMIT: 10,
  MAX_LIMIT: 1000,
  MIN_OFFSET: 0,
  RATE_LIMIT_WINDOW_MS: 60000, // 1 minute
  RATE_LIMIT_MAX_REQUESTS: 100,
  CACHE_CLEANUP_INTERVAL_MS: 60000, // 1 minute
} as const;

/**
 * Collection Patterns
 */
export const PATTERNS = {
  COLLECTION_NAME: /^[a-zA-Z][a-zA-Z0-9_]*$/,
  FIELD_NAME: /^[a-zA-Z][a-zA-Z0-9_]*(\.[a-zA-Z][a-zA-Z0-9_]*)*$/,
  NUMERIC_ID: /^\d+$/,
  UUID_ID: /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i,
  ALPHANUMERIC_ID: /^[a-zA-Z0-9_-]+$/,
} as const;

/**
 * Default Collections (if not configured via environment)
 */
export const DEFAULT_ALLOWED_COLLECTIONS = [
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
] as const;

/**
 * Environment Variable Names
 */
export const ENV_VARS = {
  ALLOWED_COLLECTIONS: 'EXPANDABLE_BLOCKS_ALLOWED_COLLECTIONS',
  ALLOWED_ORIGINS: 'EXPANDABLE_BLOCKS_ALLOWED_ORIGINS',
  NODE_ENV: 'NODE_ENV',
} as const;

/**
 * Production Environment Values
 */
export const ENVIRONMENTS = {
  PRODUCTION: 'production',
  DEVELOPMENT: 'development',
  TEST: 'test',
} as const;

/**
 * API Paths
 */
export const API_PATHS = {
  BASE: '/expandable-blocks-api',
  METADATA: '/:collection/metadata',
  SEARCH: '/:collection/search',
  DETAIL: '/:collection/detail',
  DOCS: '/docs',
  DOCS_YAML: '/docs.yaml',
} as const;

/**
 * Header Names
 */
export const HEADERS = {
  // Request Headers
  REQUEST_ID: 'x-request-id',
  CORRELATION_ID: 'x-correlation-id',
  TRACE_ID: 'x-trace-id',
  CACHE_ENABLED: 'x-cache-enabled',
  FORWARDED_FOR: 'x-forwarded-for',
  REAL_IP: 'x-real-ip',
  FORWARDED_PROTO: 'x-forwarded-proto',
  ORIGIN: 'origin',
  
  // Response Headers
  RATE_LIMIT: 'X-RateLimit-Limit',
  RATE_LIMIT_REMAINING: 'X-RateLimit-Remaining',
  RATE_LIMIT_RESET: 'X-RateLimit-Reset',
  RETRY_AFTER: 'Retry-After',
  API_VERSION: 'X-API-Version',
  REQUEST_ID_RESPONSE: 'X-Request-ID',
  
  // CORS Headers
  ALLOW_ORIGIN: 'Access-Control-Allow-Origin',
  ALLOW_CREDENTIALS: 'Access-Control-Allow-Credentials',
  ALLOW_METHODS: 'Access-Control-Allow-Methods',
  ALLOW_HEADERS: 'Access-Control-Allow-Headers',
  MAX_AGE: 'Access-Control-Max-Age',
  
  // Security Headers
  FRAME_OPTIONS: 'X-Frame-Options',
  CONTENT_TYPE_OPTIONS: 'X-Content-Type-Options',
  XSS_PROTECTION: 'X-XSS-Protection',
  REFERRER_POLICY: 'Referrer-Policy',
  CSP: 'Content-Security-Policy',
  PERMISSIONS_POLICY: 'Permissions-Policy',
  HSTS: 'Strict-Transport-Security',
  POWERED_BY: 'X-Powered-By',
} as const;

/**
 * API Version
 */
export const API_VERSION = '1.0.0';

/**
 * Default CORS Origins (if not configured via environment)
 */
export const DEFAULT_ALLOWED_ORIGINS = [
  'http://localhost:8055',
  'https://backend.smartlabs.dev',
  'http://localhost:3000',
  'http://localhost:5173'
] as const;