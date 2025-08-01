import { ItemQuery, DEFAULT_QUERY, MAX_LIMIT } from '../types/ItemLoaderTypes';

/**
 * Normalize limit value with bounds checking
 */
export function normalizeLimit(limit?: number): number {
  if (limit === undefined || limit < 0) {
    return DEFAULT_QUERY.limit;
  }
  return Math.min(limit, MAX_LIMIT);
}

/**
 * Normalize offset value
 */
export function normalizeOffset(offset?: number): number {
  return Math.max(0, offset || 0);
}

/**
 * Normalize fields array
 */
export function normalizeFields(fields?: string[]): string[] {
  if (!fields || fields.length === 0) {
    return DEFAULT_QUERY.fields;
  }
  return fields;
}

/**
 * Normalize sort array
 */
export function normalizeSort(sort?: string[]): string[] {
  if (!Array.isArray(sort)) {
    return [];
  }
  return sort;
}

/**
 * Normalize and validate complete query parameters
 */
export function normalizeQuery(query: ItemQuery): Required<ItemQuery> {
  return {
    limit: normalizeLimit(query.limit),
    offset: normalizeOffset(query.offset),
    fields: normalizeFields(query.fields),
    filter: query.filter || undefined,
    search: query.search || '',
    sort: normalizeSort(query.sort),
    expandTranslations: query.expandTranslations ?? DEFAULT_QUERY.expandTranslations,
    deep: query.deep || undefined,
    returnMinimalOnPermissionError: query.returnMinimalOnPermissionError ?? DEFAULT_QUERY.returnMinimalOnPermissionError
  };
}