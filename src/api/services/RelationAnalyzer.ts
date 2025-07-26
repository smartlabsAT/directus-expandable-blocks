import { Knex } from 'knex';
import { 
  RelationAnalyzerConfig, 
  PossibleUsageLocation,
  GetUsageLocationsOptions,
  DirectusRelationRow,
  CollectionMetadata,
  UsageMapEntry,
  RelationDetail,
  SYSTEM_COLLECTIONS,
  DEFAULT_COLLECTION_ICON,
  SYNTHETIC_RELATION_ID,
  POSTGRES_TABLE_NAME_LIMIT,
  VALID_TABLE_NAME_PATTERN,
  ParsedMetadata
} from '../types/RelationTypes';
import { InvalidCollectionError, DatabaseQueryError } from '../types/errors';
import { parseMetadata, humanizeName, getFieldFromMeta, getDisplayName } from '../utils/relation-utils';

export class RelationAnalyzer {
  private database: Knex;
  private logger: any;

  constructor(config: RelationAnalyzerConfig) {
    this.database = config.database;
    this.logger = config.services?.logger || console;
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
    // Validate that the collection exists
    await this.validateCollectionExists(targetCollection);

    // 1. Load all relevant relations
    const relations = await this.loadRelevantRelations(targetCollection);
    
    // 2. Load reverse relations for field name detection
    const reverseRelations = await this.loadReverseRelations();
    
    // 3. Build usage map
    const usageMap = this.buildUsageMap(
      relations, 
      reverseRelations, 
      targetCollection
    );
    
    // 4. Filter collections based on options
    const filteredUsageMap = this.filterUsageMap(usageMap, options);
    
    // 5. Load collection metadata
    const metadata = await this.loadCollectionMetadata(
      Array.from(filteredUsageMap.keys()),
      options
    );
    
    // 6. Load field metadata for all collections
    const fieldMetadata = await this.loadFieldMetadata(filteredUsageMap);
    
    // 7. Filter out hidden collections if needed and format results
    const finalMap = new Map<string, UsageMapEntry>();
    filteredUsageMap.forEach((entry, collection) => {
      const meta = metadata.get(collection);
      if (!options.includeHidden && meta?.hidden) {
        return;
      }
      finalMap.set(collection, entry);
    });
    
    // 8. Format and return results
    return this.formatUsageLocations(finalMap, metadata, fieldMetadata);
  }

  /**
   * Validates that a collection exists in the database
   * @param collection The collection name to validate
   * @throws InvalidCollectionError if collection doesn't exist
   */
  private async validateCollectionExists(collection: string): Promise<void> {
    try {
      // Check if collection exists in directus_collections
      const collectionInfo = await this.database
        .select('collection')
        .from('directus_collections')
        .where('collection', collection)
        .first();

      if (!collectionInfo) {
        // If not in directus_collections, check if it's a system collection
        if (!SYSTEM_COLLECTIONS.includes(collection)) {
          // Finally, check if the table exists in the database
          const tableExists = await this.checkTableExists(collection);
          if (!tableExists) {
            throw new InvalidCollectionError(collection);
          }
        }
      }
    } catch (error: any) {
      // Re-throw InvalidCollectionError
      if (error instanceof InvalidCollectionError) {
        throw error;
      }
      // Wrap other errors
      throw new DatabaseQueryError(
        `Failed to validate collection '${collection}': ${error.message || error}`
      );
    }
  }

  /**
   * Checks if a table exists in the database
   * @param tableName The table name to check
   * @returns true if table exists, false otherwise
   */
  private async checkTableExists(tableName: string): Promise<boolean> {
    try {
      // Validate table name to prevent SQL injection
      if (!VALID_TABLE_NAME_PATTERN.test(tableName)) {
        this.logger.warn(`Invalid table name format: ${tableName}`);
        return false;
      }

      // Additional length check
      if (tableName.length > POSTGRES_TABLE_NAME_LIMIT) {
        this.logger.warn(`Table name too long: ${tableName}`);
        return false;
      }

      // This works for PostgreSQL - using parameterized query for safety
      const result = await this.database.raw(`
        SELECT EXISTS (
          SELECT FROM information_schema.tables 
          WHERE table_schema = 'public' 
          AND table_name = ?
        );
      `, [tableName]);

      return result.rows?.[0]?.exists || false;
    } catch (error: any) {
      this.logger.error(`Error checking table existence for '${tableName}':`, error.message || error);
      return false;
    }
  }

  /**
   * Loads all relations that point to the target collection
   * @param targetCollection The collection to find relations for
   * @returns Array of DirectusRelationRow objects
   * @throws DatabaseQueryError if query fails
   */
  private async loadRelevantRelations(
    targetCollection: string
  ): Promise<DirectusRelationRow[]> {
    try {
      const relations = await this.database
        .select('*')
        .from('directus_relations')
        .where(function() {
          this.where('one_collection', targetCollection)
              .orWhere('one_allowed_collections', '=', targetCollection)
              .orWhere('one_allowed_collections', 'like', `${targetCollection},%`)
              .orWhere('one_allowed_collections', 'like', `%,${targetCollection},%`)
              .orWhere('one_allowed_collections', 'like', `%,${targetCollection}`)
              // NEW: Also find O2M relations where our collection is the "many" side
              .orWhere('many_collection', targetCollection);
        })
        .whereNot(function() {
          this.where('many_collection', targetCollection)
              .whereIn('many_field', ['user_created', 'user_updated']);
        });

      // Check if this is a translations table
      if (targetCollection.endsWith('_translations')) {
        // Extract the main collection name (e.g. 'pages' from 'pages_translations')
        const mainCollection = targetCollection.replace('_translations', '');
        
        // Check if the main collection exists
        const collectionExists = await this.checkTableExists(mainCollection);
        if (collectionExists) {
          // Create a synthetic relation for the implicit translations field
          const syntheticRelation: DirectusRelationRow = {
            id: SYNTHETIC_RELATION_ID,
            many_collection: targetCollection,
            many_field: null,
            one_collection: mainCollection,
            one_collection_field: null,
            one_allowed_collections: null,
            junction_field: null,
            sort_field: null,
            one_deselect_action: 'nullify',
            meta: JSON.stringify({ one_field: 'translations' })
          };
          
          // Add the synthetic relation to the results
          relations.push(syntheticRelation);
        }
      }

      return relations;
    } catch (error: any) {
      throw new DatabaseQueryError(
        `Failed to load relations for '${targetCollection}': ${error.message || error}`
      );
    }
  }

  /**
   * Loads reverse relations for better field name detection
   * @returns Map of reverse relations keyed by "one_collection-many_collection"
   * @throws DatabaseQueryError if query fails
   */
  private async loadReverseRelations(): Promise<Map<string, DirectusRelationRow>> {
    try {
      const reverseRelations = await this.database
        .select('*')
        .from('directus_relations')
        .whereNotNull('one_field')
        .whereNotIn('many_field', ['user_created', 'user_updated']);
      
      const map = new Map<string, DirectusRelationRow>();
      reverseRelations.forEach(rel => {
        const key = `${rel.one_collection}-${rel.many_collection}`;
        map.set(key, rel);
      });
      
      return map;
    } catch (error: any) {
      throw new DatabaseQueryError(
        `Failed to load reverse relations: ${error.message || error}`
      );
    }
  }

  /**
   * Filters usage map based on options
   * @param usageMap The usage map to filter
   * @param options Filter options
   * @returns Filtered usage map
   */
  private filterUsageMap(
    usageMap: Map<string, UsageMapEntry>,
    options: GetUsageLocationsOptions
  ): Map<string, UsageMapEntry> {
    const filtered = new Map<string, UsageMapEntry>();
    
    usageMap.forEach((entry, collection) => {
      // Skip system collections if not included
      if (!options.includeSystem && SYSTEM_COLLECTIONS.includes(collection)) {
        return;
      }
      
      // Skip hidden collections if not included (will check in metadata loading)
      // For now, just add all non-system collections
      filtered.set(collection, entry);
    });
    
    return filtered;
  }

  /**
   * Builds the usage map from relations
   * @param relations Array of relations to process
   * @param reverseRelations Map of reverse relations for field detection
   * @param targetCollection The target collection name
   * @returns Map of collection names to usage entries
   * 
   * Note on M2M Relations:
   * M2M (Many-to-Many) relations in Directus are represented as two separate relations:
   * 1. A M2O relation from junction table to target collection
   * 2. A O2M relation from source collection to junction table
   * These are handled separately and will appear as individual M2O/O2M relations
   * in the usage map rather than a single M2M relation.
   */
  private buildUsageMap(
    relations: DirectusRelationRow[],
    reverseRelations: Map<string, DirectusRelationRow>,
    targetCollection: string
  ): Map<string, UsageMapEntry> {
    const usageMap = new Map<string, UsageMapEntry>();
    
    relations.forEach(rel => {
      // Handle M2A relations
      if (rel.one_collection === null && rel.one_allowed_collections) {
        const mainCollection = this.extractMainCollection(rel);
        const fieldName = this.detectFieldName(rel, mainCollection, reverseRelations);
        
        const allowedCollections = rel.one_allowed_collections.split(',').map(c => c.trim());
        if (allowedCollections.includes(targetCollection) && rel.many_collection) {
          const relationDetail: RelationDetail = {
            field: fieldName,
            relation_type: 'M2A',
            junction_table: rel.many_collection,
            junction_field: rel.junction_field || undefined,
            item_field: rel.many_field || undefined,
            collection_field: rel.one_collection_field || undefined,
            sort_field: rel.sort_field || undefined,
            relation_id: rel.id
          };
          this.addToUsageMap(usageMap, mainCollection, fieldName, rel.many_collection, relationDetail);
        }
      }
      
      // Handle M2O relations
      else if (rel.one_collection === targetCollection && rel.many_collection && rel.many_field) {
        const relationDetail: RelationDetail = {
          field: rel.many_field,
          relation_type: 'M2O',
          relation_id: rel.id
        };
        this.addToUsageMap(usageMap, rel.many_collection, rel.many_field, null, relationDetail);
      }
      
      // Handle O2M relations (e.g. pages_translations belongs to pages)
      else if (rel.many_collection === targetCollection && rel.one_collection) {
        // Get the field name from one_field or meta
        let fieldName = rel.one_field || getFieldFromMeta(rel.meta, 'one_field', '');
        
        if (fieldName) {
          const relationDetail: RelationDetail = {
            field: fieldName,
            relation_type: 'O2M',
            relation_id: rel.id
          };
          this.addToUsageMap(usageMap, rel.one_collection, fieldName, null, relationDetail);
        }
      }
    });
    
    return usageMap;
  }

  /**
   * Extracts the main collection from a junction table relation
   */
  private extractMainCollection(relation: DirectusRelationRow): string {
    if (!relation.many_collection || !relation.junction_field) {
      return 'unknown';
    }
    
    const junctionTable = relation.many_collection;
    const junctionField = relation.junction_field;
    
    // Primary method: Extract from junction_field
    // e.g., "o2m_page_id" -> "o2m_page"
    // e.g., "pages_id" -> "pages"
    // e.g., "extra_id" -> "extra"
    let mainCollection = junctionField.replace(/_id$/, '');
    
    // Validate the extracted collection name
    // If it seems wrong (too generic or doesn't match patterns), try alternatives
    if (mainCollection === 'item' || mainCollection === 'parent' || mainCollection.length < 2) {
      // Fallback methods
      if (junctionTable.includes('_m2a')) {
        mainCollection = junctionTable.replace('_m2a', '');
      } else if (junctionTable.endsWith('_blocks')) {
        mainCollection = junctionTable.replace('_blocks', '');
      } else if (junctionTable.startsWith('extra_')) {
        mainCollection = 'extra';
      } else if (junctionTable.includes('_')) {
        // For tables like "o2m_page_test_m2a", we should NOT extract "o2m_page_test"
        // Instead, look at the junction_field which would be "o2m_page_id" -> "o2m_page"
        const parts = junctionTable.split('_');
        if (parts.length >= 2) {
          // Try first part
          mainCollection = parts[0];
        }
      }
    }
    
    return mainCollection;
  }

  /**
   * Intelligently detects the field name for a relation
   */
  private detectFieldName(
    relation: DirectusRelationRow,
    mainCollection: string,
    reverseRelations: Map<string, DirectusRelationRow>
  ): string {
    if (!relation.many_collection) {
      return 'unknown_field';
    }
    
    const junctionTable = relation.many_collection;
    
    // 1. Try reverse relation
    const reverseKey = `${mainCollection}-${junctionTable}`;
    const reverseRel = reverseRelations.get(reverseKey);
    if (reverseRel?.one_field) {
      return reverseRel.one_field;
    }
    
    // 2. Try relation metadata
    const metaField = getFieldFromMeta(relation.meta, 'one_field', '');
    if (metaField) {
      return metaField;
    }
    
    // 3. Derive from junction table name
    return this.deriveFieldNameFromJunctionTable(junctionTable, mainCollection);
  }

  /**
   * Derives field name from junction table naming convention
   */
  private deriveFieldNameFromJunctionTable(junctionTable: string, mainCollection: string): string {
    let fieldName = '';
    
    if (junctionTable.startsWith(mainCollection + '_')) {
      // e.g. "pages_blocks" -> "blocks"
      fieldName = junctionTable.substring(mainCollection.length + 1);
    } else if (junctionTable.endsWith('_m2a')) {
      // e.g. "content_m2a" -> "content"
      fieldName = junctionTable.replace('_m2a', '');
      if (fieldName.startsWith(mainCollection + '_')) {
        fieldName = fieldName.substring(mainCollection.length + 1);
      }
    } else if (junctionTable.includes('_')) {
      // Take the part after the first underscore if it starts with mainCollection
      if (junctionTable.startsWith(mainCollection + '_')) {
        fieldName = junctionTable.substring(mainCollection.length + 1);
      } else {
        const parts = junctionTable.split('_');
        fieldName = parts[parts.length - 1];
      }
    } else {
      // Last fallback
      fieldName = 'content';
    }
    
    // Clean up field name
    if (fieldName === 'm2a' || fieldName === 'item' || fieldName === junctionTable) {
      if (junctionTable.includes('_')) {
        const parts = junctionTable.split('_');
        if (parts[0] === mainCollection && parts.length > 1) {
          parts.shift();
        }
        if (parts[parts.length - 1] === 'm2a' && parts.length > 1) {
          parts.pop();
        }
        fieldName = parts.join('_') || 'content';
      } else {
        fieldName = 'content';
      }
    }
    
    return fieldName;
  }

  /**
   * Adds an entry to the usage map
   * @param map The usage map to update
   * @param collection The collection name
   * @param field The field name
   * @param junctionTable The junction table name (optional)
   * @param relationDetail The relation details to store
   */
  private addToUsageMap(
    map: Map<string, UsageMapEntry>,
    collection: string,
    field: string,
    junctionTable: string | null,
    relationDetail: RelationDetail
  ): void {
    if (!map.has(collection)) {
      map.set(collection, {
        fields: new Set<string>(),
        relation_details: new Map<string, RelationDetail>()
      });
    }
    
    const entry = map.get(collection)!;
    entry.fields.add(field);
    
    // Store relation details by field name
    // If field already exists (multiple relations to same field), keep the existing one
    if (!entry.relation_details.has(field)) {
      entry.relation_details.set(field, relationDetail);
    }
  }

  /**
   * Loads collection metadata (names, icons, etc.)
   */
  private async loadCollectionMetadata(
    collections: string[],
    options: GetUsageLocationsOptions
  ): Promise<Map<string, CollectionMetadata>> {
    const metadata = new Map<string, CollectionMetadata>();
    
    if (collections.length === 0) {
      return metadata;
    }
    
    try {
      const collectionInfos = await this.database
        .select('*')
        .from('directus_collections')
        .whereIn('collection', collections);
      
      collectionInfos.forEach(info => {
        const parsed = parseMetadata(info.options || info.meta);
        
        metadata.set(info.collection, {
          collection: info.collection,
          name: getDisplayName(parsed, info.collection),
          icon: parsed.icon || DEFAULT_COLLECTION_ICON,
          display_template: parsed.display_template
        });
      });
      
      // Fill missing metadata with defaults
      collections.forEach(col => {
        if (!metadata.has(col)) {
          metadata.set(col, {
            collection: col,
            name: humanizeName(col),
            icon: DEFAULT_COLLECTION_ICON
          });
        }
      });
      
      return metadata;
    } catch (error: any) {
      this.logger.error('Error loading collection metadata:', error.message || error);
      // Return default metadata
      collections.forEach(col => {
        metadata.set(col, {
          collection: col,
          name: humanizeName(col),
          icon: DEFAULT_COLLECTION_ICON
        });
      });
      return metadata;
    }
  }


  /**
   * Loads field metadata for all fields in the usage map
   */
  private async loadFieldMetadata(
    usageMap: Map<string, UsageMapEntry>
  ): Promise<Map<string, Map<string, string>>> {
    const fieldMetadata = new Map<string, Map<string, string>>();
    
    try {
      // Collect all collection-field pairs for batch query
      const collectionFieldPairs: Array<{collection: string, field: string}> = [];
      const collectionFields = new Map<string, Set<string>>();
      
      usageMap.forEach((entry, collection) => {
        const fields = Array.from(entry.fields);
        collectionFields.set(collection, new Set(fields));
        
        fields.forEach(field => {
          collectionFieldPairs.push({ collection, field });
        });
      });
      
      if (collectionFieldPairs.length === 0) {
        return fieldMetadata;
      }
      
      // Build batch query with OR conditions
      const query = this.database
        .select('collection', 'field', 'options', 'display_options', 'interface_options')
        .from('directus_fields')
        .where(function() {
          collectionFieldPairs.forEach(({ collection, field }, index) => {
            if (index === 0) {
              this.where(function() {
                this.where('collection', collection).andWhere('field', field);
              });
            } else {
              this.orWhere(function() {
                this.where('collection', collection).andWhere('field', field);
              });
            }
          });
        });
      
      // Execute batch query
      const fieldInfos = await query;
      
      // Process results
      fieldInfos.forEach(info => {
        if (!fieldMetadata.has(info.collection)) {
          fieldMetadata.set(info.collection, new Map<string, string>());
        }
        
        const displayName = getDisplayName(info, info.field);
        fieldMetadata.get(info.collection)!.set(info.field, displayName);
      });
      
      // Fill missing fields with humanized names
      collectionFields.forEach((fields, collection) => {
        if (!fieldMetadata.has(collection)) {
          fieldMetadata.set(collection, new Map<string, string>());
        }
        
        const collectionFieldMap = fieldMetadata.get(collection)!;
        fields.forEach(field => {
          if (!collectionFieldMap.has(field)) {
            collectionFieldMap.set(field, humanizeName(field));
          }
        });
      });
      
      return fieldMetadata;
    } catch (error: any) {
      this.logger.error('Error loading field metadata:', error.message || error);
      
      // Fallback: humanize all field names
      usageMap.forEach((entry, collection) => {
        const collectionFieldMap = new Map<string, string>();
        entry.fields.forEach(field => {
          collectionFieldMap.set(field, humanizeName(field));
        });
        fieldMetadata.set(collection, collectionFieldMap);
      });
      
      return fieldMetadata;
    }
  }

  /**
   * Formats the usage locations for output
   */
  private formatUsageLocations(
    usageMap: Map<string, UsageMapEntry>,
    metadata: Map<string, CollectionMetadata>,
    fieldMetadata: Map<string, Map<string, string>>
  ): PossibleUsageLocation[] {
    return Array.from(usageMap.entries()).map(([collection, data]) => {
      const meta = metadata.get(collection) || {
        collection,
        name: humanizeName(collection),
        icon: DEFAULT_COLLECTION_ICON
      };
      
      const fieldNames = fieldMetadata.get(collection) || new Map();
      
      // Add field_name to each relation detail
      const relationDetailsWithNames = Array.from(data.relation_details.values()).map(detail => ({
        ...detail,
        field_name: fieldNames.get(detail.field) || humanizeName(detail.field)
      }));
      
      return {
        collection,
        collection_name: meta.name,
        collection_icon: meta.icon,
        fields: Array.from(data.fields),
        relation_details: relationDetailsWithNames
      };
    });
  }
}