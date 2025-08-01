import { 
  RelationAnalyzerConfig, 
  PossibleUsageLocation,
  GetUsageLocationsOptions,
  DirectusRelationRow,
  CollectionMetadata,
  RelationDetail,
  SYSTEM_COLLECTIONS,
  DEFAULT_COLLECTION_ICON,
  ParsedMetadata,
  isM2ARelation,
  isM2ORelation
} from '../types/RelationTypes';
import { InvalidCollectionError, DatabaseQueryError } from '../types/errors';
import { parseMetadata, humanizeName, getDisplayName } from '../utils/relation-utils';
import { getLogger } from '../utils/logger-utils';
import { parseAllowedCollections } from '../../utils/helpers';
import type { Logger } from '../types/directus-api';

export class RelationAnalyzer {
  private services: any;
  private schema: any;
  private database: any;
  private accountability?: any;

  constructor(config: RelationAnalyzerConfig) {
    this.services = config.services;
    this.schema = config.schema;
    this.database = config.database;
    this.accountability = config.accountability;
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
      const usageLocations = this.transformRelationsToUsageLocations(
        relations,
        targetCollection,
        collectionMetadata,
        options
      );

      return usageLocations;
    } catch (error: any) {
      if (error instanceof InvalidCollectionError) {
        throw error;
      }
      throw new DatabaseQueryError(
        `Failed to analyze relations for '${targetCollection}': ${error.message || error}`
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
      } catch (error: any) {
        if (error instanceof InvalidCollectionError) {
          throw error;
        }
        throw new DatabaseQueryError(`Failed to validate collection: ${error.message}`);
      }
      return;
    }

    // Permission-aware check using CollectionsService
    if (!this.services) {
      throw new DatabaseQueryError('Services not available');
    }

    const { CollectionsService } = this.services;
    const collectionsService = new CollectionsService({
      database: this.database,
      schema: this.schema,
      accountability: this.accountability
    });

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
    } catch (error: any) {
      if (error instanceof InvalidCollectionError) {
        throw error;
      }
      throw new DatabaseQueryError(`Failed to validate collection: ${error.message}`);
    }
  }

  /**
   * Get all relations directly from database (bypasses permissions)
   * Used for frontend metadata to show locked blocks
   */
  private async getRelationsDirectly(targetCollection: string): Promise<DirectusRelationRow[]> {
    try {
      const relations = await this.database('directus_relations')
        .where(function() {
          this.where('one_collection', targetCollection)
              .orWhere('many_collection', targetCollection)
              .orWhere('one_allowed_collections', 'like', `%${targetCollection}%`);
        });

      return relations || [];
    } catch (error: any) {
      throw new DatabaseQueryError(`Failed to load relations directly: ${error.message}`);
    }
  }

  /**
   * Get all relations for a collection using RelationsService
   */
  private async getRelationsForCollection(targetCollection: string): Promise<DirectusRelationRow[]> {
    if (!this.services) {
      throw new DatabaseQueryError('Services not available');
    }

    const { RelationsService } = this.services;
    const relationsService = new RelationsService({
      database: this.database,
      schema: this.schema,
      accountability: this.accountability
    });

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
    } catch (error: any) {
      throw new DatabaseQueryError(`Failed to load relations: ${error.message}`);
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
      let collectionInfos: any[];

      if (options.bypassPermissions) {
        // Direct database query
        collectionInfos = await this.database('directus_collections')
          .whereIn('collection', collections);
      } else {
        // Use CollectionsService with permissions
        if (!this.services) {
          throw new DatabaseQueryError('Services not available');
        }
        
        const { CollectionsService } = this.services;
        const collectionsService = new CollectionsService({
          database: this.database,
          schema: this.schema,
          accountability: this.accountability
        });
        
        collectionInfos = await collectionsService.readByQuery({
          filter: { collection: { _in: collections } }
        });
      }

      collectionInfos.forEach((info: any) => {
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

    } catch (error: any) {
      if (this.services) {
        getLogger(this.services).warn('Failed to load collection metadata:', error.message);
      }
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
      // M2A relation
      if (isM2ARelation(rel)) {
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
      // M2O relation
      else if (isM2ORelation(rel) && rel.one_collection === targetCollection) {
        this.addUsageEntry(usageMap, rel.many_collection!, rel.many_field!, {
          field: rel.many_field!,
          field_name: humanizeName(rel.many_field!),
          relation_type: 'M2O',
          relation_id: rel.id
        });
      }
      // O2M relation
      else if (rel.many_collection === targetCollection && rel.one_collection && rel.one_field) {
        this.addUsageEntry(usageMap, rel.one_collection, rel.one_field, {
          field: rel.one_field,
          field_name: humanizeName(rel.one_field),
          relation_type: 'O2M',
          relation_id: rel.id
        });
      }
    });

    // Convert map to array of PossibleUsageLocation
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