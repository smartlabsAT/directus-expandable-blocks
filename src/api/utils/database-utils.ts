import { Knex } from 'knex';

/**
 * Check if a table exists in the database
 * @param database Knex database connection
 * @param tableName The table name to check
 * @returns true if table exists
 */
export async function checkTableExists(database: Knex, tableName: string): Promise<boolean> {
  // Validate table name format for security
  if (!/^[a-zA-Z0-9_-]+$/.test(tableName) || tableName.length > 64) {
    return false;
  }
  
  try {
    // Use information_schema for PostgreSQL
    const result = await database('information_schema.tables')
      .where({
        table_schema: 'public',
        table_name: tableName
      })
      .first();
    return !!result;
  } catch {
    // Fallback to Knex schema API
    try {
      return await database.schema.hasTable(tableName);
    } catch {
      return false;
    }
  }
}

/**
 * Extract a meaningful error message from various Directus error formats
 * @param error The error object from Directus
 * @returns A user-friendly error message
 */
export function extractDirectusErrorMessage(error: any): string {
  // Check for Directus structured error format
  if (error?.errors?.[0]?.message) {
    return error.errors[0].message;
  }
  
  // Check for Directus API response error
  if (error?.response?.data?.errors?.[0]?.message) {
    return error.response.data.errors[0].message;
  }
  
  // Check for standard error message
  if (error?.message) {
    return error.message;
  }
  
  // Fallback
  return 'An unknown error occurred';
}

/**
 * Extract count from Directus aggregate query results
 * Handles various response formats from ItemsService.readByQuery with aggregate
 * @param result The aggregate query result
 * @returns The extracted count
 */
export function extractAggregateCount(result: any): number {
  if (!result || !Array.isArray(result) || result.length === 0) {
    return 0;
  }
  
  const firstResult = result[0];
  
  // Try different possible response formats
  return firstResult?.countDistinct?.id || 
         firstResult?.count?.id || 
         firstResult?.count ||
         0;
}

/**
 * Build a safe WHERE clause for collection validation
 * @param database Knex instance
 * @param collection Collection name to validate
 * @returns Knex query builder or null if invalid
 */
export function buildCollectionQuery(database: Knex, collection: string) {
  // Validate collection name
  if (!/^[a-zA-Z0-9_-]+$/.test(collection) || collection.length > 64) {
    return null;
  }
  
  return database
    .select('collection')
    .from('directus_collections')
    .where('collection', collection)
    .first();
}