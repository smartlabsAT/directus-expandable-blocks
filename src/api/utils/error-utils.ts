/**
 * Error handling utilities for API services
 */

/**
 * Extract a meaningful error message from any error type
 * @param error The error object (can be any type)
 * @returns A string error message
 */
export function getErrorMessage(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
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