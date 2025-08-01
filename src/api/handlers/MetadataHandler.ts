import type { Response } from 'express';
import type { DirectusRequest } from '../types/directus-api';
import { ServiceFactory } from '../factories/ServiceFactory';
import { DirectusCacheWrapper } from '../services/DirectusCacheWrapper';
import { CacheTTL } from '../types/CacheTypes';
import type { MetadataResponse } from '../schemas/response-schemas';
import type { MetadataRequest } from '../schemas/request-schemas';

/**
 * Handler for metadata endpoint
 */
export class MetadataHandler {
  constructor(
    private readonly serviceFactory: ServiceFactory,
    private readonly logger: any
  ) {}

  /**
   * Handle metadata request
   */
  handle = async (req: DirectusRequest & MetadataRequest, res: Response): Promise<void> => {
    const { collection } = req.params;
    const cache = (req as any).cache as DirectusCacheWrapper | null;

    // Get services
    const relationAnalyzer = await this.serviceFactory.getRelationAnalyzer();
    const fieldAnalyzer = await this.serviceFactory.getFieldAnalyzer();

    // Get all metadata
    const cacheKey = `metadata:complete:${collection}`;
    
    const metadata = cache
      ? await cache.getOrSet(
          cacheKey,
          () => this.loadMetadata(collection, relationAnalyzer, fieldAnalyzer),
          { ttl: cache.getTTLForDataType('metadata') || CacheTTL.LONG }
        )
      : await this.loadMetadata(collection, relationAnalyzer, fieldAnalyzer);

    res.json(metadata);
  }

  /**
   * Load metadata for a collection
   */
  private async loadMetadata(
    collection: string,
    relationAnalyzer: any,
    fieldAnalyzer: any
  ): Promise<MetadataResponse> {
    // Initialize default response
    let possibleLocations: any[] = [];
    let fieldAnalysis: any = {
      searchableFields: [],
      translationInfo: { hasTranslations: false },
      collectionMetadata: { totalFields: 0, translatableCount: 0, systemFieldsCount: 0 }
    };
    
    // Try to get relations
    try {
      possibleLocations = await relationAnalyzer.getPossibleUsageLocations(collection, {
        bypassPermissions: true,
        includeHidden: true
      });
    } catch (error) {
      this.logger.warn(`Failed to get relations for ${collection}:`, error);
    }
    
    // Try to analyze fields
    try {
      fieldAnalysis = await fieldAnalyzer.analyzeCollectionComplete(collection, {
        translationOptions: { includeLanguages: true }
      });
    } catch (error) {
      this.logger.warn(`Failed to analyze fields for ${collection}:`, error);
    }
    
    return {
      collection,
      possibleLocations,
      searchableFields: fieldAnalysis.searchableFields,
      translationInfo: fieldAnalysis.translationInfo,
      collectionMetadata: fieldAnalysis.collectionMetadata,
      cached_at: new Date().toISOString()
    };
  }
}