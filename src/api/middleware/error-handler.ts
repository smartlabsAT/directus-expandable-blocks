import type { Response, NextFunction } from 'express';
import { getErrorMessage, isPermissionError } from '../utils/error-utils';
import { createErrorResponse, createPermissionError } from '../schemas/response-schemas';
import { isProduction } from '../utils/validation';

/**
 * Error handler middleware factory for API endpoints
 * Creates an Express error handling middleware with access to Directus context
 */
export function errorHandler(context: any) {
  return (err: any, req: any, res: Response, next: NextFunction) => {
    // If no error, pass to next
    if (!err) {
      return next();
    }

    // Log error for debugging
    const errorLog: any = {
      requestId: (req as any).id,
      path: req.path,
      method: req.method,
      error: getErrorMessage(err)
    };
    
    // Only include stack trace in development
    if (!isProduction() && err instanceof Error) {
      errorLog.stack = err.stack;
    }
    
    context.logger.error('API Error:', errorLog);

    // Check if response was already sent
    if (res.headersSent) {
      return next(err);
    }

    // Handle validation errors
    if (err instanceof Error && err.name === 'ValidationError') {
      return res.status(400).json(createErrorResponse(err.message, 'VALIDATION_ERROR'));
    }

    // Handle permission errors
    if (isPermissionError(err)) {
      return res.status(403).json(createPermissionError());
    }

    // Handle other validation-like errors
    if (err instanceof Error && err.message.toLowerCase().includes('invalid')) {
      return res.status(400).json(createErrorResponse(err.message, 'INVALID_PAYLOAD'));
    }

    // Extract error details
    let errorMessage = getErrorMessage(err);
    let errorCode = 'INTERNAL_SERVER_ERROR';
    
    // Check for Directus-specific error structure
    if (err && typeof err === 'object' && 'extensions' in err) {
      errorCode = (err as any).extensions?.code || errorCode;
    }

    // Send error response
    res.status(500).json(createErrorResponse(errorMessage, errorCode));
  };
}