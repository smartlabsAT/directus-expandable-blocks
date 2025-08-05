import type { Ref, ComputedRef } from 'vue';
import type { 
  JunctionRecord, 
  UseExpandableBlocksProps, 
  ExpandableBlocksOptions,
  DirectusFormValues,
  M2AFieldInfo
} from '.';
import type { M2AHelper } from '../utils/m2a-helper';

/**
 * Shared state context for all composables
 */
export interface BlockStateContext {
  items: Ref<JunctionRecord[]>;
  expandedItems: Ref<string[]>;
  loading: Ref<Record<string | number, boolean>>;
  blockOriginalStates: Ref<Map<string, any>>;
  blockDirtyStates: Ref<Map<string, boolean>>;
  originalItemOrder: Ref<(string | number)[]>;
  isInternalUpdate: Ref<boolean>;
  isInitialLoad: Ref<boolean>;
  isFullyInitialized: Ref<boolean>;
  deletedItemsCount: ComputedRef<number>;
}

/**
 * State management functions
 */
export interface BlockStateFunctions {
  getItemId: (item: JunctionRecord) => string;
  isNewItem: (item: JunctionRecord) => boolean;
  prepareItemsForEmit: (items: JunctionRecord[], sortField?: string, canUpdateItemFn?: (item: JunctionRecord) => boolean) => any[];
  updateOriginalState: (blockId: string, state: any) => void;
  markBlockDirty: (blockId: string, isDirty: boolean) => void;
  removeBlockState: (blockId: string) => void;
  isBlockDirty: (blockId: string, currentData: any) => boolean;
  resetBlockState: (blockId: string) => void;
}

/**
 * External dependencies (API, stores, etc.)
 */
export interface BlockDependencies {
  api: any;
  emit: (event: 'input', value: any[]) => void;
  props: UseExpandableBlocksProps;
  stores: {
    notificationsStore: any;
    fieldsStore: any;
    relationsStore: any;
    collectionsStore: any;
  };
  helpers: {
    m2aHelper: M2AHelper;
    deepEqual: (a: any, b: any) => boolean;
  };
}

/**
 * UI-related state and refs
 */
export interface BlockUIContext {
  deleteDialog: Ref<boolean>;
  itemToDelete: Ref<{ item: JunctionRecord; index: number } | null>;
  mergedOptions: ComputedRef<ExpandableBlocksOptions>;
  canAddMoreBlocks: ComputedRef<boolean>;
  availableStatuses: Array<{ value: string; label: string }>;
}

/**
 * Data and relationship context
 */
export interface BlockDataContext {
  relationInfo: Ref<any>;
  allowedCollections: Ref<any[]>;
  allowedCollectionsForExisting: Ref<any[]>;
  m2aStructure: Ref<M2AFieldInfo | null>;
  values: Ref<DirectusFormValues>;
  initialValues: Ref<DirectusFormValues>;
}

/**
 * Permission-related functions
 */
export interface PermissionFunctions {
  canUpdateItem: (item: JunctionRecord) => boolean;
  canReadItem: (item: JunctionRecord) => boolean;
  canDeleteItem: (item: JunctionRecord) => boolean;
}

/**
 * Complete context object passed to all composables
 */
export interface ExpandableBlocksContext {
  state: BlockStateContext;
  stateFns: BlockStateFunctions;
  deps: BlockDependencies;
  ui: BlockUIContext;
  data: BlockDataContext;
  permissions?: PermissionFunctions;
}