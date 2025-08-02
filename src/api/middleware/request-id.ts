import type { Request, Response, NextFunction } from 'express';
import { randomUUID } from 'crypto';
import { HEADERS } from '../constants';

declare global {
  namespace Express {
    interface Request {
      id?: string;
    }
  }
}

/**
 * Request ID middleware for tracking and debugging
 * Adds a unique ID to each request for tracing through logs
 */
export function requestIdMiddleware() {
  return (req: Request, res: Response, next: NextFunction) => {
    // Check if request already has an ID from upstream proxy
    const existingId = req.headers[HEADERS.REQUEST_ID] || 
                      req.headers[HEADERS.CORRELATION_ID] ||
                      req.headers[HEADERS.TRACE_ID];
    
    // Use existing ID or generate new one
    req.id = (existingId as string) || randomUUID();
    
    // Add to response headers for client correlation
    res.setHeader(HEADERS.REQUEST_ID_RESPONSE, req.id);
    
    // Add to logger context if available
    const logger = (req as any).logger;
    if (logger && typeof logger.child === 'function') {
      (req as any).logger = logger.child({ requestId: req.id });
    }
    
    next();
  };
}