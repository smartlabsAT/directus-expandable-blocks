import type { Response } from 'express';
import { createValidationError } from '../schemas/response-schemas';
import type { Logger } from '../types/common';
import { getErrorMessage } from './error-utils';

/**
 * Centralized error response handler to avoid code duplication
 * Handles different error types and sends appropriate HTTP responses
 */
export function handleErrorResponse(
  error: unknown,
  res: Response,
  logger: Logger,
  context: string = 'API'
): void {
  // Log error with context
  logger.error(`${context} error: ${getErrorMessage(error)}`);
  
  // Handle specific error types
  if (error instanceof Error) {
    const errorMessage = error.message.toLowerCase();
    
    // Permission/Access errors -> 403
    if (
      errorMessage.includes('not allowed') || 
      errorMessage.includes('collection') ||
      errorMessage.includes('permission') ||
      errorMessage.includes('access') ||
      errorMessage.includes('forbidden')
    ) {
      res.status(403).json(createValidationError('Access denied'));
      return;
    }
    
    // Validation errors -> 400
    if (
      errorMessage.includes('invalid') || 
      errorMessage.includes('required') ||
      errorMessage.includes('must be') ||
      errorMessage.includes('validation')
    ) {
      res.status(400).json(createValidationError(error.message));
      return;
    }
    
    // Not found errors -> 404
    if (
      errorMessage.includes('not found') ||
      errorMessage.includes('does not exist')
    ) {
      res.status(404).json(createValidationError('Resource not found'));
      return;
    }
  }
  
  // Generic error for unexpected issues
  res.status(500).json(createValidationError('An error occurred processing your request'));
}