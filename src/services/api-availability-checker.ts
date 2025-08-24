/**
 * API Availability Checker Service
 * 
 * Detects which APIs are available and determines feature availability
 * for graceful degradation when custom API is not available.
 */

import type { AxiosInstance } from 'axios';
import { logDebug, logWarn } from '../utils/logger-wrapper';

/**
 * Available features based on API availability
 */
export interface FeatureSet {
  // Core features (always available with native API)
  basicCRUD: boolean;           // Create, Read, Update, Delete operations
  search: boolean;              // Search functionality
  filtering: boolean;           // Filter by fields
  sorting: boolean;             // Sort results
  pagination: boolean;          // Paginate results
  
  // Advanced features (require custom API)
  relationChecking: boolean;    // Check where items are used
  usageTracking: boolean;       // Track item usage across collections
  deleteProtection: boolean;    // Prevent deletion of used items
  cascadeDelete: boolean;       // Delete related items
  usageSummary: boolean;        // Show usage statistics
  
  // API availability
  hasCustomApi: boolean;        // Custom expandable-blocks-api available
  hasNativeApi: boolean;        // Native Directus API available
}

/**
 * API endpoints to check
 */
interface ApiEndpoints {
  custom: string;
  native: string;
}

/**
 * Cache for API availability checks
 */
interface AvailabilityCache {
  customApi: boolean | null;
  nativeApi: boolean | null;
  lastCheck: number;
  ttl: number; // Time to live in milliseconds
}

export class ApiAvailabilityChecker {
  private api: AxiosInstance;
  private cache: AvailabilityCache;
  private endpoints: ApiEndpoints;
  
  constructor(api: AxiosInstance) {
    this.api = api;
    this.cache = {
      customApi: null,
      nativeApi: null,
      lastCheck: 0,
      ttl: 5 * 60 * 1000 // 5 minutes cache
    };
    this.endpoints = {
      custom: '/expandable-blocks-api/health',
      native: '/server/info'
    };
  }
  
  /**
   * Check if custom API is available
   */
  async checkCustomApiAvailable(): Promise<boolean> {
    // Check cache first
    if (this.isCacheValid() && this.cache.customApi !== null) {
      logDebug('Using cached custom API availability', { available: this.cache.customApi });
      return this.cache.customApi;
    }
    
    try {
      logDebug('Checking custom API availability');
      
      // Try to access the custom API health endpoint
      // We use a lightweight endpoint that should respond quickly
      const response = await this.api.get(this.endpoints.custom, {
        timeout: 3000, // 3 second timeout
        validateStatus: (status) => status === 200 || status === 404
      });
      
      const available = response.status === 200;
      
      // Cache the result
      this.cache.customApi = available;
      this.cache.lastCheck = Date.now();
      
      if (available) {
        logDebug('Custom expandable-blocks-api is available');
      } else {
        logWarn('Custom expandable-blocks-api is not available - using degraded mode');
      }
      
      return available;
    } catch (error: any) {
      logWarn('Failed to check custom API availability', { error: error.message });
      
      // Cache the negative result
      this.cache.customApi = false;
      this.cache.lastCheck = Date.now();
      
      return false;
    }
  }
  
  /**
   * Check if native Directus API is available
   */
  async checkNativeApiAvailable(): Promise<boolean> {
    // Check cache first
    if (this.isCacheValid() && this.cache.nativeApi !== null) {
      logDebug('Using cached native API availability', { available: this.cache.nativeApi });
      return this.cache.nativeApi;
    }
    
    try {
      logDebug('Checking native API availability');
      
      // Try to access a basic Directus endpoint
      const response = await this.api.get(this.endpoints.native, {
        timeout: 3000,
        validateStatus: (status) => status === 200
      });
      
      const available = response.status === 200;
      
      // Cache the result
      this.cache.nativeApi = available;
      this.cache.lastCheck = Date.now();
      
      if (!available) {
        logWarn('Native Directus API is not responding properly');
      }
      
      return available;
    } catch (error: any) {
      logWarn('Failed to check native API availability', { error: error.message });
      
      // Native API should always be available in Directus context
      // If it's not, something is seriously wrong
      return false;
    }
  }
  
  /**
   * Get available features based on API availability
   */
  async getAvailableFeatures(): Promise<FeatureSet> {
    const [hasCustomApi, hasNativeApi] = await Promise.all([
      this.checkCustomApiAvailable(),
      this.checkNativeApiAvailable()
    ]);
    
    return {
      // Core features - available with native API
      basicCRUD: hasNativeApi,
      search: hasNativeApi,
      filtering: hasNativeApi,
      sorting: hasNativeApi,
      pagination: hasNativeApi,
      
      // Advanced features - require custom API
      relationChecking: hasCustomApi,
      usageTracking: hasCustomApi,
      deleteProtection: hasCustomApi,
      cascadeDelete: hasCustomApi,
      usageSummary: hasCustomApi,
      
      // API status
      hasCustomApi,
      hasNativeApi
    };
  }
  
  /**
   * Clear the cache to force fresh checks
   */
  clearCache(): void {
    this.cache = {
      customApi: null,
      nativeApi: null,
      lastCheck: 0,
      ttl: this.cache.ttl
    };
    logDebug('API availability cache cleared');
  }
  
  /**
   * Check if cache is still valid
   */
  private isCacheValid(): boolean {
    const now = Date.now();
    const age = now - this.cache.lastCheck;
    return age < this.cache.ttl;
  }
  
  /**
   * Get a human-readable status message
   */
  async getStatusMessage(): Promise<string> {
    const features = await this.getAvailableFeatures();
    
    if (!features.hasNativeApi) {
      return 'Fehler: Keine API-Verbindung verfügbar';
    }
    
    if (!features.hasCustomApi) {
      return 'Eingeschränkter Modus: Erweiterte Features nicht verfügbar';
    }
    
    return 'Alle Features verfügbar';
  }
  
  /**
   * Check if a specific feature is available
   */
  async isFeatureAvailable(feature: keyof FeatureSet): Promise<boolean> {
    const features = await this.getAvailableFeatures();
    return features[feature] === true;
  }
}

/**
 * Factory function to create availability checker
 */
export function createApiAvailabilityChecker(api: AxiosInstance): ApiAvailabilityChecker {
  return new ApiAvailabilityChecker(api);
}