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
import { getLogger } from '../utils/logger-utils';
import type { Logger, DirectusServices, DirectusSchema, DirectusAccountability } from '../types/directus-api';
import { Knex } from 'knex';

/**
 * Service for analyzing collection fields and identifying searchable fields
 */
export class FieldAnalyzer {
  private services: DirectusServices;
  private schema: DirectusSchema;
  private database?: Knex;
  private accountability?: DirectusAccountability;
  private logger: Logger;

  constructor(config: FieldAnalyzerConfig) {
    this.services = config.services;
    this.schema = config.schema;
    this.database = config.database;
    this.accountability = config.accountability;
    this.logger = getLogger(config.services);
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


}