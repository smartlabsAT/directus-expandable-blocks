import type { Request, Response, NextFunction } from 'express';
import { 
  ENV_VARS, 
  DEFAULT_ALLOWED_ORIGINS, 
  HEADERS, 
  API_VERSION 
} from '../constants';

/**
 * Security headers middleware
 * Adds various security headers to protect against common vulnerabilities
 */
export function securityHeaders() {
  return (req: Request, res: Response, next: NextFunction) => {
    // Prevent clickjacking attacks
    res.setHeader(HEADERS.FRAME_OPTIONS, 'DENY');
    
    // Prevent MIME type sniffing
    res.setHeader(HEADERS.CONTENT_TYPE_OPTIONS, 'nosniff');
    
    // Enable XSS protection (for older browsers)
    res.setHeader(HEADERS.XSS_PROTECTION, '1; mode=block');
    
    // Control referrer information
    res.setHeader(HEADERS.REFERRER_POLICY, 'strict-origin-when-cross-origin');
    
    // Content Security Policy - adjust based on your needs
    // This is a restrictive policy suitable for APIs
    res.setHeader(
      HEADERS.CSP,
      "default-src 'none'; " +
      "frame-ancestors 'none'; " +
      "form-action 'none'; " +
      "base-uri 'none'"
    );
    
    // Permissions Policy (formerly Feature Policy)
    res.setHeader(
      HEADERS.PERMISSIONS_POLICY,
      'accelerometer=(), camera=(), geolocation=(), gyroscope=(), magnetometer=(), microphone=(), payment=(), usb=()'
    );
    
    // Strict Transport Security (only if using HTTPS)
    if (req.secure || req.headers[HEADERS.FORWARDED_PROTO] === 'https') {
      res.setHeader(
        HEADERS.HSTS,
        'max-age=31536000; includeSubDomains; preload'
      );
    }
    
    // Remove X-Powered-By header
    res.removeHeader(HEADERS.POWERED_BY);
    
    // Add custom security header
    res.setHeader(HEADERS.API_VERSION, API_VERSION);
    
    next();
  };
}

/**
 * Get allowed origins from environment or defaults
 */
function getAllowedOrigins(): string[] {
  const envOrigins = process.env[ENV_VARS.ALLOWED_ORIGINS];
  
  if (envOrigins) {
    return envOrigins.split(',').map(origin => origin.trim());
  }
  
  // Default origins for development
  return [...DEFAULT_ALLOWED_ORIGINS];
}

/**
 * Check if origin matches allowed patterns
 */
function isOriginAllowed(origin: string, allowedOrigins: string[]): boolean {
  return allowedOrigins.some(allowed => {
    // Exact match
    if (allowed === origin) {
      return true;
    }
    
    // Wildcard subdomain match (e.g., *.example.com)
    if (allowed.startsWith('*.')) {
      const domain = allowed.substring(2);
      const originDomain = origin.replace(/^https?:\/\//, '');
      return originDomain.endsWith(domain);
    }
    
    return false;
  });
}

/**
 * CORS configuration for the API
 * This should be configured based on your specific requirements
 */
export function corsMiddleware() {
  return (req: Request, res: Response, next: NextFunction) => {
    const origin = req.headers[HEADERS.ORIGIN] as string | undefined;
    
    // Get allowed origins from environment
    const allowedOrigins = getAllowedOrigins();
    
    // Check if origin is allowed
    if (origin && isOriginAllowed(origin, allowedOrigins)) {
      res.setHeader(HEADERS.ALLOW_ORIGIN, origin);
    } else if (!origin) {
      // Allow requests without origin (e.g., server-side requests)
      res.setHeader(HEADERS.ALLOW_ORIGIN, '*');
    }
    
    // Allow credentials
    res.setHeader(HEADERS.ALLOW_CREDENTIALS, 'true');
    
    // Allowed methods
    res.setHeader(HEADERS.ALLOW_METHODS, 'GET, POST, OPTIONS');
    
    // Allowed headers
    res.setHeader(
      HEADERS.ALLOW_HEADERS,
      'Content-Type, Authorization, X-Requested-With, X-Cache-Enabled'
    );
    
    // Max age for preflight cache
    res.setHeader(HEADERS.MAX_AGE, '86400'); // 24 hours
    
    // Handle preflight requests
    if (req.method === 'OPTIONS') {
      res.status(204).end();
      return;
    }
    
    next();
  };
}