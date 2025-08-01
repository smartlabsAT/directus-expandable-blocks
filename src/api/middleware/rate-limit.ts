import type { Request, Response, NextFunction } from 'express';
import { SecurityConfig } from '../utils/validation';
import { createValidationError } from '../schemas/response-schemas';

interface RateLimitStore {
  [key: string]: {
    count: number;
    resetTime: number;
  };
}

// In-memory store for rate limiting
// In production, this should use Redis or similar
const rateLimitStore: RateLimitStore = {};

// Clean up old entries periodically
setInterval(() => {
  const now = Date.now();
  for (const key in rateLimitStore) {
    if (rateLimitStore[key].resetTime < now) {
      delete rateLimitStore[key];
    }
  }
}, 60000); // Clean every minute

/**
 * Simple rate limiting middleware
 * In production, use a proper solution like express-rate-limit with Redis store
 */
export function rateLimitMiddleware() {
  return (req: Request, res: Response, next: NextFunction) => {
    // Skip rate limiting for OPTIONS requests
    if (req.method === 'OPTIONS') {
      return next();
    }
    
    // Get client identifier (IP or user ID)
    const clientId = getClientIdentifier(req);
    const now = Date.now();
    const windowStart = now - SecurityConfig.RATE_LIMIT_WINDOW_MS;
    
    // Get or create rate limit entry
    let entry = rateLimitStore[clientId];
    
    if (!entry || entry.resetTime < now) {
      // Create new entry
      entry = {
        count: 1,
        resetTime: now + SecurityConfig.RATE_LIMIT_WINDOW_MS
      };
      rateLimitStore[clientId] = entry;
    } else {
      // Increment counter
      entry.count++;
    }
    
    // Check if limit exceeded
    if (entry.count > SecurityConfig.RATE_LIMIT_MAX_REQUESTS) {
      // Calculate retry after
      const retryAfter = Math.ceil((entry.resetTime - now) / 1000);
      
      res.setHeader('X-RateLimit-Limit', SecurityConfig.RATE_LIMIT_MAX_REQUESTS.toString());
      res.setHeader('X-RateLimit-Remaining', '0');
      res.setHeader('X-RateLimit-Reset', new Date(entry.resetTime).toISOString());
      res.setHeader('Retry-After', retryAfter.toString());
      
      res.status(429).json(
        createValidationError(
          `Rate limit exceeded. Please retry after ${retryAfter} seconds.`
        )
      );
      return;
    }
    
    // Set rate limit headers
    res.setHeader('X-RateLimit-Limit', SecurityConfig.RATE_LIMIT_MAX_REQUESTS.toString());
    res.setHeader('X-RateLimit-Remaining', (SecurityConfig.RATE_LIMIT_MAX_REQUESTS - entry.count).toString());
    res.setHeader('X-RateLimit-Reset', new Date(entry.resetTime).toISOString());
    
    next();
  };
}

/**
 * Get client identifier for rate limiting
 */
function getClientIdentifier(req: Request): string {
  // Check for authenticated user
  const accountability = (req as any).accountability;
  if (accountability?.user) {
    return `user:${accountability.user}`;
  }
  
  // Use IP address as fallback
  const ip = req.headers['x-forwarded-for'] || 
             req.headers['x-real-ip'] || 
             req.socket.remoteAddress || 
             'unknown';
             
  return `ip:${ip}`;
}