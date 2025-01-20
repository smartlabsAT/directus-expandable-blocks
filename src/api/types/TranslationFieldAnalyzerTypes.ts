import { Knex } from 'knex';

/**
 * Configuration for TranslationFieldAnalyzer service
 */
export interface TranslationFieldAnalyzerConfig {
  /** Database connection */
  database: Knex;
  
  /** Directus services object */
  services: any;
  
  /** Optional Directus schema */
  schema?: any;
  
  /** Optional accountability for permissions */
  accountability?: any;
  
  /** Assume combined translation pattern by default (default: true) */
  assumeCombinedPattern?: boolean;
}

/**
 * Complete translation information for a collection
 */
export interface TranslationInfo {
  /** Whether the collection has any form of translations */
  hasTranslations: boolean;
  
  /** Type of translation implementation */
  translationType: 'table' | 'json' | 'combined' | 'hybrid' | 'none';
  
  /** Name of the translation table (if applicable) */
  translationTable?: string;
  
  /** Field that links translation to main record */
  linkField?: string;
  
  /** Field that stores the language code */
  languageField?: string;
  
  /** Fields available in the translation table */
  translationFields?: TranslationField[];
  
  /** Available languages in the system */
  availableLanguages?: Language[];
  
  /** Mapping between main fields and translation fields */
  fieldMapping?: TranslationFieldMapping[];
  
  /** Indicates if this is a combined translation (multiple fields → one translation field) */
  isCombinedTranslation?: boolean;
  
  /** Message explaining the translation pattern */
  message?: string;
}

/**
 * Represents a field that can be translated
 */
export interface TranslationField {
  /** Field name */
  field: string;
  
  /** Field type */
  type: string;
  
  /** Display name */
  name?: string;
  
  /** Whether this field is translatable */
  translatable: boolean;
  
  /** How this field is translated */
  translationMethod?: 'table' | 'json' | 'combined';
  
  /** Corresponding fields in translation table */
  translationTableFields?: string[];
  
  /** Languages this field is translated to (for JSON) */
  availableLanguages?: string[];
  
  /** For combined translations: indicates this is a content field */
  isContentField?: boolean;
  
  /** For combined translations: source fields this translation covers */
  coversFields?: string[];
}

/**
 * Mapping between main collection field and translation
 */
export interface TranslationFieldMapping {
  /** Field in main collection */
  sourceField: string;
  
  /** Field in translation table */
  translationField: string;
  
  /** Whether they match by name */
  isDirectMatch: boolean;
  
  /** Confidence score for the mapping (0-1) */
  confidence: number;
}

/**
 * Language information
 */
export interface Language {
  /** Language code (e.g., 'en-US') */
  code: string;
  
  /** Language name */
  name: string;
  
  /** Text direction */
  direction?: 'ltr' | 'rtl';
}

/**
 * Options for translation analysis
 */
export interface TranslationAnalysisOptions {
  /** Include field mapping analysis */
  includeFieldMapping?: boolean;
  
  /** Include available languages */
  includeLanguages?: boolean;
  
  /** Detect hybrid translation setups */
  detectHybrid?: boolean;
  
  /** Custom translation table pattern (default: *_translations) */
  translationTablePattern?: string;
  
  /** Fields to exclude from analysis */
  excludeFields?: string[];
}

/**
 * Translation pattern detection result
 */
export interface TranslationPattern {
  /** Detected pattern type */
  type: 'standard' | 'custom' | 'json' | 'combined' | 'hybrid';
  
  /** Confidence in the detection (0-1) */
  confidence: number;
  
  /** Details about the pattern */
  details: {
    tableName?: string;
    jsonFields?: string[];
    linkPattern?: string;
    languagePattern?: string;
    isCombined?: boolean;
  };
}

/**
 * Translation coverage information
 */
export interface TranslationCoverage {
  /** Total translatable fields */
  totalFields: number;
  
  /** Fields with translations */
  translatedFields: number;
  
  /** Coverage percentage */
  coveragePercent: number;
  
  /** Missing translations by field */
  missingTranslations: {
    field: string;
    languages: string[];
  }[];
}

/**
 * Common translation table patterns
 */
export const TRANSLATION_TABLE_PATTERNS = [
  '{collection}_translations',
  '{collection}_trans',
  '{collection}_i18n',
  'translations_{collection}'
] as const;

/**
 * Common language field names
 */
export const LANGUAGE_FIELD_NAMES = [
  'languages_code',
  'language_code',
  'language',
  'locale',
  'lang',
  'language_id'
] as const;

/**
 * Common link field patterns
 */
export const LINK_FIELD_PATTERNS = [
  '{collection}_id',
  'parent_id',
  'item_id',
  '{singular}_id'
] as const;

/**
 * Fields to exclude from translation analysis
 */
export const EXCLUDED_TRANSLATION_FIELDS = [
  'id',
  'sort',
  'date_created',
  'date_updated',
  'user_created',
  'user_updated'
] as const;