/**
 * Custom Error Classes for Expandable Blocks API
 * Provides a hierarchy of specific error types for better error handling
 */

import { HTTP_STATUS, ERROR_MESSAGES } from '../constants';

/**
 * Base API Error class
 * All custom errors should extend this class
 */
export abstract class APIError extends Error {
  public readonly statusCode: number;
  public readonly code: string;
  public readonly isOperational: boolean;

  protected constructor(message: string, statusCode: number, code: string, isOperational = true) {
    super(message);
    this.name = this.constructor.name;
    this.statusCode = statusCode;
    this.code = code;
    this.isOperational = isOperational;
    
    // Maintains proper stack trace for where our error was thrown
    Error.captureStackTrace(this, this.constructor);
  }

  /**
   * Convert error to JSON response format
   */
  public toJSON() {
    return {
      errors: [{
        message: this.message,
        extensions: {
          code: this.code
        }
      }]
    };
  }
}

/**
 * Validation Error - 400 Bad Request
 * Used when request data fails validation
 */
export class ValidationError extends APIError {
  constructor(message: string, code = 'VALIDATION_ERROR') {
    super(message, HTTP_STATUS.BAD_REQUEST, code);
  }
}


/**
 * Permission Error - 403 Forbidden
 * Used when user lacks permissions
 */
export class PermissionError extends APIError {
  constructor(message: string = ERROR_MESSAGES.ACCESS_DENIED) {
    super(message, HTTP_STATUS.FORBIDDEN, 'PERMISSION_DENIED');
  }
}

/**
 * Not Found Error - 404 Not Found
 * Used when requested resource doesn't exist
 */
export class NotFoundError extends APIError {
  constructor(resource: string, id?: string | number) {
    const message = id 
      ? `${resource} with id ${id} not found`
      : `${resource} not found`;
    super(message, HTTP_STATUS.NOT_FOUND, 'NOT_FOUND');
  }
}

/**
 * Rate Limit Error - 429 Too Many Requests
 * Used when rate limit is exceeded
 */
export class RateLimitError extends APIError {
  public readonly retryAfter: number;

  constructor(retryAfter: number) {
    super(
      `${ERROR_MESSAGES.RATE_LIMIT_EXCEEDED} ${retryAfter} seconds`,
      HTTP_STATUS.TOO_MANY_REQUESTS,
      'RATE_LIMIT_EXCEEDED'
    );
    this.retryAfter = retryAfter;
  }
}

/**
 * Database Error - 500 Internal Server Error
 * Used for database-related errors
 */
export class DatabaseError extends APIError {
  constructor(message: string, originalError?: Error) {
    super(
      message,
      HTTP_STATUS.INTERNAL_SERVER_ERROR,
      'DATABASE_ERROR',
      false // Not operational - indicates system issue
    );
    
    if (originalError) {
      this.stack = originalError.stack;
    }
  }
}

/**
 * Service Error - 500 Internal Server Error
 * Used for service-level errors
 */
export class ServiceError extends APIError {
  constructor(service: string, operation: string, originalError?: Error) {
    super(
      `${service} failed during ${operation}`,
      HTTP_STATUS.INTERNAL_SERVER_ERROR,
      'SERVICE_ERROR',
      false // Not operational - indicates system issue
    );
    
    if (originalError) {
      this.stack = originalError.stack;
    }
  }
}

/**
 * Type Guards
 */
export function isAPIError(error: unknown): error is APIError {
  return error instanceof APIError;
}

export function isOperationalError(error: unknown): boolean {
  if (error instanceof APIError) {
    return error.isOperational;
  }
  return false;
}

/**
 * Error Factory Functions
 */
export function createValidationError(field: string, value?: unknown): ValidationError {
  const message = value !== undefined
    ? `Invalid ${field}: ${JSON.stringify(value)}`
    : `${field} is required`;
  return new ValidationError(message);
}


export function createPermissionError(resource?: string): PermissionError {
  const message = resource
    ? `You do not have permission to access ${resource}`
    : ERROR_MESSAGES.ACCESS_DENIED;
  return new PermissionError(message);
}

export function createNotFoundError(resource: string, id?: string | number): NotFoundError {
  return new NotFoundError(resource, id);
}

export function createRateLimitError(retryAfter: number): RateLimitError {
  return new RateLimitError(retryAfter);
}

export function createDatabaseError(operation: string, error?: Error): DatabaseError {
  const message = `Database ${operation} failed`;
  return new DatabaseError(message, error);
}

export function createServiceError(service: string, operation: string, error?: Error): ServiceError {
  return new ServiceError(service, operation, error);
}