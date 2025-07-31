import {
  FieldAnalyzerConfig,
  FieldAnalyzerOptions,
  SearchableField,
  DEFAULT_FIELD_OPTIONS,
  isSystemField,
  isNonDataType,
  calculateFieldPriority,
  RawField
} from '../types/FieldAnalyzerTypes';
import { InvalidCollectionError } from '../types/errors';
import {
  TranslationInfo,
  TranslationField,
  TranslationFieldMapping,
  Language,
  TranslationAnalysisOptions,
  TranslationPattern,
  TranslationCoverage,
  TRANSLATION_TABLE_PATTERNS,
  LANGUAGE_FIELD_NAMES,
  LINK_FIELD_PATTERNS,
  EXCLUDED_TRANSLATION_FIELDS
} from '../types/TranslationFieldAnalyzerTypes';
import { getLogger } from '../utils/logger-utils';
import type { Logger, DirectusServices, DirectusSchema, DirectusAccountability } from '../types/directus-api';
import { Knex } from 'knex';

/**
 * Service for analyzing collection fields and identifying searchable fields
 * Now includes integrated translation analysis capabilities
 */
export class FieldAnalyzer {
  private services: DirectusServices;
  private schema: DirectusSchema;
  private database?: Knex;
  private accountability?: DirectusAccountability;
  private logger: Logger;
  
  // Cache for analysis results to avoid redundant calculations
  private analysisCache: Map<string, { timestamp: number; data: any }> = new Map();
  private cacheTimeout = 5 * 60 * 1000; // 5 minutes

  constructor(config: FieldAnalyzerConfig) {
    this.services = config.services;
    this.schema = config.schema;
    this.database = config.database;
    this.accountability = config.accountability;
    this.logger = getLogger(config.services);
  }

  /**
   * Comprehensive collection analysis combining field and translation information
   * @param collection The collection to analyze
   * @param options Analysis options
   * @returns Complete collection analysis including fields and translations
   */
  async analyzeCollectionComplete(
    collection: string,
    options?: {
      fieldOptions?: FieldAnalyzerOptions;
      translationOptions?: TranslationAnalysisOptions;
    }
  ): Promise<{
    searchableFields: SearchableField[];
    translationInfo: TranslationInfo;
    collectionMetadata: {
      totalFields: number;
      translatableCount: number;
      systemFieldsCount: number;
    };
  }> {
    // Check cache first
    const cacheKey = `complete:${collection}:${JSON.stringify(options)}`;
    const cached = this.getCachedResult(cacheKey);
    if (cached) {
      return cached;
    }

    try {
      // Get fields service instance once
      const { FieldsService } = this.services;
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

      // Analyze translations
      const translationInfo = await this.analyzeTranslations(
        collection,
        options?.translationOptions
      );

      // Process searchable fields with translation info
      const searchableFields = await this.processSearchableFields(
        allFields,
        translationInfo,
        options?.fieldOptions || {}
      );

      // Calculate metadata
      const collectionMetadata = {
        totalFields: allFields.length,
        translatableCount: searchableFields.filter(f => f.translatable).length,
        systemFieldsCount: allFields.filter((f: any) => isSystemField(f.field)).length
      };

      const result = {
        searchableFields,
        translationInfo,
        collectionMetadata
      };

      // Cache the result
      this.setCachedResult(cacheKey, result);

      return result;
    } catch (error: any) {
      if (error instanceof InvalidCollectionError) {
        throw error;
      }
      throw new Error(
        `Failed to analyze collection '${collection}': ${error.message || error}`
      );
    }
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
    // Use the comprehensive analysis method
    const result = await this.analyzeCollectionComplete(collection, {
      fieldOptions: options
    });
    
    return result.searchableFields;
  }


  /**
   * Determine if a field should be included based on options
   * @param field The field to check
   * @param options Analysis options
   * @returns true if field should be included
   */
  private shouldIncludeField(field: RawField, options: Required<FieldAnalyzerOptions>): boolean {
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
  private transformToSearchableField(field: RawField): SearchableField {
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
   * Analyze translations for a collection (formerly in TranslationFieldAnalyzer)
   * @param collection The collection to analyze
   * @param options Analysis options
   * @returns Complete translation information
   */
  async analyzeTranslations(
    collection: string,
    options: TranslationAnalysisOptions = {}
  ): Promise<TranslationInfo> {
    // Check cache
    const cacheKey = `translations:${collection}:${JSON.stringify(options)}`;
    const cached = this.getCachedResult(cacheKey);
    if (cached) {
      return cached;
    }

    // Get collection fields once to reuse
    const collectionFields = await this.getCollectionFields(collection);

    // Run independent operations in parallel
    const [pattern, jsonFields] = await Promise.all([
      this.detectTranslationPattern(collection, options),
      this.detectJSONTranslationFieldsFromFields(collectionFields)
    ]);

    // Basic info
    const info: TranslationInfo = {
      hasTranslations: false,
      translationType: 'none'
    };

    // Check for table-based translations
    if (pattern.type === 'standard' || pattern.type === 'custom' || pattern.type === 'combined') {
      if (!pattern.details?.tableName) {
        return info;
      }
      
      const tableInfo = await this.analyzeTranslationTable(
        collection,
        pattern.details.tableName
      );
      
      if (tableInfo) {
        info.hasTranslations = true;
        info.translationTable = tableInfo.tableName;
        info.linkField = tableInfo.linkField;
        info.languageField = tableInfo.languageField;
        info.translationFields = tableInfo.fields;

        // Handle combined pattern
        if (pattern.type === 'combined') {
          info.translationType = 'combined';
          info.isCombinedTranslation = true;
          
          // Get source fields that would be translated (reuse collectionFields)
          const sourceFields = collectionFields
            .filter(f => ['string', 'text'].includes(f.type) && !EXCLUDED_TRANSLATION_FIELDS.includes(f.field as any))
            .map(f => f.field);
            
          info.message = `This collection uses combined translations where multiple fields are translated together in the translation table.`;
          
          // Enhance translation fields
          if (info.translationFields) {
            info.translationFields = info.translationFields.map(tf => ({
              ...tf,
              translationMethod: 'combined' as const,
              isContentField: true
            }));
          }
        } else {
          // Standard 1:1 pattern detection (reuse collectionFields)
          const mainFieldNames = new Set(collectionFields.map(f => f.field));
          const hasNonMatchingFields = tableInfo.fields.some(tf => 
            !mainFieldNames.has(tf.field) && 
            !['id', tf.field].includes(tableInfo.linkField) &&
            tf.field !== tableInfo.languageField
          );
          
          if (hasNonMatchingFields) {
            info.translationType = 'combined';
            info.isCombinedTranslation = true;
            info.message = `Detected combined translation pattern. Multiple source fields are translated into single translation fields.`;
            
            // Enhance translation fields
            if (info.translationFields) {
              info.translationFields = info.translationFields.map(tf => ({
                ...tf,
                translationMethod: 'combined' as const,
                isContentField: true
              }));
            }
          } else {
            info.translationType = 'table';
            // Enhance fields with translationMethod
            if (info.translationFields) {
              info.translationFields = info.translationFields.map(tf => ({
                ...tf,
                translationMethod: 'table' as const
              }));
            }
          }
        }
      }
    }

    // Check for JSON-based translations (already computed in parallel)
    if (jsonFields.length > 0) {
      if (info.hasTranslations && (info.translationType === 'table' || info.translationType === 'combined')) {
        info.translationType = 'hybrid';
        // Add JSON fields to existing translation fields
        const jsonTranslationFields = jsonFields.map(f => ({
          field: f.field,
          type: f.type,
          name: f.meta?.display || f.meta?.name || f.field,
          translatable: true,
          translationMethod: 'json' as const
        }));
        info.translationFields = [...(info.translationFields || []), ...jsonTranslationFields];
      } else {
        info.hasTranslations = true;
        info.translationType = 'json';
        // Set JSON fields as translation fields
        info.translationFields = jsonFields.map(f => ({
          field: f.field,
          type: f.type,
          name: f.meta?.display || f.meta?.name || f.field,
          translatable: true,
          translationMethod: 'json' as const
        }));
      }
    }

    // Get available languages if requested
    if (options.includeLanguages && info.hasTranslations) {
      info.availableLanguages = await this.getAvailableLanguages();
    }

    // Cache the result
    this.setCachedResult(cacheKey, info);

    return info;
  }

  /**
   * Check if a collection has translations
   * @param collection The collection to check
   * @returns true if collection has translations
   */
  async hasTranslations(collection: string): Promise<boolean> {
    const info = await this.analyzeTranslations(collection);
    return info.hasTranslations;
  }

  /**
   * Get translatable fields from a collection
   * @param collection The collection to analyze
   * @returns Array of translatable fields
   */
  async getTranslatableFields(collection: string): Promise<TranslationField[]> {
    const info = await this.analyzeTranslations(collection);

    if (!info.hasTranslations || !info.translationFields) {
      return [];
    }

    const fields: TranslationField[] = [];

    // For combined pattern - return translation fields directly
    if (info.translationType === 'combined') {
      info.translationFields.forEach(tf => {
        if (!EXCLUDED_TRANSLATION_FIELDS.includes(tf.field as any) &&
            !LANGUAGE_FIELD_NAMES.includes(tf.field as any) &&
            !tf.field.endsWith('_id')) {
          fields.push({
            ...tf,
            translationMethod: 'combined',
            isContentField: true,
            interface: tf.interface || null,
            display: tf.display || null,
            options: tf.options || null
          });
        }
      });
    }
    // For table pattern - return matching fields
    else if (info.translationType === 'table') {
      fields.push(...info.translationFields);
    }
    // For JSON pattern
    else if (info.translationType === 'json') {
      const jsonFields = await this.detectJSONTranslationFields(collection);
      jsonFields.forEach(field => {
        fields.push({
          field: field.field,
          type: field.type,
          name: field.meta?.display || field.meta?.name || field.field,
          interface: field.meta?.interface || null,
          display: field.meta?.display || null,
          options: field.meta?.options || null,
          translatable: true,
          translationMethod: 'json'
        });
      });
    }

    return fields;
  }

  /**
   * Get available languages from Directus
   * @returns Array of available languages
   */
  async getAvailableLanguages(): Promise<Language[]> {
    try {
      if (!this.database) {
        return [];
      }

      // Use direct database query to avoid field parsing issues
      const languages = await this.database
        .select('code', 'name', 'direction')
        .from('languages')
        .orderBy('name');

      return languages.map(lang => ({
        code: lang.code,
        name: lang.name,
        direction: lang.direction || 'ltr'
      }));
    } catch (error) {
      return [];
    }
  }

  // Private helper methods for translation analysis

  /**
   * Detect the translation pattern used by a collection
   */
  private async detectTranslationPattern(
    collection: string,
    options: TranslationAnalysisOptions = {}
  ): Promise<TranslationPattern> {
    if (!this.database) {
      return { type: 'none', confidence: 0, details: {} };
    }

    // Try standard patterns first
    const patterns = options.translationTablePattern 
      ? [options.translationTablePattern]
      : TRANSLATION_TABLE_PATTERNS;

    for (const pattern of patterns) {
      const tableName = pattern.replace('{collection}', collection);
      
      if (await this.checkTableExists(tableName)) {
        return {
          type: 'combined',
          confidence: 1.0,
          details: { 
            tableName,
            isCombined: true
          }
        };
      }
    }

    // Check for JSON fields
    const jsonFields = await this.detectJSONTranslationFields(collection);
    
    if (jsonFields.length > 0) {
      return {
        type: 'json',
        confidence: 0.9,
        details: {
          jsonFields: jsonFields.map(f => f.field)
        }
      };
    }

    return {
      type: 'none',
      confidence: 0,
      details: {}
    };
  }

  /**
   * Analyze a translation table
   */
  private async analyzeTranslationTable(
    collection: string,
    translationTable: string
  ): Promise<{
    tableName: string;
    fields: TranslationField[];
    linkField: string;
    languageField: string;
  } | null> {
    try {
      const fields = await this.getCollectionFields(translationTable);
      
      // Find link field
      const linkField = this.detectLinkField(fields, collection);
      
      // Find language field
      const languageField = this.detectLanguageField(fields);
      
      // Get content fields
      const excludeFields = new Set([
        ...EXCLUDED_TRANSLATION_FIELDS,
        linkField,
        languageField
      ]);
      
      const contentFields = fields
        .filter(f => !excludeFields.has(f.field))
        .map(f => ({
          field: f.field,
          type: f.type,
          name: f.meta?.display || f.meta?.name || f.field,
          interface: f.meta?.interface || null,
          display: f.meta?.display || null,
          display_options: f.meta?.display_options || null,
          options: f.meta?.options || null,
          note: f.meta?.note || null,
          required: f.meta?.required || false,
          readonly: f.meta?.readonly || false,
          hidden: f.meta?.hidden || false,
          special: f.meta?.special || null,
          width: f.meta?.width || null,
          validation: f.meta?.validation || null,
          conditions: f.meta?.conditions || null,
          translatable: true,
          meta: f.meta || {},
          schema: f.schema || {}
        }));

      return {
        tableName: translationTable,
        fields: contentFields,
        linkField,
        languageField
      };
    } catch (error) {
      return null;
    }
  }

  /**
   * Detect the link field in a translation table
   */
  private detectLinkField(fields: RawField[], collection: string): string {
    // Try exact match first
    const exactMatch = fields.find(f => f.field === `${collection}_id`);
    if (exactMatch) return exactMatch.field;

    // Fallback
    return `${collection}_id`;
  }

  /**
   * Detect the language field in a translation table
   */
  private detectLanguageField(fields: RawField[]): string {
    const match = fields.find(f => 
      LANGUAGE_FIELD_NAMES.includes(f.field as any)
    );
    return match?.field || 'languages_code';
  }

  /**
   * Detect JSON-based translation fields
   */
  private async detectJSONTranslationFields(collection: string): Promise<RawField[]> {
    const fields = await this.getCollectionFields(collection);
    return this.detectJSONTranslationFieldsFromFields(fields);
  }

  /**
   * Detect JSON-based translation fields from already loaded fields
   */
  private detectJSONTranslationFieldsFromFields(fields: RawField[]): RawField[] {
    return fields.filter(field => {
      // Exclude alias fields (O2M relations)
      if (field.type === 'alias') {
        return false;
      }
      
      // Include only real JSON translation fields
      return field.meta?.interface === 'translations' ||
        (field.type === 'json' && field.meta?.special?.includes('translations'));
    });
  }

  /**
   * Check if a table exists in the database
   */
  private async checkTableExists(tableName: string): Promise<boolean> {
    try {
      if (!this.database) {
        return false;
      }

      if (!/^[a-zA-Z0-9_-]+$/.test(tableName) || tableName.length > 64) {
        return false;
      }

      // Use Knex schema API
      return await this.database.schema.hasTable(tableName);
    } catch (error) {
      return false;
    }
  }

  /**
   * Get fields from a collection (shared helper)
   */
  private async getCollectionFields(collection: string): Promise<RawField[]> {
    try {
      const { FieldsService } = this.services;
      
      const fieldsService = new FieldsService({
        schema: this.schema,
        accountability: this.accountability,
        knex: this.database
      });

      const fields = await fieldsService.readAll(collection);
      
      // Filter to only fields from the requested collection
      const collectionFields = fields.filter((f: any) => !f.collection || f.collection === collection);
      
      return collectionFields;
    } catch (error) {
      return [];
    }
  }

  /**
   * Process searchable fields with translation information
   */
  private async processSearchableFields(
    allFields: RawField[],
    translationInfo: TranslationInfo,
    options: FieldAnalyzerOptions
  ): Promise<SearchableField[]> {
    const opts = { ...DEFAULT_FIELD_OPTIONS, ...options };
    
    // Build translation info map directly from translationInfo
    const translationInfoMap = new Map<string, Partial<SearchableField>>();
    
    if (opts.includeTranslations && translationInfo.hasTranslations && translationInfo.translationFields) {
      // Handle different translation patterns
      if (translationInfo.translationType === 'combined') {
        // For combined translations, don't mark individual fields as translatable
        this.logger.debug(`[FieldAnalyzer] Combined translation detected`);
      } else {
        // For standard translations, map translation info to fields
        translationInfo.translationFields.forEach(tf => {
          // Only add translation info for fields that are NOT content fields
          if (!tf.isContentField) {
            translationInfoMap.set(tf.field, {
              translatable: true,
              translation_type: tf.translationMethod || 'none',
              translation_fields: tf.translationTableFields
            });
          }
        });
      }
    }

    // Filter and transform fields
    let searchableFields = allFields
      .filter((field: RawField) => this.shouldIncludeField(field, opts))
      .map((field: RawField) => {
        const transformed = this.transformToSearchableField(field);
        
        // Add translation info if available
        const transInfo = translationInfoMap.get(field.field);
        if (transInfo) {
          Object.assign(transformed, transInfo);
        }
        
        return transformed;
      });

    // Filter only translatable if requested
    if (opts.onlyTranslatable) {
      searchableFields = searchableFields.filter((field: SearchableField) => field.translatable);
    }

    // Sort by priority if requested
    if (opts.sortByPriority) {
      searchableFields.sort((a: SearchableField, b: SearchableField) => {
        const priorityDiff = (b.display_priority || 0) - (a.display_priority || 0);
        if (priorityDiff !== 0) return priorityDiff;
        
        // Secondary sort by field name
        return a.field.localeCompare(b.field);
      });
    }

    return searchableFields;
  }

  // Cache management methods

  /**
   * Get cached result if still valid
   */
  private getCachedResult(key: string): any | null {
    const cached = this.analysisCache.get(key);
    if (cached && Date.now() - cached.timestamp < this.cacheTimeout) {
      this.logger.debug(`[FieldAnalyzer] Cache hit for key: ${key}`);
      return cached.data;
    }
    return null;
  }

  /**
   * Set cached result
   */
  private setCachedResult(key: string, data: any): void {
    this.analysisCache.set(key, {
      timestamp: Date.now(),
      data
    });
    
    // Clean old cache entries
    if (this.analysisCache.size > 100) {
      const now = Date.now();
      for (const [k, v] of this.analysisCache.entries()) {
        if (now - v.timestamp > this.cacheTimeout) {
          this.analysisCache.delete(k);
        }
      }
    }
  }


}