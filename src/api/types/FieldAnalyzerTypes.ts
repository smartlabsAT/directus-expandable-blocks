import { Knex } from 'knex';
import type { DirectusServices, DirectusSchema, DirectusAccountability } from './directus-api';

/**
 * Configuration for FieldAnalyzer service
 */
export interface FieldAnalyzerConfig {
  /** Directus services object containing FieldsService */
  services: DirectusServices;
  
  /** Directus schema object */
  schema: DirectusSchema;
  
  /** Optional database connection (for future use) */
  database?: Knex;
  
  /** Optional accountability for permissions */
  accountability?: DirectusAccountability;
}

/**
 * Represents a searchable field in a collection
 */
export interface SearchableField {
  /** The field name/key */
  field: string;
  
  /** Display name (from meta or field name) */
  name: string;
  
  /** Field data type (string, integer, text, etc.) */
  type: string;
  
  /** Interface type (input, textarea, etc.) */
  interface?: string;
  
  /** Field note/description */
  note?: string;
  
  /** Display priority for UI ordering */
  display_priority?: number;
  
  /** Whether field is required */
  required?: boolean;
  
  /** Whether field is readonly */
  readonly?: boolean;
  
  /** Whether field is hidden */
  hidden?: boolean;
  
  /** Field options (for select, radio, etc.) */
  options?: any;
  
  /** Field conditions */
  conditions?: any;
  
  /** Field validation rules */
  validation?: any;
  
  /** Default value */
  default_value?: any;
  
  /** Field width in form */
  width?: 'half' | 'half-left' | 'half-right' | 'full' | 'fill';
  
  /** Special field flags */
  special?: string[];
  
  /** Translations for field */
  translations?: any;
  
  /** Display options */
  display_options?: any;
  
  /** Complete meta object for advanced use */
  meta?: any;
  
  /** Complete schema object for advanced use */
  schema?: any;
  
  /** Whether this field is translatable */
  translatable?: boolean;
  
  /** Translation type: 'table' | 'json' | 'combined' | 'none' */
  translation_type?: 'table' | 'json' | 'combined' | 'none';
  
  /** Available languages for this field */
  available_languages?: string[];
  
  /** Related translation table */
  translation_table?: string;
  
  /** Field in translation table that links back */
  translation_key_field?: string;
  
  /** Actual fields available in the translation table */
  translation_fields?: string[];
}

/**
 * Options for field analysis
 */
export interface FieldAnalyzerOptions {
  /** Include system fields (default: false) */
  includeSystem?: boolean;
  
  /** Include readonly fields (default: true) */
  includeReadonly?: boolean;
  
  /** Include hidden fields (default: false) */
  includeHidden?: boolean;
  
  /** Include alias/presentation fields (default: false) */
  includeNonData?: boolean;
  
  /** Sort by display priority (default: true) */
  sortByPriority?: boolean;
  
  /** Only return fields of specific types */
  types?: string[];
  
  /** Only return fields with specific interfaces */
  interfaces?: string[];
  
  /** Include full metadata (default: true) */
  includeMetadata?: boolean;
  
  /** Include schema information (default: false) */
  includeSchema?: boolean;
  
  /** Include translation information (default: true) */
  includeTranslations?: boolean;
  
  /** Only return translatable fields */
  onlyTranslatable?: boolean;
  
  /** Preferred language for display names */
  language?: string;
}

/**
 * Raw field data from FieldsService
 */
export interface RawField {
  field: string;
  type: string;
  collection?: string;
  default_value?: any;
  meta?: {
    display?: string;
    name?: string;
    interface?: string;
    note?: string;
    required?: boolean;
    readonly?: boolean;
    hidden?: boolean;
    special?: string[];
    width?: 'half' | 'half-left' | 'half-right' | 'full' | 'fill';
    translations?: any;
    validation?: any;
    conditions?: any;
    options?: any;
    display_options?: any;
  };
  schema?: any;
}

/**
 * System fields that are typically excluded from search
 */
export const SYSTEM_FIELDS = [
  'id',
  'date_created',
  'date_updated', 
  'user_created',
  'user_updated',
  'sort',
  'status'
] as const;

/**
 * Non-data field types that don't store actual data
 */
export const NON_DATA_TYPES = [
  'alias',
  'presentation'
] as const;

/**
 * Field names that get higher display priority
 */
export const HIGH_PRIORITY_FIELDS = [
  'title',
  'name',
  'label',
  'headline',
  'display_name'
] as const;

/**
 * Field names that get medium display priority
 */
export const MEDIUM_PRIORITY_FIELDS = [
  'slug',
  'description',
  'subtitle',
  'summary',
  'excerpt'
] as const;

/**
 * Type guard to check if a field is a system field
 */
export function isSystemField(field: string): boolean {
  return SYSTEM_FIELDS.includes(field as any);
}

/**
 * Type guard to check if a type is a non-data type
 */
export function isNonDataType(type: string): boolean {
  return NON_DATA_TYPES.includes(type as any);
}

/**
 * Calculate display priority for a field
 */
export function calculateFieldPriority(field: string): number {
  if (HIGH_PRIORITY_FIELDS.includes(field as any)) {
    return 100;
  }
  if (MEDIUM_PRIORITY_FIELDS.includes(field as any)) {
    return 50;
  }
  return 0;
}

/**
 * Language information
 */
export interface Language {
  code: string;
  name: string;
  direction?: 'ltr' | 'rtl';
}

/**
 * Translation field mapping
 */
export interface TranslationFieldMap {
  /** Original field name */
  field: string;
  
  /** Corresponding field in translation table */
  translation_field: string;
  
  /** Whether this field exists in translation table */
  is_translated: boolean;
}

/**
 * Default options for field analysis
 */
export const DEFAULT_FIELD_OPTIONS: Required<FieldAnalyzerOptions> = {
  includeSystem: false,
  includeReadonly: true,
  includeHidden: false,
  includeNonData: false,
  sortByPriority: true,
  types: [],
  interfaces: [],
  includeMetadata: true,
  includeSchema: false,
  includeTranslations: true,
  onlyTranslatable: false,
  language: '' as string
};