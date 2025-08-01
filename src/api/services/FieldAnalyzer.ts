import {
  FieldAnalyzerConfig,
  FieldAnalyzerOptions,
  SearchableField,
  DEFAULT_FIELD_OPTIONS,
  isSystemField,
  isNonDataType,
  calculateFieldPriority,
  RawField,
} from '../types/FieldAnalyzerTypes';
import { InvalidCollectionError } from '../types/errors';
import {
  TranslationInfo,
  TranslationField,
  Language,
  TranslationAnalysisOptions,
  TranslationPattern,
  TRANSLATION_TABLE_PATTERNS,
  LANGUAGE_FIELD_NAMES,
  EXCLUDED_TRANSLATION_FIELDS,
} from '../types/TranslationFieldAnalyzerTypes';
import { getLogger } from '../utils/logger-utils';
import type { Logger, DirectusServices, DirectusSchema, DirectusAccountability } from '../types/directus-api';
import type { Knex } from 'knex';

// ============================================================================
// Constants
// ============================================================================

export enum TranslationType {
  NONE = 'none',
  TABLE = 'table',
  JSON = 'json',
  COMBINED = 'combined',
  HYBRID = 'hybrid',
  STANDARD = 'standard',
  CUSTOM = 'custom'
}


// ============================================================================
// Helper Functions
// ============================================================================

/**
 * Detects the link field in a translation table
 */
function detectLinkField(fields: RawField[], collection: string): string {
  const exactMatch = fields.find(f => f.field === `${collection}_id`);
  if (exactMatch) return exactMatch.field;
  return `${collection}_id`;
}

/**
 * Detects the language field in a translation table
 */
function detectLanguageField(fields: RawField[]): string {
  const match = fields.find(f => LANGUAGE_FIELD_NAMES.includes(f.field as any));
  return match?.field || 'languages_code';
}

/**
 * Maps a raw field to translation field format
 */
function mapFieldToTranslationField(field: RawField): TranslationField {
  return {
    field: field.field,
    type: field.type,
    name: field.meta?.display || field.meta?.name || field.field,
    interface: field.meta?.interface || null,
    display: field.meta?.display || null,
    display_options: field.meta?.display_options || null,
    options: field.meta?.options || null,
    note: field.meta?.note || null,
    required: field.meta?.required || false,
    readonly: field.meta?.readonly || false,
    hidden: field.meta?.hidden || false,
    special: field.meta?.special || null,
    width: field.meta?.width || null,
    validation: field.meta?.validation || null,
    conditions: field.meta?.conditions || null,
    translatable: true,
    meta: field.meta || {},
    schema: field.schema || {},
  };
}

/**
 * Checks if a field is a JSON translation field
 */
function isJSONTranslationField(field: RawField): boolean {
  if (field.type === 'alias') {
    return false;
  }

  return field.meta?.interface === 'translations' || (field.type === 'json' && field.meta?.special?.includes('translations')) || false;
}

// ============================================================================
// FieldAnalyzer Class
// ============================================================================

/**
 * Service for analyzing collection fields and identifying searchable fields
 * Now includes integrated translation analysis capabilities
 */
export class FieldAnalyzer {
  private readonly services: DirectusServices;
  private readonly schema: DirectusSchema;
  private readonly database?: Knex;
  private readonly accountability?: DirectusAccountability;
  private readonly logger: Logger;

  private analysisCache: Map<string, { timestamp: number; data: any }> = new Map();
  private cacheTimeout = 5 * 60 * 1000;

  constructor(config: FieldAnalyzerConfig) {
    this.services = config.services;
    this.schema = config.schema;
    this.database = config.database;
    this.accountability = config.accountability;
    this.logger = getLogger(config.services);
  }

  // ============================================================================
  // Public API Methods
  // ============================================================================

  /**
   * Comprehensive collection analysis combining field and translation information
   * @param collection The collection to analyze
   * @param options Analysis options
   * @returns Complete collection analysis including fields and translations
   */
  async analyzeCollectionComplete(collection: string, options?: {
    fieldOptions?: FieldAnalyzerOptions; translationOptions?: TranslationAnalysisOptions;
  }): Promise<{
    searchableFields: SearchableField[]; translationInfo: TranslationInfo; collectionMetadata: {
      totalFields: number; translatableCount: number; systemFieldsCount: number;
    };
  }> {
    const cacheKey = `complete:${collection}:${JSON.stringify(options)}`;
    const cached = this.getCachedResult(cacheKey);
    if (cached) {
      return cached;
    }

    try {
      const {FieldsService} = this.services;
      const fieldsService = new FieldsService({
        schema: this.schema, accountability: this.accountability, knex: this.database,
      });

      const allFields = await fieldsService.readAll(collection);
      if (!allFields || allFields.length === 0) {
        return {
          searchableFields: [],
          translationInfo: {
            hasTranslations: false,
            translationType: TranslationType.NONE
          },
          collectionMetadata: {
            totalFields: 0,
            translatableCount: 0,
            systemFieldsCount: 0,
          }
        };
      }

      const translationInfo = await this.analyzeTranslations(collection, options?.translationOptions);

      const searchableFields = await this.processSearchableFields(allFields, translationInfo, options?.fieldOptions || {});

      const collectionMetadata = {
        totalFields: allFields.length,
        translatableCount: searchableFields.filter(f => f.translatable).length,
        systemFieldsCount: allFields.filter((f: any) => isSystemField(f.field)).length,
      };

      const result = {
        searchableFields, translationInfo, collectionMetadata,
      };

      this.setCachedResult(cacheKey, result);

      return result;
    } catch (error) {
      if (error instanceof InvalidCollectionError) {
        throw error;
      }
      const errorMessage = error instanceof Error ? error.message : String(error);
      throw new Error(`Failed to analyze collection '${collection}': ${errorMessage}`);
    }
  }


  // ============================================================================
  // Private Field Processing Methods
  // ============================================================================

  /**
   * Determine if a field should be included based on options
   * @param field The field to check
   * @param options Analysis options
   * @returns true if field should be included
   */
  private shouldIncludeField(field: RawField, options: Required<FieldAnalyzerOptions>): boolean {
    if (!options.includeSystem && isSystemField(field.field)) {
      return false;
    }

    if (!options.includeNonData && isNonDataType(field.type)) {
      return false;
    }

    if (!options.includeReadonly && field.meta?.readonly) {
      return false;
    }

    if (!options.includeHidden && field.meta?.hidden) {
      return false;
    }

    if (options.types.length > 0 && !options.types.includes(field.type)) {
      return false;
    }

    return !(options.interfaces.length > 0 && (!field.meta?.interface || !options.interfaces.includes(field.meta.interface)));
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
      translation_type: TranslationType.NONE,
    };

    if (field.meta?.options) {
      searchableField.options = field.meta.options;

      if (field.meta.options.choices) {
        searchableField.options.choices = field.meta.options.choices;
      }
    }

    if (field.meta?.display_options) {
      searchableField.display_options = field.meta.display_options;
    }

    if (field.meta) {
      searchableField.meta = field.meta;
    }

    if (field.schema) {
      searchableField.schema = field.schema;
    }

    if (field.meta?.required) {
      searchableField.display_priority = (searchableField.display_priority || 0) + 10;
    }

    if (['string', 'text'].includes(field.type)) {
      searchableField.display_priority = (searchableField.display_priority || 0) + 5;
    }

    return searchableField;
  }

  // ============================================================================
  // Translation Analysis Methods
  // ============================================================================

  /**
   * Analyze translations for a collection (formerly in TranslationFieldAnalyzer)
   * @param collection The collection to analyze
   * @param options Analysis options
   * @returns Complete translation information
   */
  async analyzeTranslations(collection: string, options: TranslationAnalysisOptions = {}): Promise<TranslationInfo> {
    const cacheKey = `translations:${collection}:${JSON.stringify(options)}`;
    const cached = this.getCachedResult(cacheKey);
    if (cached) return cached;

    const collectionFields = await this.getCollectionFields(collection);
    const [pattern, jsonFields] = await Promise.all([this.detectTranslationPattern(collection, options), this.detectJSONTranslationFieldsFromFields(collectionFields)]);

    const info: TranslationInfo = {
      hasTranslations: false, translationType: TranslationType.NONE,
    };

    // Tabellenbasierte Übersetzungen
    if ([TranslationType.STANDARD, TranslationType.CUSTOM, TranslationType.COMBINED].includes(pattern.type) && pattern.details?.tableName) {
      const tableInfo = await this.analyzeTranslationTable(collection, pattern.details.tableName);
      if (tableInfo) {
        info.hasTranslations = true;
        info.translationTable = tableInfo.tableName;
        info.linkField = tableInfo.linkField;
        info.languageField = tableInfo.languageField;
        info.translationFields = tableInfo.fields;

        const mainFieldNames = new Set(collectionFields.map(f => f.field));
        const hasNonMatchingFields = tableInfo.fields.some(tf => !mainFieldNames.has(tf.field) && !['id', tf.field].includes(tableInfo.linkField) && tf.field !== tableInfo.languageField);

        if (pattern.type === TranslationType.COMBINED || hasNonMatchingFields) {
          info.translationType = TranslationType.COMBINED;
          info.isCombinedTranslation = true;
          info.message = 'Diese Collection verwendet kombinierte Übersetzungen, bei denen mehrere Felder gemeinsam in der Übersetzungstabelle gespeichert werden.';
          if (info.translationFields) {
            info.translationFields = info.translationFields.map(tf => ({
              ...tf, translationMethod: TranslationType.COMBINED, isContentField: true,
            }));
          }
        } else {
          info.translationType = TranslationType.TABLE;
          if (info.translationFields) {
            info.translationFields = info.translationFields.map(tf => ({
              ...tf, translationMethod: TranslationType.TABLE,
            }));
          }
        }
      }
    }

    // JSON-basierte Übersetzungen oder Hybrid
    if (jsonFields.length > 0) {
      const jsonTranslationFields = jsonFields.map(f => ({
        ...mapFieldToTranslationField(f), translationMethod: TranslationType.JSON,
      }));

      if (info.hasTranslations && [TranslationType.TABLE, TranslationType.COMBINED].includes(info.translationType)) {
        info.translationType = TranslationType.HYBRID;
        info.translationFields = [...(info.translationFields || []), ...jsonTranslationFields];
      } else {
        info.hasTranslations = true;
        info.translationType = TranslationType.JSON;
        info.translationFields = jsonTranslationFields;
      }
    }

    if (options.includeLanguages && info.hasTranslations) {
      info.availableLanguages = await this.getAvailableLanguages();
    }

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
   * Get available languages from Directus
   * @returns Array of available languages
   */
  async getAvailableLanguages(): Promise<Language[]> {
    const cacheKey = 'languages:all';
    const cached = this.getCachedResult(cacheKey);
    if (cached) return cached;

    if (!this.database) return [];

    try {
      const languages = await this.database
        .select('code', 'name', 'direction')
        .from('languages')
        .orderBy('name');

      const result = languages.map(lang => ({
        code: lang.code, name: lang.name, direction: lang.direction || 'ltr',
      }));

      this.setCachedResult(cacheKey, result);
      return result;
    } catch (error) {
      this.logger.error('[FieldAnalyzer] Failed to load languages:', error);
      return [];
    }
  }

  // ============================================================================
  // Private Analysis Methods
  // ============================================================================

  /**
   * Detect the translation pattern used by a collection
   */
  private async detectTranslationPattern(collection: string, options: TranslationAnalysisOptions = {}): Promise<TranslationPattern> {
    if (!this.database) {
      return {type: TranslationType.NONE, confidence: 0, details: {}};
    }

    const patterns = options.translationTablePattern ? [options.translationTablePattern] : TRANSLATION_TABLE_PATTERNS;

    for (const pattern of patterns) {
      const tableName = pattern.replace('{collection}', collection);
      if (this.database && await this.database.schema.hasTable(tableName)) {
        return {
          type: TranslationType.COMBINED, confidence: 1.0, details: {tableName, isCombined: true},
        };
      }
    }

    const jsonFields = await this.detectJSONTranslationFields(collection);
    if (jsonFields.length > 0) {
      return {
        type: TranslationType.JSON, confidence: 0.9, details: {jsonFields: jsonFields.map(f => f.field)},
      };
    }

    return {type: TranslationType.NONE, confidence: 0, details: {}};
  }

  /**
   * Analyze a translation table
   */
  private async analyzeTranslationTable(collection: string, translationTable: string): Promise<{
    tableName: string; fields: TranslationField[]; linkField: string; languageField: string;
  } | null> {
    try {
      const fields = await this.getCollectionFields(translationTable);

      // Find link field
      const linkField = detectLinkField(fields, collection);

      // Find language field
      const languageField = detectLanguageField(fields);

      // Get content fields
      const excludeFields = new Set([...EXCLUDED_TRANSLATION_FIELDS, linkField, languageField]);

      const contentFields = fields
        .filter(f => !excludeFields.has(f.field))
        .map(mapFieldToTranslationField);

      return {
        tableName: translationTable, fields: contentFields, linkField, languageField,
      };
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      this.logger.debug(`[FieldAnalyzer] Failed to analyze translation table '${translationTable}':`, errorMessage);
      return null;
    }
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
    return fields.filter(isJSONTranslationField);
  }


  /**
   * Get fields from a collection (shared helper)
   */
  private async getCollectionFields(collection: string): Promise<RawField[]> {
    try {
      const {FieldsService} = this.services;

      const fieldsService = new FieldsService({
        schema: this.schema, accountability: this.accountability, knex: this.database,
      });

      const fields = await fieldsService.readAll(collection);
      return fields.filter((f: any) => !f.collection || f.collection === collection);
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      this.logger.warn(`[FieldAnalyzer] Failed to get fields for collection '${collection}':`, errorMessage);
      return [];
    }
  }

  /**
   * Process searchable fields with translation information
   */
  private async processSearchableFields(allFields: RawField[], translationInfo: TranslationInfo, options: FieldAnalyzerOptions): Promise<SearchableField[]> {
    const opts = {...DEFAULT_FIELD_OPTIONS, ...options};

    const translationInfoMap = new Map<string, Partial<SearchableField>>();

    if (opts.includeTranslations && translationInfo.hasTranslations && translationInfo.translationFields) {
      if (translationInfo.translationType === TranslationType.COMBINED) {
        // For combined translations, don't mark individual fields as translatable
      } else {
        translationInfo.translationFields.forEach(tf => {
          if (!tf.isContentField) {
            translationInfoMap.set(tf.field, {
              translatable: true,
              translation_type: tf.translationMethod || TranslationType.NONE,
              translation_fields: tf.translationTableFields,
            });
          }
        });
      }
    }

    let searchableFields = allFields
      .filter((field: RawField) => this.shouldIncludeField(field, opts))
      .map((field: RawField) => {
        const transformed = this.transformToSearchableField(field);

        const transInfo = translationInfoMap.get(field.field);
        if (transInfo) {
          Object.assign(transformed, transInfo);
        }

        return transformed;
      });

    if (opts.onlyTranslatable) {
      searchableFields = searchableFields.filter((field: SearchableField) => field.translatable);
    }

    if (opts.sortByPriority) {
      searchableFields.sort((a: SearchableField, b: SearchableField) => {
        const priorityDiff = (b.display_priority || 0) - (a.display_priority || 0);
        if (priorityDiff !== 0) return priorityDiff;

        return a.field.localeCompare(b.field);
      });
    }

    return searchableFields;
  }

  // ============================================================================
  // Cache Management
  // ============================================================================

  /**
   * Get cached result if still valid
   */
  private getCachedResult(key: string): any | null {
    const cached = this.analysisCache.get(key);
    if (cached && Date.now() - cached.timestamp < this.cacheTimeout) {
      return cached.data;
    }
    return null;
  }

  /**
   * Set cached result
   */
  private setCachedResult(key: string, data: any): void {
    this.analysisCache.set(key, {
      timestamp: Date.now(), data,
    });

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