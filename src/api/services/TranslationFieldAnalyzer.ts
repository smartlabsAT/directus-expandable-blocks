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
import type { DirectusServices, DirectusSchema, DirectusAccountability } from '../types/directus-api';
import { FieldAnalyzer } from './FieldAnalyzer';
import { FieldAnalyzerConfig } from '../types/FieldAnalyzerTypes';

/**
 * Service for analyzing translation fields and patterns in Directus collections
 * 
 * @deprecated Use FieldAnalyzer directly for new implementations.
 * This class is maintained for backward compatibility only.
 * All functionality has been integrated into FieldAnalyzer.
 */
export class TranslationFieldAnalyzer {
  private fieldAnalyzer: FieldAnalyzer;

  constructor(config: TranslationFieldAnalyzerConfig) {
    // Create FieldAnalyzer instance with the same config
    const fieldAnalyzerConfig: FieldAnalyzerConfig = {
      services: config.services,
      schema: config.schema || {} as DirectusSchema,
      database: config.database,
      accountability: config.accountability
    };
    
    this.fieldAnalyzer = new FieldAnalyzer(fieldAnalyzerConfig);
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
    // Delegate to FieldAnalyzer
    return this.fieldAnalyzer.analyzeTranslations(collection, options);
  }

  /**
   * Check if a collection has any form of translations
   * @param collection The collection to check
   * @returns true if translations exist
   */
  async hasTranslations(collection: string): Promise<boolean> {
    // Delegate to FieldAnalyzer
    return this.fieldAnalyzer.hasTranslations(collection);
  }

  /**
   * Get translatable fields from a collection
   * @param collection The collection to analyze
   * @returns Array of translatable fields
   */
  async getTranslatableFields(collection: string): Promise<TranslationField[]> {
    // Delegate to FieldAnalyzer
    return this.fieldAnalyzer.getTranslatableFields(collection);
  }

  /**
   * Get available languages from Directus
   * @returns Array of available languages
   */
  async getAvailableLanguages(): Promise<Language[]> {
    // Delegate to FieldAnalyzer
    return this.fieldAnalyzer.getAvailableLanguages();
  }
}