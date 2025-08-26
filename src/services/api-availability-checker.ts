/**
 * API Availability Checker Service
 * 
 * Detects which APIs are available and determines feature availability
 * for graceful degradation when custom API is not available.
 */

import type { AxiosInstance } from 'axios';
import { logDebug, logError, logWarn } from '../utils/logger-wrapper';

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


export class ApiAvailabilityChecker {
  private api: AxiosInstance;
  private endpoints: ApiEndpoints;
  private customApiAvailable: boolean | null = null;
  private nativeApiAvailable: boolean | null = null;
  private hasChecked: boolean = false;
  
  constructor(api: AxiosInstance) {
    this.api = api;
    this.endpoints = {
      custom: '/expandable-blocks-api/health',
      native: '/server/info'
    };
  }
  
  /**
   * Check if custom API is available
   */
  async checkCustomApiAvailable(): Promise<boolean> {
    // Use stored result if we've already checked
    if (this.hasChecked && this.customApiAvailable !== null) {
      return this.customApiAvailable;
    }
    
    try {
      // Only log on first check
      if (!this.hasChecked) {
        logDebug('Checking custom API availability');
      }
      
      // Try to access the custom API health endpoint
      // We use a lightweight endpoint that should respond quickly
      const response = await this.api.get(this.endpoints.custom, {
        timeout: 3000, // 3 second timeout
        validateStatus: (status) => status === 200 || status === 404
      });
      
      const available = response.status === 200;
      
      // Store the result
      this.customApiAvailable = available;
      
      // Log only on first check
      if (!this.hasChecked) {
        if (available) {
          logDebug('Custom expandable-blocks-api is available');
        } else {
          logDebug('Custom expandable-blocks-api is not available - using native API only');
        }
      }
      
      this.hasChecked = true;
      
      return available;
    } catch (error: any) {
      // Only log on first check to avoid console spam
      if (!this.hasChecked) {
        logDebug('Custom API not found, using native API', { message: error.message });
      }
      
      // Store the negative result
      this.customApiAvailable = false;
      this.hasChecked = true;
      
      return false;
    }
  }
  
  /**
   * Check if native Directus API is available
   */
  async checkNativeApiAvailable(): Promise<boolean> {
    // Use stored result if we've already checked
    if (this.nativeApiAvailable !== null) {
      return this.nativeApiAvailable;
    }
    
    try {
      // Native API should always be available in Directus context
      // We do a simple check just to be sure
      const response = await this.api.get(this.endpoints.native, {
        timeout: 3000,
        validateStatus: (status) => status === 200
      });
      
      const available = response.status === 200;
      
      // Store the result
      this.nativeApiAvailable = available;
      
      if (!available) {
        logWarn('Native Directus API is not responding properly');
      }
      
      return available;
    } catch (error: any) {
      // Native API should always be available
      // If it's not, something is seriously wrong
      logError('Critical: Native Directus API is not available', error);
      this.nativeApiAvailable = false;
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