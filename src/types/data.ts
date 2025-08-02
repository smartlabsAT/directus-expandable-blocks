/**
 * Data structure types for the expandable-blocks extension
 */

export interface JunctionRecord {
  id: string | number;
  collection: string;
  item: string | number | ItemRecord;
  sort?: number;
  [foreignKey: string]: any;
}

export interface ItemRecord {
  id: string | number;
  title?: string;
  name?: string;
  headline?: string;
  label?: string;
  heading?: string;
  status?: 'published' | 'draft' | 'archived';
  [key: string]: any;
}

export interface CollectionInfo {
  collection: string;
  name: string;
  meta?: {
    icon?: string;
    [key: string]: any;
  };
}