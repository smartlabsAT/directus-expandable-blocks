/**
 * Request schemas and types for API endpoints
 */

/**
 * Query parameters for metadata endpoint
 */
export interface MetadataRequest {
  params: {
    collection: string;
  };
}

/**
 * Query parameters for search endpoint
 */
export interface SearchRequest {
  params: {
    collection: string;
  };
  query: {
    limit?: string | number;
    offset?: string | number;
    search?: string;
    filter?: string | any;
    fields?: string | string[];
    sort?: string;
  };
}

/**
 * Body parameters for detail endpoint
 */
export interface DetailRequest {
  params: {
    collection: string;
  };
  body: {
    ids: (string | number)[];
    fields?: string | string[];
  };
}

/**
 * Parse and validate search query parameters
 */
export function parseSearchQuery(query: SearchRequest['query']): {
  limit: number;
  offset: number;
  search?: string;
  filter?: any;
  fields: string[];
  sort?: string[];
} {
  const { limit = 10, offset = 0, search, filter, fields = '*', sort } = query;
  
  // Parse fields - handle both array and string formats
  let parsedFields: string[];
  if (Array.isArray(fields)) {
    parsedFields = fields;
  } else if (fields === '*') {
    parsedFields = ['*'];
  } else {
    parsedFields = String(fields).split(',').map(f => f.trim());
  }
  
  // Parse filter
  let parsedFilter: any;
  if (filter) {
    parsedFilter = typeof filter === 'string' ? JSON.parse(filter) : filter;
  }
  
  // Parse sort
  let parsedSort: string[] | undefined;
  if (sort) {
    parsedSort = String(sort).split(',').map(s => s.trim());
  }
  
  return {
    limit: Math.max(0, Number(limit)),
    offset: Math.max(0, Number(offset)),
    search: search as string | undefined,
    filter: parsedFilter,
    fields: parsedFields,
    sort: parsedSort
  };
}

/**
 * Validate detail request body
 */
export function validateDetailRequest(body: any): { ids: (string | number)[], fields: string[] } {
  if (!body.ids || !Array.isArray(body.ids) || body.ids.length === 0) {
    throw new Error('Missing or invalid ids array in request body');
  }
  
  const fields = body.fields 
    ? (Array.isArray(body.fields) ? body.fields : String(body.fields).split(',').map(f => f.trim()))
    : ['*'];
  
  return {
    ids: body.ids,
    fields
  };
}

