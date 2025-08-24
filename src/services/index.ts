/**
 * Services exports
 */

export { DirectusApiClient, createApiClient } from './api-client';
export type {
  IDirectusApiClient,
  ApiClientConfig,
  SearchOptions,
  SearchResult,
  CollectionMetadata,
  FieldInfo,
  RelationInfo,
  PermissionResult,
  ApiError,
  TranslationInfo,
  M2ARelation,
  M2AFieldConfig
} from './api-client.types';