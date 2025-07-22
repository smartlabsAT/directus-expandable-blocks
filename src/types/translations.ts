/**
 * Types for handling translations in the expandable blocks extension
 */

/**
 * Information about translation configuration for a collection
 */
export interface TranslationInfo {
  hasTranslations: boolean;
  translationType: 'combined' | 'table' | 'none';
  translationTable?: string;
  linkField?: string;
  languageField?: string;
  translationFields: TranslationField[];
  isCombinedTranslation?: boolean;
  message?: string;
}

/**
 * Represents a translatable field
 */
export interface TranslationField {
  field: string;
  type: string;
  name: string;
  translatable: boolean;
  translationMethod?: 'combined' | 'table';
  isContentField?: boolean;
  coversFields?: string[];
}

/**
 * Field definition with translation support
 */
export interface FieldWithTranslation {
  field: string;
  name?: string;
  type: string;
  interface?: string;
  translatable?: boolean;
  translation_type?: 'combined' | 'table' | 'none';
  display_priority?: number;
  required?: boolean;
  readonly?: boolean;
  hidden?: boolean;
}

/**
 * Translation entry structure
 */
export interface TranslationEntry {
  id: number | string;
  languages_code: string;
  [key: string]: any; // Dynamic fields based on collection
}

/**
 * Item with translations
 */
export interface ItemWithTranslations {
  id: number | string;
  translations?: TranslationEntry[];
  [key: string]: any;
}

/**
 * Language option for selector
 */
export interface LanguageOption {
  code: string;
  name: string;
  icon?: string;
}

/**
 * Collection metadata with translation info
 */
export interface CollectionMetadata {
  collection: string;
  searchableFields: FieldWithTranslation[];
  translationInfo?: TranslationInfo;
  possibleLocations?: any[];
  cached_at?: string;
}