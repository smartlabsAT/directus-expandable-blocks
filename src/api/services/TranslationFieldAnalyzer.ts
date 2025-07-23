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

  constructor(config: TranslationFieldAnalyzerConfig) {
    this.database = config.database;
    this.services = config.services;
    this.schema = config.schema;
    this.accountability = config.accountability;
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
    // Detect translation pattern
    const pattern = await this.detectTranslationPattern(collection, options);

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

        // Always use combined pattern for now
        if (pattern.type === 'combined') {
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
              //coversFields: sourceFields
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
                //coversFields: sourceFields
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
    const info = await this.analyzeCollection(collection);

    if (!info.hasTranslations || !info.translationFields) {
      return [];
    }

    const fields: TranslationField[] = [];

    // For combined pattern - return translation fields directly
    if (info.translationType === 'combined') {
      const mainFields = await this.getCollectionFields(collection);
      const sourceFields = mainFields
        .filter(f => ['string', 'text'].includes(f.type) && !EXCLUDED_TRANSLATION_FIELDS.includes(f.field as any))
        .map(f => f.field);
        
      info.translationFields.forEach(tf => {
        if (!EXCLUDED_TRANSLATION_FIELDS.includes(tf.field as any) &&
            !LANGUAGE_FIELD_NAMES.includes(tf.field as any) &&
            !tf.field.endsWith('_id')) {
          fields.push({
            ...tf,
            translationMethod: 'combined',
            isContentField: true,
            //coversFields: tf.coversFields || sourceFields
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
      return [];
    }
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

      const fields = await fieldsService.readAll(collection);
      
      // Filter to only fields from the requested collection
      const collectionFields = fields.filter(f => !f.collection || f.collection === collection);
      
      return collectionFields;
    } catch (error) {
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

      // Use Knex schema API as primary method
      return await this.database.schema.hasTable(tableName);
    } catch (error) {
      return false;
    }
  }
}