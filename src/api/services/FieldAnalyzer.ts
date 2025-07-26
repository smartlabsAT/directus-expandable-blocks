import {
  FieldAnalyzerConfig,
  FieldAnalyzerOptions,
  SearchableField,
  DEFAULT_FIELD_OPTIONS,
  isSystemField,
  isNonDataType,
  calculateFieldPriority
} from '../types/FieldAnalyzerTypes';
import { InvalidCollectionError } from '../types/errors';
import { TranslationFieldAnalyzer } from './TranslationFieldAnalyzer';
import { TranslationFieldAnalyzerConfig } from '../types/TranslationFieldAnalyzerTypes';

/**
 * Service for analyzing collection fields and identifying searchable fields
 */
export class FieldAnalyzer {
  private services: any;
  private schema: any;
  private database?: any;
  private accountability?: any;
  private logger: any;

  constructor(config: FieldAnalyzerConfig) {
    this.services = config.services;
    this.schema = config.schema;
    this.database = config.database;
    this.accountability = config.accountability;
    this.logger = config.services?.logger || console;
  }

  /**
   * Get searchable fields for a collection
   * @param collection The collection to analyze
   * @param options Analysis options
   * @returns Array of searchable fields
   */
  async getSearchableFields(
    collection: string,
    options: FieldAnalyzerOptions = {}
  ): Promise<SearchableField[]> {
    // Merge with default options
    const opts = { ...DEFAULT_FIELD_OPTIONS, ...options };

    try {
      // Get FieldsService from injected services
      const { FieldsService } = this.services;

      // Create FieldsService instance
      const fieldsService = new FieldsService({
        schema: this.schema,
        accountability: this.accountability,
        knex: this.database
      });

      // Get all fields for the collection
      const allFields = await fieldsService.readAll(collection);

      if (!allFields || allFields.length === 0) {
        throw new InvalidCollectionError(collection);
      }

      // Check for translations if requested
      let translationInfo: Map<string, Partial<SearchableField>> = new Map();
      
      if (opts.includeTranslations && this.database) {
        // Use TranslationFieldAnalyzer for translation detection
        const translationAnalyzer = new TranslationFieldAnalyzer({
          database: this.database,
          services: this.services,
          schema: this.schema,
          accountability: this.accountability
        });
        
        const translationFullInfo = await translationAnalyzer.analyzeCollection(collection);
        const translatableFields = await translationAnalyzer.getTranslatableFields(collection);
        
        // Handle different translation patterns
        if (translationFullInfo.translationType === 'combined') {
          // For combined translations, don't mark individual fields as translatable
          // Instead, add a note about the combined translation
          this.logger.debug(`[FieldAnalyzer] Combined translation detected for ${collection}`);
        } else {
          // For standard translations, map translation info to fields
          translatableFields.forEach(tf => {
            // Only add translation info for fields that are NOT content fields
            if (!tf.isContentField) {
              translationInfo.set(tf.field, {
                translatable: true,
                translation_type: tf.translationMethod || 'none',
                translation_fields: tf.translationTableFields
              });
            }
          });
        }
      }

      // Filter fields based on options
      let searchableFields = allFields
        .filter((field: any) => this.shouldIncludeField(field, opts))
        .map((field: any) => {
          const transformed = this.transformToSearchableField(field);
          
          // Add translation info if available
          const transInfo = translationInfo.get(field.field);
          if (transInfo) {
            Object.assign(transformed, transInfo);
          }
          
          // JSON translations are handled by TranslationFieldAnalyzer
          
          return transformed;
        });

      // Filter only translatable if requested
      if (opts.onlyTranslatable) {
        searchableFields = searchableFields.filter((field: any) => field.translatable);
      }

      // Sort by priority if requested
      if (opts.sortByPriority) {
        searchableFields.sort((a: any, b: any) => {
          const priorityDiff = (b.display_priority || 0) - (a.display_priority || 0);
          if (priorityDiff !== 0) return priorityDiff;
          
          // Secondary sort by field name
          return a.field.localeCompare(b.field);
        });
      }

      return searchableFields;
    } catch (error: any) {
      if (error instanceof InvalidCollectionError) {
        throw error;
      }
      throw new Error(
        `Failed to analyze fields for collection '${collection}': ${error.message || error}`
      );
    }
  }

  /**
   * Get all field metadata for a collection (unfiltered)
   * @param collection The collection to analyze
   * @returns All fields with full metadata
   */
  async getAllFields(collection: string): Promise<any[]> {
    const { FieldsService } = this.services;

    const fieldsService = new FieldsService({
      schema: this.schema,
      accountability: this.accountability,
      knex: this.database
    });

    return await fieldsService.readAll(collection);
  }

  /**
   * Get field with complete configuration details
   * @param collection The collection
   * @param fieldName The field name
   * @returns Complete field configuration
   */
  async getFieldConfiguration(collection: string, fieldName: string): Promise<any> {
    const allFields = await this.getAllFields(collection);
    const field = allFields.find(f => f.field === fieldName);
    
    if (!field) {
      return null;
    }

    // Return complete field information including all metadata
    return {
      ...field,
      searchableField: this.transformToSearchableField(field)
    };
  }

  /**
   * Get fields with specific interface options
   * @param collection The collection to analyze
   * @param interfaceType The interface type (e.g., 'select-dropdown')
   * @returns Fields with that interface and their options
   */
  async getFieldsByInterfaceWithOptions(
    collection: string, 
    interfaceType: string
  ): Promise<SearchableField[]> {
    const fields = await this.getSearchableFields(collection, {
      interfaces: [interfaceType],
      includeMetadata: true
    });

    return fields;
  }

  /**
   * Get select/dropdown fields with their choice values
   * @param collection The collection to analyze
   * @returns Select fields with their options
   */
  async getSelectFields(collection: string): Promise<SearchableField[]> {
    const selectInterfaces = ['select-dropdown', 'select-dropdown-m2o', 'select-radio', 'select-multiple-dropdown'];
    
    const fields = await this.getSearchableFields(collection, {
      includeMetadata: true
    });

    return fields.filter(field => 
      field.interface && selectInterfaces.includes(field.interface)
    );
  }

  /**
   * Check if a collection has searchable fields
   * @param collection The collection to check
   * @returns true if collection has searchable fields
   */
  async hasSearchableFields(collection: string): Promise<boolean> {
    const fields = await this.getSearchableFields(collection);
    return fields.length > 0;
  }

  /**
   * Get field by name
   * @param collection The collection
   * @param fieldName The field name
   * @returns Field metadata or null
   */
  async getField(collection: string, fieldName: string): Promise<SearchableField | null> {
    const fields = await this.getSearchableFields(collection, {
      includeSystem: true,
      includeHidden: true,
      includeReadonly: true
    });

    return fields.find(f => f.field === fieldName) || null;
  }

  /**
   * Determine if a field should be included based on options
   * @param field The field to check
   * @param options Analysis options
   * @returns true if field should be included
   */
  private shouldIncludeField(field: any, options: Required<FieldAnalyzerOptions>): boolean {
    // Check system fields
    if (!options.includeSystem && isSystemField(field.field)) {
      return false;
    }

    // Check non-data types
    if (!options.includeNonData && isNonDataType(field.type)) {
      return false;
    }

    // Check readonly fields
    if (!options.includeReadonly && field.meta?.readonly) {
      return false;
    }

    // Check hidden fields
    if (!options.includeHidden && field.meta?.hidden) {
      return false;
    }

    // Check type filter
    if (options.types.length > 0 && !options.types.includes(field.type)) {
      return false;
    }

    // Check interface filter
    if (options.interfaces.length > 0 && 
        (!field.meta?.interface || !options.interfaces.includes(field.meta.interface))) {
      return false;
    }

    return true;
  }

  /**
   * Transform a raw field to SearchableField format
   * @param field Raw field from FieldsService
   * @returns SearchableField object
   */
  private transformToSearchableField(field: any): SearchableField {
    const searchableField: SearchableField = {
      field: field.field,
      name: field.meta?.display || field.meta?.name || field.field,
      type: field.type,
      interface: field.meta?.interface,
      note: field.meta?.note,
      display_priority: calculateFieldPriority(field.field),
      required: field.meta?.required || false,
      readonly: field.meta?.readonly || false,
      hidden: field.meta?.hidden || false,
      default_value: field.default_value,
      special: field.meta?.special,
      width: field.meta?.width,
      translations: field.meta?.translations,
      validation: field.meta?.validation,
      conditions: field.meta?.conditions,
      translatable: false,
      translation_type: 'none'
    };

    // Extract interface-specific options
    if (field.meta?.options) {
      searchableField.options = field.meta.options;
      
      // For select-dropdown, radio-buttons, etc. with choices
      if (field.meta.options.choices) {
        searchableField.options.choices = field.meta.options.choices;
      }
    }

    // Extract display options
    if (field.meta?.display_options) {
      searchableField.display_options = field.meta.display_options;
    }

    // Include full metadata if needed
    if (field.meta) {
      searchableField.meta = field.meta;
    }

    // Include schema information if available
    if (field.schema) {
      searchableField.schema = field.schema;
    }

    // Add additional priority based on field configuration
    if (field.meta?.required) {
      searchableField.display_priority = (searchableField.display_priority || 0) + 10;
    }

    // Boost text fields
    if (['string', 'text'].includes(field.type)) {
      searchableField.display_priority = (searchableField.display_priority || 0) + 5;
    }

    return searchableField;
  }

  /**
   * Get fields grouped by type
   * @param collection The collection to analyze
   * @param options Analysis options
   * @returns Fields grouped by type
   */
  async getFieldsByType(
    collection: string,
    options: FieldAnalyzerOptions = {}
  ): Promise<Record<string, SearchableField[]>> {
    const fields = await this.getSearchableFields(collection, options);
    
    const grouped: Record<string, SearchableField[]> = {};
    
    fields.forEach(field => {
      if (!grouped[field.type]) {
        grouped[field.type] = [];
      }
      grouped[field.type].push(field);
    });

    return grouped;
  }

  /**
   * Get fields grouped by interface
   * @param collection The collection to analyze
   * @param options Analysis options
   * @returns Fields grouped by interface
   */
  async getFieldsByInterface(
    collection: string,
    options: FieldAnalyzerOptions = {}
  ): Promise<Record<string, SearchableField[]>> {
    const fields = await this.getSearchableFields(collection, options);
    
    const grouped: Record<string, SearchableField[]> = {};
    
    fields.forEach(field => {
      const interfaceType = field.interface || 'none';
      if (!grouped[interfaceType]) {
        grouped[interfaceType] = [];
      }
      grouped[interfaceType].push(field);
    });

    return grouped;
  }

  /**
   * Get text-searchable fields (suitable for full-text search)
   * @param collection The collection to analyze
   * @returns Fields suitable for text search
   */
  async getTextSearchableFields(collection: string): Promise<SearchableField[]> {
    return this.getSearchableFields(collection, {
      types: ['string', 'text', 'json'],
      includeReadonly: false
    });
  }

  /**
   * Get numeric fields
   * @param collection The collection to analyze
   * @returns Numeric fields
   */
  async getNumericFields(collection: string): Promise<SearchableField[]> {
    return this.getSearchableFields(collection, {
      types: ['integer', 'bigInteger', 'float', 'decimal']
    });
  }

  /**
   * Get date/time fields
   * @param collection The collection to analyze
   * @returns Date/time fields
   */
  async getDateTimeFields(collection: string): Promise<SearchableField[]> {
    return this.getSearchableFields(collection, {
      types: ['date', 'dateTime', 'timestamp']
    });
  }

  /**
   * Get relation fields (M2O, O2M, M2M, M2A)
   * @param collection The collection to analyze
   * @returns Relation fields with their configuration
   */
  async getRelationFields(collection: string): Promise<SearchableField[]> {
    const relationInterfaces = [
      'select-dropdown-m2o',
      'list-m2m',
      'list-o2m',
      'list-m2a',
      'files',
      'file',
      'file-image'
    ];
    
    const fields = await this.getSearchableFields(collection, {
      includeMetadata: true
    });

    return fields.filter(field => 
      field.interface && relationInterfaces.includes(field.interface)
    );
  }

  /**
   * Get fields with validation rules
   * @param collection The collection to analyze
   * @returns Fields that have validation rules
   */
  async getValidatedFields(collection: string): Promise<SearchableField[]> {
    const fields = await this.getSearchableFields(collection, {
      includeMetadata: true
    });

    return fields.filter(field => 
      field.validation || field.required
    );
  }

  /**
   * Get conditional fields
   * @param collection The collection to analyze
   * @returns Fields that have conditional display rules
   */
  async getConditionalFields(collection: string): Promise<SearchableField[]> {
    const fields = await this.getSearchableFields(collection, {
      includeMetadata: true,
      includeHidden: true
    });

    return fields.filter(field => 
      field.conditions && field.conditions.length > 0
    );
  }

  /**
   * Check if a collection has translations
   * @param collection The collection to check
   * @returns true if collection has translations
   * @deprecated Use TranslationFieldAnalyzer.hasTranslations() instead
   */
  async hasTranslations(collection: string): Promise<boolean> {
    if (!this.database) {
      return false;
    }
    
    const translationAnalyzer = new TranslationFieldAnalyzer({
      database: this.database,
      services: this.services,
      schema: this.schema,
      accountability: this.accountability
    });
    
    return translationAnalyzer.hasTranslations(collection);
  }

  /**
   * Get translatable fields from a collection
   * @param collection The collection to analyze
   * @returns Fields that can be translated
   * @deprecated Use TranslationFieldAnalyzer.getTranslatableFields() instead
   */
  async getTranslatableFields(collection: string): Promise<SearchableField[]> {
    if (!this.database) {
      return [];
    }
    
    const translationAnalyzer = new TranslationFieldAnalyzer({
      database: this.database,
      services: this.services,
      schema: this.schema,
      accountability: this.accountability
    });
    
    const translatableFields = await translationAnalyzer.getTranslatableFields(collection);
    
    // Convert to SearchableField format
    return translatableFields.map(tf => ({
      field: tf.field,
      name: tf.name || tf.field,
      type: tf.type,
      translatable: tf.translatable,
      translation_type: tf.translationMethod || 'none',
      translation_fields: tf.translationTableFields,
      display_priority: calculateFieldPriority(tf.field)
    } as SearchableField));
  }

  /**
   * Get available languages from Directus
   * @returns Array of available languages
   * @deprecated Use TranslationFieldAnalyzer.getAvailableLanguages() instead
   */
  async getAvailableLanguages(): Promise<any[]> {
    if (!this.database) {
      return [];
    }
    
    const translationAnalyzer = new TranslationFieldAnalyzer({
      database: this.database,
      services: this.services,
      schema: this.schema,
      accountability: this.accountability
    });
    
    return translationAnalyzer.getAvailableLanguages();
  }

  /**
   * Get translation table info
   * @param collection The collection to analyze
   * @returns Translation table information
   * @deprecated Use TranslationFieldAnalyzer.analyzeCollection() instead
   */
  async getTranslationTableInfo(collection: string): Promise<any> {
    if (!this.database) {
      return null;
    }
    
    const translationAnalyzer = new TranslationFieldAnalyzer({
      database: this.database,
      services: this.services,
      schema: this.schema,
      accountability: this.accountability
    });
    
    const info = await translationAnalyzer.analyzeCollection(collection, {
      includeFieldMapping: true
    });
    
    if (!info.hasTranslations || info.translationType !== 'table') {
      return null;
    }
    
    return {
      exists: true,
      tableName: info.translationTable,
      fields: info.translationFields || [],
      linkField: info.linkField,
      languageField: info.languageField,
      translationFields: info.translationFields?.map(f => f.field) || []
    };
  }
}