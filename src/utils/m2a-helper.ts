import { logger } from './logger';

export interface M2AFieldInfo {
  field: string;
  collection: string;
  junctionCollection: string;
  foreignKeyField: string;
  allowedCollections: string[];
  hasNestedM2A?: boolean;
  nestedM2AFields?: Record<string, M2AFieldInfo>;
}

export class M2AHelper {
  private api: any;
  private fieldsStore: any;
  private relationsStore: any;
  
  constructor(api: any, stores: any) {
    this.api = api;
    this.fieldsStore = stores.useFieldsStore();
    this.relationsStore = stores.useRelationsStore();
  }

  /**
   * Analyze a collection to find all M2A fields and their nested structures
   */
  async analyzeM2AStructure(
    collection: string, 
    field: string
  ): Promise<M2AFieldInfo> {
    // Get relation info
    const relations = this.relationsStore.getRelationsForField(collection, field);
    const relation = relations?.[0];
    
    if (!relation) {
      throw new Error(`No relation found for ${collection}.${field}`);
    }

    // Determine junction collection name
    let junctionCollection = relation.collection;
    if (!junctionCollection || junctionCollection === collection) {
      junctionCollection = `${collection}_${field}`;
    }

    // Determine foreign key field
    const foreignKeyField = relation.meta?.many_field || `${collection}_id`;

    // Get allowed collections
    let allowedCollections = [];
    if (relation.meta?.one_allowed_collections) {
      allowedCollections = relation.meta.one_allowed_collections;
    }
    
    // If no allowed collections in relation meta, check if they're passed via field options
    if (allowedCollections.length === 0) {
      try {
        const fields = this.fieldsStore.getFieldsForCollection(collection);
        const fieldConfig = fields.find((f: any) => f.field === field);
        if (fieldConfig?.meta?.options?.allowedCollections) {
          allowedCollections = fieldConfig.meta.options.allowedCollections;
          console.log('Found allowed collections in field options:', allowedCollections);
        }
      } catch (e) {
        console.log('Could not get field options:', e);
      }
    }

    const fieldInfo: M2AFieldInfo = {
      field,
      collection,
      junctionCollection,
      foreignKeyField,
      allowedCollections,
      nestedM2AFields: {}
    };

    // Check each allowed collection for nested M2A fields
    for (const allowedCollection of allowedCollections) {
      try {
        const fields = this.fieldsStore.getFieldsForCollection(allowedCollection);
        const m2aFields = fields.filter((f: any) => 
          f.meta?.interface === 'm2a' || f.meta?.special?.includes('m2a')
        );

        if (m2aFields.length > 0) {
          fieldInfo.hasNestedM2A = true;
          for (const nestedField of m2aFields) {
            // Recursively analyze nested M2A
            const nestedInfo = await this.analyzeM2AStructure(
              allowedCollection, 
              nestedField.field
            );
            fieldInfo.nestedM2AFields![allowedCollection] = nestedInfo;
          }
        }
      } catch (error) {
        console.warn(`Could not analyze ${allowedCollection}:`, error);
      }
    }

    return fieldInfo;
  }

  /**
   * Load data for M2A field with all nested structures
   */
  async loadM2AData(
    parentId: string | number,
    fieldInfo: M2AFieldInfo,
    depth: number = 0,
    maxDepth: number = 3
  ): Promise<any[]> {
    if (depth >= maxDepth) {
      console.warn('Max nesting depth reached');
      return [];
    }

    try {
      // Build fields parameter for nested M2A
      let fieldsParam = '*';
      
      // Add item expansion for each allowed collection
      if (fieldInfo.allowedCollections.length > 0) {
        const itemFields = fieldInfo.allowedCollections
          .map(col => `item:${col}.*`)
          .join(',');
        fieldsParam = `*,${itemFields}`;
      } else {
        // If no allowed collections specified, try to expand item generically
        fieldsParam = '*,item.*';
      }

      // Load junction records
      const response = await this.api.get(`/items/${fieldInfo.junctionCollection}`, {
        params: {
          filter: {
            [fieldInfo.foreignKeyField]: {
              _eq: parentId
            }
          },
          fields: fieldsParam,
          limit: -1,
          sort: 'id'
        }
      });

      const records = response.data.data || [];

      // If there are nested M2A fields, load them recursively
      if (fieldInfo.hasNestedM2A && depth < maxDepth) {
        for (const record of records) {
          if (record.item && typeof record.item === 'object') {
            const itemCollection = record.collection;
            const nestedFieldInfo = fieldInfo.nestedM2AFields?.[itemCollection];
            
            if (nestedFieldInfo) {
              // Find all M2A fields in this item
              const itemFields = this.fieldsStore.getFieldsForCollection(itemCollection);
              const m2aFields = itemFields.filter((f: any) => 
                f.meta?.special?.includes('m2a')
              );

              for (const m2aField of m2aFields) {
                // Load nested M2A data
                const nestedData = await this.loadM2AData(
                  record.item.id,
                  nestedFieldInfo,
                  depth + 1,
                  maxDepth
                );
                
                // Attach to item
                record.item[m2aField.field] = nestedData;
              }
            }
          }
        }
      }

      return records;
    } catch (error) {
      console.error(`Error loading M2A data for ${fieldInfo.collection}.${fieldInfo.field}:`, error);
      throw error; // Re-throw to match test expectations
    }
  }

  /**
   * Create default data for a collection, initializing all M2A fields
   */
  getDefaultDataForCollection(collection: string): any {
    const defaultData: any = {};
    
    try {
      const fields = this.fieldsStore.getFieldsForCollection(collection);
      
      // Process each field
      fields.forEach((field: any) => {
        // Skip system fields
        if (['id', 'user_created', 'user_updated', 'date_created', 'date_updated'].includes(field.field)) {
          return;
        }
        
        // Skip hidden fields
        if (field.meta?.hidden) {
          return;
        }
        
        // Use schema default if available
        if (field.schema?.default_value !== null && field.schema?.default_value !== undefined) {
          defaultData[field.field] = field.schema.default_value;
          return;
        }
        
        // Set defaults based on field type
        switch (field.type) {
          case 'string':
          case 'text':
            defaultData[field.field] = '';
            break;
          case 'integer':
          case 'bigInteger':
          case 'float':
          case 'decimal':
            defaultData[field.field] = 0;
            break;
          case 'boolean':
            defaultData[field.field] = false;
            break;
          case 'json':
          case 'csv':
            defaultData[field.field] = null;
            break;
          case 'uuid':
          case 'hash':
            defaultData[field.field] = null;
            break;
          case 'date':
          case 'dateTime':
          case 'time':
          case 'timestamp':
            defaultData[field.field] = null;
            break;
          default:
            // For alias fields (like M2A), don't include in defaults
            if (field.type !== 'alias') {
              defaultData[field.field] = null;
            }
        }
      });
      
    } catch (error) {
      logger.warn(`Could not get fields for ${collection}:`, error);
    }
    
    return defaultData;
  }
}