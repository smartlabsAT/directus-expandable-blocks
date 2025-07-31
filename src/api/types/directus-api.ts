/**
 * Directus API-specific type definitions
 * These types define the shape of Directus services and objects when used in API extensions
 */

/**
 * Logger interface matching Directus' Pino logger
 */
export interface Logger {
  info(message: string, data?: any): void;
  warn(message: string, data?: any): void;
  error(message: string, error?: any, data?: any): void;
  debug(message: string, data?: any): void;
  trace(message: string, data?: any): void;
  fatal(message: string, data?: any): void;
}

/**
 * Directus Services available in API extensions
 */
export interface DirectusServices {
  ItemsService: new (collection: string, options: ServiceOptions) => any;
  FieldsService: new (options: ServiceOptions) => any;
  RelationsService: new (options: ServiceOptions) => any;
  CollectionsService: new (options: ServiceOptions) => any;
  PermissionsService: new (options: ServiceOptions) => any;
  logger: Logger;
}

/**
 * Service options for Directus services
 */
export interface ServiceOptions {
  knex?: any; // Knex instance
  schema?: DirectusSchema;
  accountability?: DirectusAccountability;
}

/**
 * Directus Schema structure
 */
export interface DirectusSchema {
  collections: Record<string, SchemaCollection>;
  relations: SchemaRelation[];
}

/**
 * Schema collection definition
 */
export interface SchemaCollection {
  collection: string;
  primary: string;
  singleton: boolean;
  sortField?: string | null;
  note?: string | null;
  accountability?: 'all' | 'activity' | null;
  fields?: Record<string, any>;
}

/**
 * Schema relation definition
 */
export interface SchemaRelation {
  collection: string;
  field: string;
  related_collection: string | null;
  schema?: any;
  meta?: any;
}

/**
 * Directus Accountability context
 */
export interface DirectusAccountability {
  user?: string | null;
  role?: string | null;
  admin?: boolean;
  app?: boolean;
  permissions?: DirectusPermission[];
  ip?: string;
  userAgent?: string;
}

/**
 * Directus Permission
 */
export interface DirectusPermission {
  id?: number;
  role?: string | null;
  collection: string;
  action: 'create' | 'read' | 'update' | 'delete' | 'share';
  permissions?: any;
  validation?: any;
  presets?: any;
  fields?: string[] | null;
}

/**
 * Field definition as returned by FieldsService
 */