/**
 * Relation and M2A structure types for the expandable-blocks extension
 */

export interface RelationInfo {
  collection: string;
  field: string;
  related_collection?: string | null;
  meta?: {
    one_allowed_collections?: string[] | string | null;
    junction_field?: string;
    sort_field?: string;
    [key: string]: any;
  };
  junctionCollection?: string;
  foreignKeyField?: string;
  sort_field?: string;
}

export interface M2AFieldInfo {
  field: string;
  collection: string;
  junctionCollection: string;
  junctionField: string;
  foreignKeyField: string;
  sortField?: string;
  allowedCollections: string[];
  hasNestedM2A?: boolean;
  nestedM2AFields?: Record<string, M2AFieldInfo>;
}

export interface M2AStructure {
  junctionCollection: string;
  foreignKeyField: string;
  junctionField: string;
  sortField?: string;
}