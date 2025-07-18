import type { Ref } from 'vue';
import type { 
  Field as DirectusField,
  FieldMeta,
  Collection as DirectusCollection,
  CollectionMeta,
  Relation as DirectusRelation,
  RelationMeta,
  Item,
  PrimaryKey
} from '@directus/types';

// Re-export commonly used Directus types
export type { DirectusField, FieldMeta, DirectusCollection, CollectionMeta, DirectusRelation, RelationMeta, Item, PrimaryKey };

/**
 * Extension-specific types for Directus form integration
 * These types are not available in @directus/types as they are specific to our extension implementation
 */

// Directus form injection types
export interface DirectusFormValues {
  [key: string]: any;
}

export interface DirectusFormContext {
  values: Ref<DirectusFormValues>;
  initialValues: Ref<DirectusFormValues>;
}

/**
 * Custom notification type for our extension
 * The official Directus Notification type has a different structure (includes id, timestamp, recipient, etc.)
 * We use this simplified version for UI notifications within the extension
 */
export interface DirectusNotification {
  title: string;
  text?: string;
  type?: 'info' | 'success' | 'warning' | 'error';
}

/**
 * Store interfaces for Directus extension development
 * These interfaces define the shape of Directus stores when used within extensions
 * They are not available in @directus/types and are based on the actual runtime behavior
 */

// Store interfaces
export interface DirectusFieldsStore {
  getFieldsForCollection: (collection: string) => DirectusField[];
  getField: (collection: string, field: string) => DirectusField | null;
}

export interface DirectusRelationsStore {
  getRelationsForField: (collection: string, field: string) => DirectusRelation[];
}

export interface DirectusCollectionsStore {
  getCollection: (collection: string) => DirectusCollection | null;
}

export interface DirectusNotificationsStore {
  add: (notification: DirectusNotification) => void;
}

export interface DirectusStores {
  useFieldsStore: () => DirectusFieldsStore;
  useRelationsStore: () => DirectusRelationsStore;
  useCollectionsStore: () => DirectusCollectionsStore;
  useNotificationsStore: () => DirectusNotificationsStore;
}