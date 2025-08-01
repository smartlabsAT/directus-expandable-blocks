/**
 * Error handling utilities for API services
 */

/**
 * Extract a meaningful error message from any error type
 * @param error The error object (can be any type)
 * @returns A string error message
 */
export function getErrorMessage(error: unknown): string {
  // Check for Directus structured error format first
  if (error && typeof error === 'object') {
    // Check for Directus structured error format
    if ('errors' in error && Array.isArray((error as any).errors) && (error as any).errors[0]?.message) {
      return (error as any).errors[0].message;
    }
    
    // Check for Directus API response error
    if ('response' in error && (error as any).response?.data?.errors?.[0]?.message) {
      return (error as any).response.data.errors[0].message;
    }
  }
  
  // Standard error handling
  return error instanceof Error ? error.message : String(error);
}

/**
 * Extract a meaningful error message from various Directus error formats
 * @deprecated Use getErrorMessage() instead
 * @param error The error object from Directus
 * @returns A user-friendly error message
 */
export function extractDirectusErrorMessage(error: any): string {
  return getErrorMessage(error);
}

/**
 * Check if an error is a permission/access error
 * @param error The error to check
 * @returns true if it's a permission error
 */
export function isPermissionError(error: any): boolean {
  const message = getErrorMessage(error).toLowerCase();
  return message.includes('permission') || 
         message.includes('access') ||
         message.includes('forbidden') ||
         message.includes('does not exist') || // Directus often says "or it does not exist" for permission errors
         error?.code === 'FORBIDDEN' ||
         error?.extensions?.code === 'FORBIDDEN';
}

/**
 * Create a formatted error message with context
 * @param context The context where the error occurred
 * @param operation The operation that failed
 * @param error The error object
 * @returns Formatted error message
 */
export function formatErrorMessage(context: string, operation: string, error: unknown): string {
  return `[${context}] Failed to ${operation}: ${getErrorMessage(error)}`;
}