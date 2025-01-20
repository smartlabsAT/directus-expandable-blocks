import { Knex } from 'knex';
import {
  TranslationFieldAnalyzerConfig,
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

/**
 * Service for analyzing translation fields and patterns in Directus collections
 */
export class TranslationFieldAnalyzer {
  private database: Knex;
  private services: any;
  private schema?: any;
  private accountability?: any;
  private assumeCombinedPattern: boolean;

  constructor(config: TranslationFieldAnalyzerConfig) {
    this.database = config.database;
    this.services = config.services;
    this.schema = config.schema;
    this.accountability = config.accountability;
    this.assumeCombinedPattern = config.assumeCombinedPattern ?? true; // Default to true
  }

  /**
   * Analyze a collection for translation capabilities
   * @param collection The collection to analyze
   * @param options Analysis options
   * @returns Complete translation information
   */
  async analyzeCollection(
    collection: string,
    options: TranslationAnalysisOptions = {}
  ): Promise<TranslationInfo> {
    console.log(`[TranslationAnalyzer] Analyzing collection: ${collection}`);

    // Detect translation pattern
    const pattern = await this.detectTranslationPattern(collection, options);
    console.log(`[TranslationAnalyzer] Detected pattern:`, pattern);

    // Basic info
    const info: TranslationInfo = {
      hasTranslations: false,
      translationType: 'none'
    };

    // Check for table-based translations
    if (pattern.type === 'standard' || pattern.type === 'custom' || pattern.type === 'combined') {
      const tableInfo = await this.analyzeTranslationTable(
        collection,
        pattern.details.tableName!
      );
      
      if (tableInfo) {
        info.hasTranslations = true;
        info.translationTable = tableInfo.tableName;
        info.linkField = tableInfo.linkField;
        info.languageField = tableInfo.languageField;
        info.translationFields = tableInfo.fields;

        // If assumeCombinedPattern is true or pattern detected as combined
        if (this.assumeCombinedPattern || pattern.type === 'combined') {
          info.translationType = 'combined';
          info.isCombinedTranslation = true;
          
          // Get source fields that would be translated
          const mainFields = await this.getCollectionFields(collection);
          const sourceFields = mainFields
            .filter(f => ['string', 'text'].includes(f.type) && !EXCLUDED_TRANSLATION_FIELDS.includes(f.field as any))
            .map(f => f.field);
            
          info.message = `This collection uses combined translations where multiple fields are translated together in the translation table.`;
          
          // Enhance translation fields with coversFields for combined pattern
          if (info.translationFields) {
            info.translationFields = info.translationFields.map(tf => ({
              ...tf,
              translationMethod: 'combined' as const,
              isContentField: true,
              coversFields: sourceFields
            }));
          }
        } else {
          // Standard 1:1 pattern detection logic
          const mainFields = await this.getCollectionFields(collection);
          const mainFieldNames = new Set(mainFields.map(f => f.field));
          const hasNonMatchingFields = tableInfo.fields.some(tf => 
            !mainFieldNames.has(tf.field) && 
            !['id', tf.field].includes(tableInfo.linkField) &&
            tf.field !== tableInfo.languageField
          );
          
          if (hasNonMatchingFields) {
            info.translationType = 'combined';
            info.isCombinedTranslation = true;
            const sourceFields = mainFields
              .filter(f => ['string', 'text'].includes(f.type) && !EXCLUDED_TRANSLATION_FIELDS.includes(f.field as any))
              .map(f => f.field);
            info.message = `Detected combined translation pattern. Multiple source fields are translated into single translation fields.`;
            
            // Enhance translation fields with coversFields for combined pattern
            if (info.translationFields) {
              info.translationFields = info.translationFields.map(tf => ({
                ...tf,
                translationMethod: 'combined' as const,
                isContentField: true,
                coversFields: sourceFields
              }));
            }
          } else {
            info.translationType = 'table';
            // For standard 1:1 translations, enhance fields with translationMethod
            if (info.translationFields) {
              info.translationFields = info.translationFields.map(tf => ({
                ...tf,
                translationMethod: 'table' as const
              }));
            }
          }
        }

        if (options.includeFieldMapping) {
          info.fieldMapping = await this.createFieldMapping(collection, tableInfo.tableName);
        }
      }
    }

    // Check for JSON-based translations
    const jsonFields = await this.detectJSONTranslationFields(collection);
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

    return info;
  }

  /**
   * Check if a collection has any form of translations
   * @param collection The collection to check
   * @returns true if translations exist
   */
  async hasTranslations(collection: string): Promise<boolean> {
    const info = await this.analyzeCollection(collection);
    return info.hasTranslations;
  }

  /**
   * Get translatable fields from a collection
   * @param collection The collection to analyze
   * @returns Array of translatable fields
   */
  async getTranslatableFields(collection: string): Promise<TranslationField[]> {
    console.log(`[TranslationAnalyzer] Getting translatable fields for: ${collection}`);

    const info = await this.analyzeCollection(collection, {
      includeFieldMapping: true
    });

    if (!info.hasTranslations) {
      return [];
    }

    const fields: TranslationField[] = [];

    // Get main collection fields
    const mainFields = await this.getCollectionFields(collection);

    if (info.translationType === 'table' || info.translationType === 'hybrid' || info.translationType === 'combined') {
      // Check if it's a combined translation pattern
      const translationFieldNames = new Set(info.translationFields?.map(f => f.field) || []);
      const mainFieldNames = new Set(mainFields.map(f => f.field));
      
      // Find translation fields that don't have corresponding main fields
      const nonMatchingTransFields = info.translationFields?.filter(tf => 
        !mainFieldNames.has(tf.field) &&
        !EXCLUDED_TRANSLATION_FIELDS.includes(tf.field as any) &&
        !tf.field.endsWith('_id') &&
        !LANGUAGE_FIELD_NAMES.includes(tf.field as any)
      ) || [];
      
      console.log(`[TranslationAnalyzer] Non-matching translation fields:`, nonMatchingTransFields.map(f => f.field));
      
      // For combined pattern (our primary use case)
      if (info.translationType === 'combined' || this.assumeCombinedPattern) {
        // Return the translation fields themselves, not the source fields
        const translationContentFields = info.translationFields?.filter(tf => 
          !EXCLUDED_TRANSLATION_FIELDS.includes(tf.field as any) &&
          !LANGUAGE_FIELD_NAMES.includes(tf.field as any) &&
          !tf.field.endsWith('_id')
        ) || [];
        
        console.log(`[TranslationAnalyzer] Combined pattern - translation content fields:`, translationContentFields.map(f => f.field));
        
        translationContentFields.forEach(tf => {
          fields.push({
            field: tf.field,
            type: tf.type,
            name: tf.name || `${collection} Translation`,
            translatable: true,
            translationMethod: 'combined',
            isContentField: true,
            coversFields: info.sourceFields || mainFields
              .filter(f => ['string', 'text'].includes(f.type) && !EXCLUDED_TRANSLATION_FIELDS.includes(f.field as any))
              .map(f => f.field)
          });
        });
      } else {
        // Standard 1:1 mapping (fallback)
        console.log(`[TranslationAnalyzer] Standard 1:1 pattern`);
        
        // Check if we have non-matching fields anyway
        if (nonMatchingTransFields.length > 0 && translationFieldNames.size > 0) {
          // Combined pattern detected
          nonMatchingTransFields.forEach(tf => {
            fields.push({
              field: tf.field,
              type: tf.type,
              name: tf.name || tf.field,
              translatable: true,
              translationMethod: 'table',
              isContentField: true,
              coversFields: mainFields
                .filter(f => ['string', 'text'].includes(f.type) && !EXCLUDED_TRANSLATION_FIELDS.includes(f.field as any))
                .map(f => f.field)
            });
          });
        } else {
          // True 1:1 field mapping
          mainFields.forEach(field => {
            if (translationFieldNames.has(field.field)) {
              fields.push({
                field: field.field,
                type: field.type,
                name: field.meta?.display || field.meta?.name || field.field,
                translatable: true,
                translationMethod: 'table',
                translationTableFields: [field.field]
              });
            }
          });
        }
      }
    }

    // Add JSON translation fields
    if (info.translationType === 'json' || info.translationType === 'hybrid') {
      const jsonFields = await this.detectJSONTranslationFields(collection);
      jsonFields.forEach(field => {
        fields.push({
          field: field.field,
          type: field.type,
          name: field.meta?.display || field.meta?.name || field.field,
          translatable: true,
          translationMethod: 'json'
        });
      });
    }

    return fields;
  }

  /**
   * Detect the translation pattern used by a collection
   * @param collection The collection to analyze
   * @param options Analysis options
   * @returns Detected pattern information
   */
  private async detectTranslationPattern(
    collection: string,
    options: TranslationAnalysisOptions = {}
  ): Promise<TranslationPattern> {
    // Try standard patterns first
    const patterns = options.translationTablePattern 
      ? [options.translationTablePattern]
      : TRANSLATION_TABLE_PATTERNS;

    for (const pattern of patterns) {
      const tableName = pattern.replace('{collection}', collection);
      if (await this.checkTableExists(tableName)) {
        // If assumeCombinedPattern is true, always return combined type
        if (this.assumeCombinedPattern) {
          return {
            type: 'combined',
            confidence: 1.0,
            details: { 
              tableName,
              isCombined: true
            }
          };
        }
        
        return {
          type: 'standard',
          confidence: 1.0,
          details: { tableName }
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
      type: 'standard',
      confidence: 0,
      details: {}
    };
  }

  /**
   * Analyze a translation table
   * @param collection The main collection
   * @param translationTable The translation table name
   * @returns Translation table details
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
          translatable: true
        }));

      return {
        tableName: translationTable,
        fields: contentFields,
        linkField,
        languageField
      };
    } catch (error) {
      console.error(`[TranslationAnalyzer] Error analyzing translation table:`, error);
      return null;
    }
  }

  /**
   * Detect the link field in a translation table
   * @param fields Fields from the translation table
   * @param collection The main collection name
   * @returns The detected link field name
   */
  private detectLinkField(fields: any[], collection: string): string {
    // Try exact match first
    const exactMatch = fields.find(f => f.field === `${collection}_id`);
    if (exactMatch) return exactMatch.field;

    // Try singular form
    const singular = collection.endsWith('s') ? collection.slice(0, -1) : collection;
    const singularMatch = fields.find(f => f.field === `${singular}_id`);
    if (singularMatch) return singularMatch.field;

    // Try common patterns
    const patterns = ['parent_id', 'item_id', 'reference_id'];
    const patternMatch = fields.find(f => patterns.includes(f.field));
    if (patternMatch) return patternMatch.field;

    // Fallback
    return `${collection}_id`;
  }

  /**
   * Detect the language field in a translation table
   * @param fields Fields from the translation table
   * @returns The detected language field name
   */
  private detectLanguageField(fields: any[]): string {
    const match = fields.find(f => 
      LANGUAGE_FIELD_NAMES.includes(f.field as any)
    );
    return match?.field || 'languages_code';
  }

  /**
   * Detect JSON-based translation fields
   * @param collection The collection to analyze
   * @returns Fields that use JSON for translations
   */
  private async detectJSONTranslationFields(collection: string): Promise<any[]> {
    const fields = await this.getCollectionFields(collection);
    
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
   * Create field mapping between main and translation tables
   * @param collection The main collection
   * @param translationTable The translation table
   * @returns Field mappings
   */
  private async createFieldMapping(
    collection: string,
    translationTable: string
  ): Promise<TranslationFieldMapping[]> {
    const mainFields = await this.getCollectionFields(collection);
    const translationFields = await this.getCollectionFields(translationTable);
    
    const mappings: TranslationFieldMapping[] = [];
    
    // Filter to only content fields
    const mainContentFields = mainFields.filter(f => 
      ['string', 'text'].includes(f.type) &&
      !EXCLUDED_TRANSLATION_FIELDS.includes(f.field as any)
    );
    
    const transContentFields = translationFields.filter(f =>
      !EXCLUDED_TRANSLATION_FIELDS.includes(f.field as any) &&
      !LANGUAGE_FIELD_NAMES.includes(f.field as any) &&
      !f.field.endsWith('_id')
    );

    // First pass: Look for exact matches
    const matchedTransFields = new Set<string>();
    
    mainContentFields.forEach(mainField => {
      const exactMatch = transContentFields.find(tf => tf.field === mainField.field);
      if (exactMatch) {
        mappings.push({
          sourceField: mainField.field,
          translationField: exactMatch.field,
          isDirectMatch: true,
          confidence: 1.0
        });
        matchedTransFields.add(exactMatch.field);
      }
    });

    // Second pass: Handle unmatched translation fields (combined translation pattern)
    const unmatchedTransFields = transContentFields.filter(tf => !matchedTransFields.has(tf.field));
    
    if (unmatchedTransFields.length > 0) {
      // This indicates a combined translation pattern
      // Don't create mappings for every field to every translation field
      // Instead, create a special mapping indicating this is a combined field
      unmatchedTransFields.forEach(transField => {
        // Only create one mapping per translation field indicating it's a combined field
        mappings.push({
          sourceField: '*', // Special marker for combined fields
          translationField: transField.field,
          isDirectMatch: false,
          confidence: 0.3 // Lower confidence for combined fields
        });
      });
    }

    return mappings;
  }

  /**
   * Get available languages from Directus
   * @returns Array of available languages
   */
  async getAvailableLanguages(): Promise<Language[]> {
    try {

      // Use direct database query instead of ItemsService to avoid field parsing issues
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
      console.error('[TranslationAnalyzer] Error getting languages:', error);
      return [];
    }
  }

  /**
   * Get translation coverage for a collection
   * @param collection The collection to analyze
   * @returns Coverage information
   */
  async getTranslationCoverage(collection: string): Promise<TranslationCoverage> {
    const translatableFields = await this.getTranslatableFields(collection);
    const languages = await this.getAvailableLanguages();
    
    // This is a simplified implementation
    // In a real scenario, you'd check actual translated content
    const totalFields = translatableFields.length;
    const translatedFields = translatableFields.filter(f => f.translatable).length;
    
    return {
      totalFields,
      translatedFields,
      coveragePercent: totalFields > 0 ? (translatedFields / totalFields) * 100 : 0,
      missingTranslations: []
    };
  }

  /**
   * Get fields from a collection
   * @param collection The collection name
   * @returns Array of fields
   */
  private async getCollectionFields(collection: string): Promise<any[]> {
    try {
      const { FieldsService } = this.services;
      
      const fieldsService = new FieldsService({
        schema: this.schema,
        accountability: this.accountability,
        knex: this.database
      });

      return await fieldsService.readAll(collection);
    } catch (error) {
      console.error(`[TranslationAnalyzer] Error getting fields for ${collection}:`, error);
      return [];
    }
  }

  /**
   * Check if a table exists in the database
   * @param tableName The table name to check
   * @returns true if table exists
   */
  private async checkTableExists(tableName: string): Promise<boolean> {
    try {
      if (!/^[a-zA-Z0-9_-]+$/.test(tableName) || tableName.length > 64) {
        return false;
      }

      const result = await this.database.raw(`
        SELECT EXISTS (
          SELECT FROM information_schema.tables 
          WHERE table_schema = 'public' 
          AND table_name = ?
        );
      `, [tableName]);

      return result.rows?.[0]?.exists || false;
    } catch (error) {
      return false;
    }
  }
}