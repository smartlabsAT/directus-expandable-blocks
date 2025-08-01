import type { Knex } from 'knex';
import type { DirectusServices, DirectusSchema, DirectusAccountability } from '../types/directus-api';
import { RelationAnalyzer } from '../services/RelationAnalyzer';
import { FieldAnalyzer } from '../services/FieldAnalyzer';
import { ItemLoader } from '../services/ItemLoader';
import { UsageFinderService } from '../services/UsageFinderService';
import { PathBuilderService } from '../services/PathBuilderService';
import { DirectusCacheWrapper } from '../services/DirectusCacheWrapper';
import { CacheServiceConfig } from '../types/CacheTypes';

/**
 * Directus context interface
 */
export interface DirectusContext {
  database: Knex;
  services: DirectusServices;
  getSchema: () => Promise<DirectusSchema>;
  logger: any;
  accountability?: DirectusAccountability;
}

/**
 * Factory for creating and managing service instances
 * Implements lazy loading and singleton pattern for services
 */
export class ServiceFactory {
  private relationAnalyzer?: RelationAnalyzer;
  private fieldAnalyzer?: FieldAnalyzer;
  private itemLoader?: ItemLoader;
  private usageFinderServices: Map<string, UsageFinderService> = new Map();
  private pathBuilderService?: PathBuilderService;
  private schema?: DirectusSchema;

  constructor(private readonly context: DirectusContext) {}

  /**
   * Get or load schema
   */
  private async getSchema(): Promise<DirectusSchema> {
    if (!this.schema) {
      this.schema = await this.context.getSchema();
    }
    return this.schema;
  }

  /**
   * Get or create RelationAnalyzer instance
   */
  async getRelationAnalyzer(): Promise<RelationAnalyzer> {
    if (!this.relationAnalyzer) {
      const schema = await this.getSchema();
      this.relationAnalyzer = new RelationAnalyzer({
        database: this.context.database,
        services: this.context.services,
        schema,
        accountability: this.context.accountability
      });
    }
    return this.relationAnalyzer;
  }

  /**
   * Get or create FieldAnalyzer instance
   */
  async getFieldAnalyzer(): Promise<FieldAnalyzer> {
    if (!this.fieldAnalyzer) {
      const schema = await this.getSchema();
      this.fieldAnalyzer = new FieldAnalyzer({
        database: this.context.database,
        services: this.context.services,
        schema,
        accountability: this.context.accountability
      });
    }
    return this.fieldAnalyzer;
  }

  /**
   * Get or create ItemLoader instance
   */
  async getItemLoader(): Promise<ItemLoader> {
    if (!this.itemLoader) {
      const schema = await this.getSchema();
      this.itemLoader = new ItemLoader({
        database: this.context.database,
        services: this.context.services,
        schema,
        accountability: this.context.accountability
      });
    }
    return this.itemLoader;
  }

  /**
   * Get or create UsageFinderService instance for a specific collection
   * Each collection gets its own instance due to pre-loaded relations
   */
  async getUsageFinder(collection: string, incomingRelations?: any[]): Promise<UsageFinderService> {
    const cacheKey = `${collection}:${incomingRelations ? 'custom' : 'default'}`;
    
    if (!this.usageFinderServices.has(cacheKey)) {
      // If no relations provided, load them
      const relations = incomingRelations || await this.loadIncomingRelations(collection);
      
      const schema = await this.getSchema();
      const usageFinder = new UsageFinderService({
        database: this.context.database,
        services: this.context.services,
        schema,
        accountability: this.context.accountability,
        incomingRelations: relations
      });
      
      this.usageFinderServices.set(cacheKey, usageFinder);
    }
    
    return this.usageFinderServices.get(cacheKey)!;
  }

  /**
   * Get or create PathBuilderService instance
   */
  async getPathBuilder(collection: string, cache?: DirectusCacheWrapper): Promise<PathBuilderService> {
    if (!this.pathBuilderService) {
      const usageFinder = await this.getUsageFinder(collection);
      
      const schema = await this.getSchema();
      this.pathBuilderService = new PathBuilderService({
        database: this.context.database,
        services: this.context.services,
        schema,
        accountability: this.context.accountability,
        defaultLocale: 'de-DE',
        usageFinder: usageFinder,
        cache: cache || this.createDefaultCache()
      });
    }
    return this.pathBuilderService;
  }

  /**
   * Create a new cache instance with custom config
   */
  createCache(config: Partial<CacheServiceConfig>): DirectusCacheWrapper {
    return new DirectusCacheWrapper({
      ...config,
      database: this.context.database,
      services: this.context.services
    });
  }

  /**
   * Update accountability for all services
   */
  updateAccountability(accountability: DirectusAccountability): void {
    this.context.accountability = accountability;
    
    // Reset services to force recreation with new accountability
    this.relationAnalyzer = undefined;
    this.fieldAnalyzer = undefined;
    this.itemLoader = undefined;
    this.usageFinderServices.clear();
    this.pathBuilderService = undefined;
  }

  /**
   * Load incoming relations for a collection
   */
  private async loadIncomingRelations(collection: string): Promise<any[]> {
    return this.context.database
      .select('*')
      .from('directus_relations')
      .where(function () {
        this.where('one_collection', collection)
          .orWhere('one_allowed_collections', '=', collection)
          .orWhere('one_allowed_collections', 'like', `${collection},%`)
          .orWhere('one_allowed_collections', 'like', `%,${collection},%`)
          .orWhere('one_allowed_collections', 'like', `%,${collection}`);
      })
      .whereNot(function () {
        this.where('many_collection', collection)
          .whereIn('many_field', ['user_created', 'user_updated']);
      });
  }

  /**
   * Create a default cache instance
   */
  private createDefaultCache(): DirectusCacheWrapper {
    return new DirectusCacheWrapper({
      database: this.context.database,
      services: this.context.services
    });
  }
}