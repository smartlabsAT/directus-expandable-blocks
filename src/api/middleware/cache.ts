import type { Response, NextFunction } from 'express';
import { DirectusCacheWrapper } from '../services/DirectusCacheWrapper';
import type { CacheServiceConfig } from '../types/CacheTypes';

// Singleton cache instance
let cacheInstance: DirectusCacheWrapper | null = null;

/**
 * Get global cache configuration from environment variables
 */
function getGlobalCacheConfig(): Partial<CacheServiceConfig> {
  const hasEnvConfig = process.env['EXPANDABLE_BLOCKS_CACHE_TTL_METADATA'] ||
                      process.env['EXPANDABLE_BLOCKS_CACHE_TTL_SEARCH'] ||
                      process.env['EXPANDABLE_BLOCKS_CACHE_TTL_DETAIL'] ||
                      process.env['EXPANDABLE_BLOCKS_CACHE_TTL_PATHS'];
  
  if (hasEnvConfig) {
    return {
      defaultTTL: parseInt(process.env['EXPANDABLE_BLOCKS_CACHE_DEFAULT_TTL'] || '30000'), // 30 sec default
      ttlOverrides: {
        metadata: parseInt(process.env['EXPANDABLE_BLOCKS_CACHE_TTL_METADATA'] || '0.5') * 60 * 1000,
        search: parseInt(process.env['EXPANDABLE_BLOCKS_CACHE_TTL_SEARCH'] || '0.5') * 60 * 1000,
        detail: parseInt(process.env['EXPANDABLE_BLOCKS_CACHE_TTL_DETAIL'] || '0.5') * 60 * 1000,
        paths: parseInt(process.env['EXPANDABLE_BLOCKS_CACHE_TTL_PATHS'] || '0.5') * 60 * 1000
      },
      maxKeys: parseInt(process.env['EXPANDABLE_BLOCKS_CACHE_MAX_SIZE'] || '50000'),
      prefix: 'expandable_blocks'
    };
  }
  
  return {
    defaultTTL: 30 * 1000, // 30 seconds
    ttlOverrides: {
      metadata: 30 * 1000,    // 30 seconds
      search: 30 * 1000,      // 30 seconds
      detail: 30 * 1000,      // 30 seconds
      paths: 30 * 1000        // 30 seconds
    },
    maxKeys: 50000,
    prefix: 'expandable_blocks'
  };
}

/**
 * Initialize cache instance
 */
function initializeCache(context: any): DirectusCacheWrapper {
  if (!cacheInstance) {
    const globalConfig = getGlobalCacheConfig();
    cacheInstance = new DirectusCacheWrapper({
      ...globalConfig,
      database: context.database,
      services: context.services
    });
    
    context.logger.info('[API] Initialized cache with global config:', {
      defaultTTL: globalConfig.defaultTTL,
      maxKeys: globalConfig.maxKeys,
      ttlOverrides: globalConfig.ttlOverrides
    });
  }
  return cacheInstance;
}

/**
 * Cache middleware - adds cache instance to request if enabled
 */
export function cacheMiddleware(context: any) {
  return (req: any, _res: Response, next: NextFunction) => {
    // Check if cache is disabled via header
    const cacheEnabled = req.headers['x-cache-enabled'] !== 'false';
    
    // Add cache to request
    (req as any).cache = cacheEnabled ? initializeCache(context) : null;
    
    // Add context to request for error handler
    (req as any).context = context;
    
    // Ensure accountability is available on request
    if (!req.accountability && context.accountability) {
      req.accountability = context.accountability;
    }
    
    next();
  };
}