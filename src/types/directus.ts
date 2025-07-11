import type { Ref } from 'vue';

// Directus form injection types
export interface DirectusFormValues {
  [key: string]: any;
}

export interface DirectusFormContext {
  values: Ref<DirectusFormValues>;
  initialValues: Ref<DirectusFormValues>;
}

// Store types
export interface DirectusField {
  field: string;
  collection: string;
  type?: string;
  meta?: {
    interface?: string;
    hidden?: boolean;
    readonly?: boolean;
    options?: any;
    icon?: string;
  };
}

export interface DirectusCollection {
  collection: string;
  name?: string;
  meta?: {
    icon?: string;
    display_template?: string;
    [key: string]: any;
  };
}

export interface DirectusRelation {
  collection: string;
  field: string;
  related_collection?: string | null;
  meta?: {
    junction_field?: string;
    one_allowed_collections?: string[] | null;
    sort_field?: string;
    [key: string]: any;
  };
  one_allowed_collections?: string[] | null;
  sort_field?: string;
  junctionCollection?: string;
  foreignKeyField?: string;
}

export interface DirectusNotification {
  title: string;
  text?: string;
  type?: 'info' | 'success' | 'warning' | 'error';
}

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