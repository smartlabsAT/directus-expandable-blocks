import { 
  RelationAnalyzerConfig, 
  PossibleUsageLocation,
  GetUsageLocationsOptions,
  DirectusRelationRow,
  CollectionMetadata,
  RelationDetail,
  SYSTEM_COLLECTIONS,
  DEFAULT_COLLECTION_ICON,
  isM2ARelation,
  isM2ORelation
} from '../types/RelationTypes';
import { InvalidCollectionError, DatabaseQueryError } from '../types/errors';
import { parseMetadata, humanizeName } from '../utils/relation-utils';
import type { Knex } from 'knex';
import { getLogger } from '../utils/logger-utils';
import type { Logger, DirectusServices, DirectusSchema, DirectusAccountability } from '../types/directus-api';
import { parseAllowedCollections } from '../../utils/helpers';

export class RelationAnalyzer {
  private readonly services?: DirectusServices;
  private readonly schema?: DirectusSchema;
  private readonly database: Knex;
  private readonly accountability?: DirectusAccountability;
  private readonly logger: Logger;

  constructor(config: RelationAnalyzerConfig) {
    this.services = config.services;
    this.schema = config.schema;
    this.database = config.database;
    this.accountability = config.accountability;
    this.logger = this.services ? getLogger(this.services) : console as unknown as Logger;
  }

  /**
   * Create a service instance with proper configuration
   */
  private createService<T>(ServiceClass: new (options: any) => T): T {
    if (!this.services) {
      throw new DatabaseQueryError('Services not available');
    }
    
    return new ServiceClass({
      database: this.database,
      schema: this.schema,
      accountability: this.accountability
    });
  }

  /**
   * Get all possible usage locations for a given collection
   * @param targetCollection The collection to analyze
   * @param options Additional options
   * @returns Array of possible usage locations
   * @throws InvalidCollectionError if collection doesn't exist
   */
  async getPossibleUsageLocations(
    targetCollection: string,
    options: GetUsageLocationsOptions = {}
  ): Promise<PossibleUsageLocation[]> {
    try {
      // Validate collection exists
      await this.validateCollectionExists(targetCollection, options.bypassPermissions);

      // Get relations based on permission mode
      const relations = options.bypassPermissions 
        ? await this.getRelationsDirectly(targetCollection)
        : await this.getRelationsForCollection(targetCollection);

      // Get collection metadata for all related collections
      const relatedCollections = this.extractRelatedCollections(relations, targetCollection);
      const collectionMetadata = await this.getCollectionMetadata(relatedCollections, options);

      // Transform relations to usage locations
      return this.transformRelationsToUsageLocations(
        relations,
        targetCollection,
        collectionMetadata,
        options
      );
    } catch (error) {
      if (error instanceof InvalidCollectionError) {
        throw error;
      }
      const errorMessage = error instanceof Error ? error.message : String(error);
      throw new DatabaseQueryError(
        `Failed to analyze relations for '${targetCollection}': ${errorMessage}`
      );
    }
  }

  /**
   * Validates that a collection exists
   */
  private async validateCollectionExists(collection: string, bypassPermissions?: boolean): Promise<void> {
    if (bypassPermissions) {
      // Direct database check
      try {
        const exists = await this.database('directus_collections')
          .where('collection', collection)
          .first();
        
        if (!exists && !SYSTEM_COLLECTIONS.includes(collection)) {
          throw new InvalidCollectionError(collection);
        }
      } catch (error) {
        if (error instanceof InvalidCollectionError) throw error;
        const errorMessage = error instanceof Error ? error.message : String(error);
        throw new DatabaseQueryError(`Failed to validate collection: ${errorMessage}`);
      }
      return;
    }

    // Permission-aware check using CollectionsService
    const { CollectionsService } = this.services!;
    const collectionsService = this.createService(CollectionsService);

    try {
      const collections = await collectionsService.readByQuery({
        filter: { collection: { _eq: collection } },
        limit: 1
      });

      if (!collections || collections.length === 0) {
        if (!SYSTEM_COLLECTIONS.includes(collection)) {
          throw new InvalidCollectionError(collection);
        }
      }
    } catch (error) {
      if (error instanceof InvalidCollectionError) throw error;
      const errorMessage = error instanceof Error ? error.message : String(error);
      throw new DatabaseQueryError(`Failed to validate collection: ${errorMessage}`);
    }
  }

  /**
   * Get all relations directly from database (bypasses permissions)
   * Used for frontend metadata to show locked blocks
   */
  private async getRelationsDirectly(targetCollection: string): Promise<DirectusRelationRow[]> {
    try {
      const relations = await this.database('directus_relations')
        .where(function(this: any) {
          this.where('one_collection', targetCollection)
              .orWhere('many_collection', targetCollection)
              .orWhere('one_allowed_collections', 'like', `%${targetCollection}%`);
        });

      return relations || [];
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      throw new DatabaseQueryError(`Failed to load relations directly: ${errorMessage}`);
    }
  }

  /**
   * Get all relations for a collection using RelationsService
   */
  private async getRelationsForCollection(targetCollection: string): Promise<DirectusRelationRow[]> {
    const { RelationsService } = this.services!;
    const relationsService = this.createService(RelationsService);

    try {
      // Get all relations where our collection is involved
      const relations = await relationsService.readByQuery({
        filter: {
          _or: [
            { one_collection: { _eq: targetCollection } },
            { many_collection: { _eq: targetCollection } },
            { one_allowed_collections: { _contains: targetCollection } }
          ]
        }
      });

      return relations || [];
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      throw new DatabaseQueryError(`Failed to load relations: ${errorMessage}`);
    }
  }

  /**
   * Extract all related collections from relations
   */
  private extractRelatedCollections(
    relations: DirectusRelationRow[],
    targetCollection: string
  ): string[] {
    const collections = new Set<string>();

    relations.forEach(rel => {
      if (isM2ARelation(rel) && rel.many_collection) {
        const allowedCollections = parseAllowedCollections(rel.one_allowed_collections!);
        if (allowedCollections.includes(targetCollection)) {
          collections.add(rel.many_collection);
        }
      } else if (isM2ORelation(rel) && rel.one_collection === targetCollection && rel.many_collection) {
        collections.add(rel.many_collection);
      } else if (rel.many_collection === targetCollection && rel.one_collection) {
        collections.add(rel.one_collection);
      }
    });

    return Array.from(collections);
  }

  /**
   * Get metadata for collections
   */
  private async getCollectionMetadata(
    collections: string[],
    options: GetUsageLocationsOptions
  ): Promise<Map<string, CollectionMetadata>> {
    const metadata = new Map<string, CollectionMetadata>();

    if (collections.length === 0) {
      return metadata;
    }

    try {
      interface CollectionInfo {
        collection: string;
        meta?: any;
        icon?: string;
      }
      
      let collectionInfos: CollectionInfo[];

      if (options.bypassPermissions) {
        // Direct database query
        collectionInfos = await this.database('directus_collections')
          .whereIn('collection', collections);
      } else {
        // Use CollectionsService with permissions
        const { CollectionsService } = this.services!;
        const collectionsService = this.createService(CollectionsService);
        
        collectionInfos = await collectionsService.readByQuery({
          filter: { collection: { _in: collections } }
        });
      }

      collectionInfos.forEach((info: CollectionInfo) => {
        const meta = parseMetadata(info.meta);
        
        // Skip hidden collections if not requested
        if (!options.includeHidden && meta.hidden) {
          return;
        }

        // Skip system collections if not requested
        if (!options.includeSystem && SYSTEM_COLLECTIONS.includes(info.collection)) {
          return;
        }

        metadata.set(info.collection, {
          collection: info.collection,
          name: meta.display || info.collection,
          icon: meta.icon || info.icon || DEFAULT_COLLECTION_ICON,
          display_template: meta.display_template,
          hidden: meta.hidden,
          singleton: meta.singleton
        });
      });

      // Add default metadata for collections not in directus_collections
      collections.forEach(col => {
        if (!metadata.has(col) && 
            (!SYSTEM_COLLECTIONS.includes(col) || options.includeSystem)) {
          metadata.set(col, {
            collection: col,
            name: humanizeName(col),
            icon: DEFAULT_COLLECTION_ICON
          });
        }
      });

    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      this.logger.warn('Failed to load collection metadata:', errorMessage);
      // Return default metadata
      collections.forEach(col => {
        metadata.set(col, {
          collection: col,
          name: humanizeName(col),
          icon: DEFAULT_COLLECTION_ICON
        });
      });
    }

    return metadata;
  }

  /**
   * Transform relations to usage locations format
   */
  private transformRelationsToUsageLocations(
    relations: DirectusRelationRow[],
    targetCollection: string,
    collectionMetadata: Map<string, CollectionMetadata>,
    options: GetUsageLocationsOptions
  ): PossibleUsageLocation[] {
    const usageMap = new Map<string, {
      fields: Set<string>;
      relationDetails: RelationDetail[];
    }>();

    // Process each relation
    relations.forEach(rel => {
      this.processRelation(rel, targetCollection, usageMap);
    });

    // Convert map to array of PossibleUsageLocation
    return this.convertUsageMapToLocations(usageMap, collectionMetadata);
  }

  /**
   * Process a single relation and add to usage map
   */
  private processRelation(
    rel: DirectusRelationRow,
    targetCollection: string,
    usageMap: Map<string, { fields: Set<string>; relationDetails: RelationDetail[] }>
  ): void {
    // M2A relation
    if (isM2ARelation(rel)) {
      this.processM2ARelation(rel, targetCollection, usageMap);
    }
    // M2O relation
    else if (isM2ORelation(rel) && rel.one_collection === targetCollection) {
      this.processM2ORelation(rel, usageMap);
    }
    // O2M relation
    else if (rel.many_collection === targetCollection && rel.one_collection && rel.one_field) {
      this.processO2MRelation(rel, usageMap);
    }
  }

  /**
   * Process M2A relation
   */
  private processM2ARelation(
    rel: DirectusRelationRow,
    targetCollection: string,
    usageMap: Map<string, { fields: Set<string>; relationDetails: RelationDetail[] }>
  ): void {
    const allowedCollections = parseAllowedCollections(rel.one_allowed_collections!);
    if (allowedCollections.includes(targetCollection) && rel.many_collection) {
      const meta = parseMetadata(rel.meta);
      const fieldName = meta.one_field || 'content';

      this.addUsageEntry(usageMap, rel.many_collection, fieldName, {
        field: fieldName,
        field_name: humanizeName(fieldName),
        relation_type: 'M2A',
        junction_table: rel.many_collection,
        junction_field: rel.junction_field || undefined,
        item_field: rel.many_field || undefined,
        collection_field: rel.one_collection_field || undefined,
        sort_field: rel.sort_field || undefined,
        relation_id: rel.id
      });
    }
  }

  /**
   * Process M2O relation
   */
  private processM2ORelation(
    rel: DirectusRelationRow,
    usageMap: Map<string, { fields: Set<string>; relationDetails: RelationDetail[] }>
  ): void {
    this.addUsageEntry(usageMap, rel.many_collection!, rel.many_field!, {
      field: rel.many_field!,
      field_name: humanizeName(rel.many_field!),
      relation_type: 'M2O',
      relation_id: rel.id
    });
  }

  /**
   * Process O2M relation
   */
  private processO2MRelation(
    rel: DirectusRelationRow,
    usageMap: Map<string, { fields: Set<string>; relationDetails: RelationDetail[] }>
  ): void {
    this.addUsageEntry(usageMap, rel.one_collection!, rel.one_field!, {
      field: rel.one_field!,
      field_name: humanizeName(rel.one_field!),
      relation_type: 'O2M',
      relation_id: rel.id
    });
  }

  /**
   * Convert usage map to array of PossibleUsageLocation
   */
  private convertUsageMapToLocations(
    usageMap: Map<string, { fields: Set<string>; relationDetails: RelationDetail[] }>,
    collectionMetadata: Map<string, CollectionMetadata>
  ): PossibleUsageLocation[] {
    const results: PossibleUsageLocation[] = [];
    
    usageMap.forEach((data, collection) => {
      const meta = collectionMetadata.get(collection);
      if (meta) {
        results.push({
          collection,
          collection_name: meta.name,
          collection_icon: meta.icon,
          fields: Array.from(data.fields),
          relation_details: data.relationDetails
        });
      }
    });

    return results.sort((a, b) => a.collection_name.localeCompare(b.collection_name));
  }

  /**
   * Add usage entry to the map
   */
  private addUsageEntry(
    usageMap: Map<string, { fields: Set<string>; relationDetails: RelationDetail[] }>,
    collection: string,
    field: string,
    relationDetail: RelationDetail
  ): void {
    if (!usageMap.has(collection)) {
      usageMap.set(collection, {
        fields: new Set<string>(),
        relationDetails: []
      });
    }

    const entry = usageMap.get(collection)!;
    entry.fields.add(field);
    
    // Only add if not already present (avoid duplicates)
    const exists = entry.relationDetails.some(
      detail => detail.field === relationDetail.field && 
                detail.relation_type === relationDetail.relation_type
    );
    
    if (!exists) {
      entry.relationDetails.push(relationDetail);
    }
  }
}