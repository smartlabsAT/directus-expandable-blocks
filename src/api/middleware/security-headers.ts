import type { Request, Response, NextFunction } from 'express';

/**
 * Security headers middleware
 * Adds various security headers to protect against common vulnerabilities
 */
export function securityHeaders() {
  return (req: Request, res: Response, next: NextFunction) => {
    // Prevent clickjacking attacks
    res.setHeader('X-Frame-Options', 'DENY');
    
    // Prevent MIME type sniffing
    res.setHeader('X-Content-Type-Options', 'nosniff');
    
    // Enable XSS protection (for older browsers)
    res.setHeader('X-XSS-Protection', '1; mode=block');
    
    // Control referrer information
    res.setHeader('Referrer-Policy', 'strict-origin-when-cross-origin');
    
    // Content Security Policy - adjust based on your needs
    // This is a restrictive policy suitable for APIs
    res.setHeader(
      'Content-Security-Policy',
      "default-src 'none'; " +
      "frame-ancestors 'none'; " +
      "form-action 'none'; " +
      "base-uri 'none'"
    );
    
    // Permissions Policy (formerly Feature Policy)
    res.setHeader(
      'Permissions-Policy',
      'accelerometer=(), camera=(), geolocation=(), gyroscope=(), magnetometer=(), microphone=(), payment=(), usb=()'
    );
    
    // Strict Transport Security (only if using HTTPS)
    if (req.secure || req.headers['x-forwarded-proto'] === 'https') {
      res.setHeader(
        'Strict-Transport-Security',
        'max-age=31536000; includeSubDomains; preload'
      );
    }
    
    // Remove X-Powered-By header
    res.removeHeader('X-Powered-By');
    
    // Add custom security header
    res.setHeader('X-API-Version', '1.0.0');
    
    next();
  };
}

/**
 * CORS configuration for the API
 * This should be configured based on your specific requirements
 */
export function corsMiddleware() {
  return (req: Request, res: Response, next: NextFunction) => {
    const origin = req.headers.origin;
    
    // List of allowed origins - adjust based on your needs
    const allowedOrigins = [
      'http://localhost:8055',
      'https://backend.smartlabs.dev',
      // Add more allowed origins as needed
    ];
    
    // Check if origin is allowed
    if (origin && allowedOrigins.includes(origin)) {
      res.setHeader('Access-Control-Allow-Origin', origin);
    }
    
    // Allow credentials
    res.setHeader('Access-Control-Allow-Credentials', 'true');
    
    // Allowed methods
    res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
    
    // Allowed headers
    res.setHeader(
      'Access-Control-Allow-Headers',
      'Content-Type, Authorization, X-Requested-With, X-Cache-Enabled'
    );
    
    // Max age for preflight cache
    res.setHeader('Access-Control-Max-Age', '86400'); // 24 hours
    
    // Handle preflight requests
    if (req.method === 'OPTIONS') {
      res.status(204).end();
      return;
    }
    
    next();
  };
}