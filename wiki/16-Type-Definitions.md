# Type Definitions

This page provides a comprehensive reference for all TypeScript types and interfaces used in the Expandable Blocks extension.

## 📋 Core Interfaces

### Component Props

```typescript
// Main component props
interface UseExpandableBlocksProps {
  value: JunctionRecord[] | null
  collection: string
  field: string
  primaryKey?: string | number
  disabled?: boolean
  options?: ExpandableBlocksOptions
}
```

### Data Structures

```typescript
// Junction record structure
interface JunctionRecord {
  id: string | number
  collection: string
  item: string | number | ItemRecord
  sort?: number
  [foreignKey: string]: any // Additional foreign keys
}

// Item data structure
interface ItemRecord {
  id: string | number
  [field: string]: any // Dynamic fields based on collection
}

// M2A field metadata
interface M2AFieldInfo {
  collection: string
  field: string
  itemField: string
  junctionCollection: string
  junctionPrimaryKey: string
}
```

## 🔗 Relation Types

```typescript
// Relation metadata from Directus
interface RelationInfo {
  collection: string
  field: string
  related_collection: string | null
  meta?: {
    sort_field?: string
    one_allowed_collections?: string[]
    one_field?: string
    junction_field?: string
  }
}

// Collection metadata
interface CollectionInfo {
  collection: string
  name: string
  icon: string
  meta?: {
    display_template?: string
    singleton?: boolean
  }
}

// Field metadata
interface Field {
  field: string
  name?: string
  type: string
  meta?: {
    interface?: string
    display?: string
    hidden?: boolean
    readonly?: boolean
    required?: boolean
    options?: any
  }
  schema?: {
    is_nullable?: boolean
    default_value?: any
  }
}
```

## ⚙️ Configuration Types

```typescript
// Component options
interface ExpandableBlocksOptions {
  // Display Options
  enableSorting?: boolean         // Enable drag-and-drop reordering
  startExpanded?: boolean         // Auto-expand blocks on load
  accordionMode?: boolean         // Only one block expanded at a time
  compactMode?: boolean           // Condensed view
  showItemId?: boolean            // Show database IDs
  
  // Permission Options
  isAllowedDelete?: boolean       // Allow block deletion
  isAllowedDuplicate?: boolean    // Allow block duplication
  maxBlocks?: number | null       // Maximum number of blocks
  
  // Advanced Options
  showFieldsFilter?: string[]     // Whitelist specific fields
  allowedCollections?: string[]   // Override allowed collections
}

// Permission options extracted
interface PermissionOptions {
  isAllowedDelete?: boolean
  isAllowedDuplicate?: boolean
  maxBlocks?: number | null
}
```

## 🏪 Store Types

```typescript
// Directus store types
interface DirectusFormValues {
  [field: string]: any
}

interface DirectusFieldsStore {
  getFieldsForCollection(collection: string): Field[]
  getField(collection: string, field: string): Field | null
}

interface DirectusRelationsStore {
  getRelation(collection: string, field: string): RelationInfo | null
  getRelationsForCollection(collection: string): RelationInfo[]
}

interface DirectusCollectionsStore {
  getCollection(name: string): CollectionInfo | null
  collections: CollectionInfo[]
}

interface DirectusNotificationsStore {
  add(notification: NotificationOptions): void
}

interface NotificationOptions {
  title: string
  text?: string
  type?: 'error' | 'warning' | 'success' | 'info'
  dialog?: boolean
  persist?: boolean
}
```

## 📊 State Management Types

```typescript
// Component state structure
interface ComponentState {
  // Core data
  items: Ref<JunctionRecord[]>
  expandedItems: Ref<string[]>
  loading: Ref<Record<string, boolean>>
  
  // Tracking
  blockOriginalStates: Ref<Map<string, any>>
  originalItemOrder: Ref<(string | number)[]>
  lastEmittedValue: Ref<any[]>
  
  // Flags
  isInitialLoad: Ref<boolean>
  isInternalUpdate: Ref<boolean>
  isFullyInitialized: Ref<boolean>
  
  // Metadata
  relationInfo: Ref<RelationInfo | null>
  m2aStructure: Ref<M2AFieldInfo | null>
  allowedCollections: Ref<CollectionInfo[]>
}

// Loading states
interface LoadingStates {
  [itemId: string]: boolean
}

// Emit types
type EmitValue = (JunctionRecord | string | number)[]
type EmitFunction = (event: 'input', value: EmitValue) => void
```

## 🛠️ Utility Types

```typescript
// API response types
interface APIResponse<T = any> {
  data: T
  meta?: {
    total?: number
    filter_count?: number
  }
}

// Sort event data
interface SortEvent {
  oldIndex: number
  newIndex: number
  item: HTMLElement
  clone: HTMLElement
  from: HTMLElement
  to: HTMLElement
}

// Display template context
interface DisplayTemplateContext {
  collection: string
  item: any
  template?: string
}

// Status types
type StatusValue = 'published' | 'draft' | 'archived' | string

// Block action types
type BlockAction = 'duplicate' | 'delete' | 'discard' | 'edit'
```

## 🎯 Function Signatures

```typescript
// Helper function types
type GetBlockTitle = (item: JunctionRecord) => string
type IsBlockDirty = (blockId: string | number) => boolean
type GetCollectionIcon = (item: JunctionRecord) => string
type PrepareItemsForEmit = (items: JunctionRecord[]) => EmitValue

// Event handlers
type ExpandBlock = (blockId: string | number) => Promise<void>
type CollapseBlock = (blockId: string | number) => void
type DuplicateBlock = (item: JunctionRecord) => void
type DeleteBlock = (item: JunctionRecord) => Promise<void>
type UpdateBlockValue = (blockId: string | number, updates: any) => void

// Composable return type
interface UseExpandableBlocksReturn {
  // State
  items: Ref<JunctionRecord[]>
  expandedItems: Ref<string[]>
  loading: Ref<LoadingStates>
  
  // Methods
  expandBlock: ExpandBlock
  collapseBlock: CollapseBlock
  toggleBlock: (blockId: string | number) => void
  duplicateBlock: DuplicateBlock
  deleteBlock: DeleteBlock
  updateBlockValue: UpdateBlockValue
  
  // Computed
  isBlockDirty: ComputedRef<(blockId: string | number) => boolean>
  hasUnsavedChanges: ComputedRef<boolean>
  sortedItems: ComputedRef<JunctionRecord[]>
  
  // Utils
  getBlockTitle: GetBlockTitle
  getCollectionIcon: GetCollectionIcon
  prepareItemsForEmit: PrepareItemsForEmit
}
```

## 🔧 Extension Registration Types

```typescript
// Extension definition
interface InterfaceDefinition {
  id: string
  name: string
  description: string
  icon: string
  component: Component
  types: string[]
  localTypes?: string[]
  group?: string
  options: InterfaceOption[] | ComponentOptions
  preview?: Component
}

// Interface option
interface InterfaceOption {
  field: string
  name: string
  type: string
  meta: FieldMeta
  schema?: FieldSchema
}

// Field meta
interface FieldMeta {
  interface: string
  options?: any
  width?: 'half' | 'full'
  note?: string
  conditions?: Condition[]
}

// Field schema
interface FieldSchema {
  default_value?: any
  is_nullable?: boolean
}

// Condition type
interface Condition {
  rule: {
    [field: string]: {
      _eq?: any
      _neq?: any
      _in?: any[]
      _nin?: any[]
    }
  }
  hidden?: boolean
  readonly?: boolean
  required?: boolean
}
```

## 🎨 UI Types

```typescript
// Menu item
interface MenuItem {
  text: string
  icon: string
  disabled?: boolean
  onClick: () => void | Promise<void>
}

// Chip props
interface ChipProps {
  active?: boolean
  close?: boolean
  outlined?: boolean
  label?: boolean
  disabled?: boolean
  xSmall?: boolean
  small?: boolean
  large?: boolean
  xLarge?: boolean
}

// Button props
interface ButtonProps {
  icon?: boolean
  outlined?: boolean
  rounded?: boolean
  loading?: boolean
  disabled?: boolean
  secondary?: boolean
  warning?: boolean
  danger?: boolean
  kind?: string
  to?: string
  href?: string
  target?: string
  rel?: string
  download?: string | boolean
  value?: string | number
  align?: 'left' | 'center' | 'right'
  tooltip?: string
  fullWidth?: boolean
}
```

## 📝 Type Guards

```typescript
// Type guard functions
const isJunctionRecord = (value: any): value is JunctionRecord => {
  return value && 
    typeof value === 'object' && 
    'id' in value && 
    'collection' in value && 
    'item' in value;
};

const isItemRecord = (value: any): value is ItemRecord => {
  return value && 
    typeof value === 'object' && 
    'id' in value && 
    !('collection' in value);
};

const hasStatusField = (item: any): boolean => {
  return item && 
    typeof item === 'object' && 
    'status' in item;
};

const isValidCollection = (collection: string): boolean => {
  return typeof collection === 'string' && 
    collection.length > 0 && 
    !collection.includes('/');
};
```

## 🚀 Generic Types

```typescript
// Utility generics
type DeepPartial<T> = {
  [P in keyof T]?: T[P] extends object ? DeepPartial<T[P]> : T[P];
};

type RequiredKeys<T> = {
  [K in keyof T]-?: {} extends Pick<T, K> ? never : K
}[keyof T];

type OptionalKeys<T> = {
  [K in keyof T]-?: {} extends Pick<T, K> ? K : never
}[keyof T];

// Vue specific
type UnwrapRef<T> = T extends Ref<infer R> ? R : T;
type MaybeRef<T> = T | Ref<T>;
```