import type { Response } from 'express';
import type { DirectusRequest } from '../types/directus-api';
import type { Logger } from '../types/common';
import { ServiceFactory } from '../factories/ServiceFactory';
import { DirectusCacheWrapper } from '../services/DirectusCacheWrapper';
import { CacheTTL } from '../types/CacheTypes';
import type { MetadataResponse } from '../schemas/response-schemas';
import { createValidationError } from '../schemas/response-schemas';
import { validateCollection } from '../utils/validation';
import type { RelationAnalyzer } from '../services/RelationAnalyzer';
import type { FieldAnalyzer } from '../services/FieldAnalyzer';

/**
 * Handler for the metadata endpoint that returns collection metadata including
 * possible usage locations, searchable fields, and translation information
 * 
 * @example
 * GET /api/expandable-blocks-api/{collection}/metadata
 */
export class MetadataHandler {
  constructor(
    private readonly serviceFactory: ServiceFactory,
    private readonly logger: Logger
  ) {}

  /**
   * Handle metadata request for a collection
   * 
   * @param req - The incoming request with collection in params
   * @param res - Express response object
   * @returns Promise that resolves when response is sent
   * @throws Will return appropriate HTTP error codes for validation or permission errors
   */
  public async handle(req: DirectusRequest, res: Response): Promise<void> {
    try {
      // Validate collection
      const collection = req.params.collection;
      validateCollection(collection);
      
      const cache = (req as DirectusRequest & { cache?: DirectusCacheWrapper }).cache || null;

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
    } catch (error) {
      // Log error but don't expose internals
      this.logger.error('Metadata handler error:', error);
      
      // Send appropriate error response
      if (error instanceof Error) {
        if (error.message.includes('not allowed') || error.message.includes('Collection')) {
          res.status(403).json(createValidationError('Access denied'));
          return;
        }
        if (error.message.includes('Invalid')) {
          res.status(400).json(createValidationError(error.message));
          return;
        }
      }
      
      // Generic error for unexpected issues
      res.status(500).json(createValidationError('An error occurred processing your request'));
    }
  }

  /**
   * Load metadata for a collection
   */
  /**
   * Load complete metadata for a collection
   * 
   * @param collection - Collection name to analyze
   * @param relationAnalyzer - Relation analyzer service instance
   * @param fieldAnalyzer - Field analyzer service instance
   * @returns Complete metadata response object
   */
  private async loadMetadata(
    collection: string,
    relationAnalyzer: RelationAnalyzer,
    fieldAnalyzer: FieldAnalyzer
  ): Promise<MetadataResponse> {
    // Initialize default response
    let possibleLocations: Array<{
      collection: string;
      collection_name: string;
      collection_icon?: string;
      fields: string[];
      relation_details: Array<{
        type: string;
        field: string;
        related_collection?: string;
        junction_field?: string;
      }>;
    }> = [];
    
    let fieldAnalysis: {
      searchableFields: Array<{ field: string; field_name: string; type: string; }>;
      translationInfo: { hasTranslations: boolean; };
      collectionMetadata: { totalFields: number; translatableCount: number; systemFieldsCount: number; };
    } = {
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