# Data Flow & State Management

Understanding how data flows through the Expandable Blocks extension is crucial for development and debugging.

## 🧩 The M2A Challenge

### Problem Statement

Directus stores M2A relationships differently than it displays them:

**Storage Format**: Array of junction IDs
```javascript
[57, 58, 59]
```

**Display Format**: Array of objects with full data
```javascript
[
  { id: 57, collection: "content_text", item: { id: 1, title: "..." } },
  { id: 58, collection: "content_image", item: { id: 2, url: "..." } }
]
```

This mismatch causes issues with dirty state detection - Directus compares the stored IDs with the displayed objects, always seeing them as different.

### Solution: Selective Emitting with Order Preservation

The extension implements a sophisticated dirty tracking system:

```typescript
// Store original state when blocks load
const blockOriginalStates = ref<Map<string, any>>(new Map());

// Store original order for accurate comparison
const originalItemOrder = ref<(string | number)[]>([]);

// Check if individual block has changes
function isBlockDirty(blockId: string, currentItemData: any): boolean {
  const originalData = blockOriginalStates.value.get(blockId);
  if (!originalData) return true; // New blocks are always dirty
  return JSON.stringify(currentItemData) !== JSON.stringify(originalData);
}

// Emit IDs for clean blocks, full objects for dirty blocks
function prepareItemsForEmit(itemsArray: JunctionRecord[]): any[] {
  const result = itemsArray.map(item => {
    const blockId = item.id?.toString();
    const isDirty = isBlockDirty(blockId, item.item);
    return isDirty ? item : item.id;
  });
  
  // If all blocks are clean, preserve original order
  const dirtyCount = result.filter(item => typeof item === 'object').length;
  if (dirtyCount === 0 && originalItemOrder.value.length > 0) {
    const itemMap = new Map(itemsArray.map(item => [item.id, item]));
    return originalItemOrder.value.filter(id => itemMap.has(id));
  }
  
  return result;
}
```

## 🌊 Component Lifecycle

### Overview

```
1. Mount Phase → 2. Data Arrival → 3. User Interaction → 4. Save Phase → (repeat)
```

### 🔄 Detailed Sequence Diagrams

#### 1️⃣ Initial Load Sequence

```mermaid
sequenceDiagram
    participant C as Component
    participant S as Stores
    participant H as M2A Helper
    participant P as Props
    
    Note over C: Component Mounts
    C->>C: onMounted(): void
    C->>S: useFieldsStore()<br/>useRelationsStore()<br/>useCollectionsStore()
    S-->>C: Store instances
    C->>C: initialize(): Promise<void>
    
    rect rgb(200, 230, 255)
        Note over C,S: Load Metadata Phase
        C->>S: getRelation(collection: string, field: string): RelationInfo | null
        S-->>C: RelationInfo | null
        
        C->>H: extractM2AStructure(collection: string, field: string, relationInfo: RelationInfo): M2AFieldInfo
        H-->>C: M2AFieldInfo
        
        C->>C: parseAllowedCollections(collections?: string[]): string[]
        C->>S: getCollection(name: string): CollectionInfo | null
        S-->>C: CollectionInfo[]
    end
    
    C->>C: checkDelayedOptions(): void
    
    Note over C: Waiting for props.value...
    
    rect rgb(255, 230, 200)
        Note over P,C: Data Loading Phase
        P->>C: props.value: JunctionRecord[] | null
        C->>C: watch triggered
        C->>C: processLoadedRecords(records: JunctionRecord[]): Promise<void>
        
        Note over C: Process Records
        C->>C: deepClone(records: any): any
        C->>C: sortByField(items: JunctionRecord[], field: string): void
        C->>C: setItems(clonedRecords: JunctionRecord[]): void
        
        Note over C: Store Original States
        C->>C: blockOriginalStates.clear(): void
        C->>C: blockOriginalStates.set(id: string, data: any): void
        C->>C: getItemId(item: JunctionRecord): string
        C->>C: setOriginalItemOrder(ids: string[]): void
        C->>C: setFullyInitialized(true): void
    end
```

### 1️⃣ Mount Phase

When the component initializes:

1. **Store Initialization**
   - `useFieldsStore()` - Field metadata
   - `useRelationsStore()` - Relationship info
   - `useCollectionsStore()` - Collection details

2. **Metadata Loading**
   - Extract M2A structure
   - Parse allowed collections
   - Load collection icons and names

3. **Wait for Data**
   - Component ready but no blocks shown
   - Waiting for props.value to populate

### 2️⃣ Data Arrival Phase

When Directus provides data:

1. **Props Watcher Triggered**
   ```typescript
   watch(() => props.value, async (newValue) => {
     if (newValue && Array.isArray(newValue)) {
       await processLoadedRecords(newValue);
     }
   });
   ```

2. **Process Records**
   - Deep clone to avoid mutations
   - Sort by sort field
   - Store original states
   - Track original order

3. **UI Ready**
   - Blocks displayed
   - Ready for interaction

### 3️⃣ Interaction Phase

User interactions and state tracking:

#### User Edit Sequence

```mermaid
sequenceDiagram
    participant U as User
    participant UI as Block UI
    participant C as Component
    participant D as Dirty Detection
    participant P as Parent Form
    
    U->>UI: Edit Block Content
    
    rect rgb(200, 255, 200)
        Note over UI,C: Field Update
        UI->>C: updateItemField(blockId: string, field: string, value: any): void
        
        C->>C: findItemById(blockId: string): JunctionRecord | undefined
        C->>C: setNestedField(item: JunctionRecord, field: string, value: any): void
        C->>C: triggerReactivity(): void
    end
    
    rect rgb(255, 255, 200)
        Note over C,D: Dirty Detection
        C->>D: isBlockDirty(blockId: string, currentItemData: any): boolean
        
        D->>D: getOriginalData(blockId: string): any | undefined
        D->>D: compareContent(current: any, original: any): boolean
        D->>D: getItemIndex(blockId: string): number
        D->>D: getOriginalIndex(blockId: string): number
        D->>D: hasPositionChanged(currentIdx: number, originalIdx: number): boolean
        
        D-->>C: boolean (dirty status)
    end
    
    rect rgb(255, 200, 200)
        Note over C,P: Emit Changes
        C->>UI: showDirtyIndicator(blockId: string): void
        C->>C: emitValue(): void
        
        Note over C: Build output array
        C->>C: prepareItemsForEmit(items: JunctionRecord[]): EmitValue[]
        C->>C: getItemId(item: JunctionRecord): string
        C->>C: isBlockDirty(id: string, data: any): boolean
        C->>C: addSortValue(item: JunctionRecord, index: number): JunctionRecord
        
        C->>P: emit('input', value: EmitValue[]): void
        P->>P: detectChanges(): void
        P->>P: enableSaveButton(): void
    end
```

#### Drag & Drop Sequence

```mermaid
sequenceDiagram
    participant U as User
    participant V as VueDraggable
    participant C as Component
    participant D as Dirty Detection
    participant P as Parent Form
    
    U->>V: Drag Block to new position
    
    rect rgb(200, 200, 255)
        Note over V,C: VueDraggable Update
        V->>V: performDOMAnimation(): void
        V->>C: handleDragUpdate(newItems: JunctionRecord[]): void
        
        C->>C: setItems(newItems: JunctionRecord[]): void
        C->>C: triggerReactivity(): void
    end
    
    rect rgb(255, 255, 200)
        Note over C,D: Position Change Detection
        C->>D: checkAllBlocksPosition(): void
        
        loop Check Each Block
            D->>D: getItemId(item: JunctionRecord): string
            D->>D: findItemIndex(blockId: string): number
            D->>D: findOriginalIndex(blockId: string): number
            D->>D: comparePositions(current: number, original: number): boolean
            D->>D: isBlockDirty(blockId: string, itemData: any): boolean
            D-->>C: Map<string, boolean> (dirty states)
        end
    end
    
    rect rgb(255, 200, 200)
        Note over C,P: Emit Reordered Array
        C->>C: emitValue(): void
        
        Note over C: Build mixed array
        C->>C: mapItemsForEmit(items: JunctionRecord[]): EmitValue[]
        C->>C: getItemId(item: JunctionRecord): string
        C->>C: getItemData(item: JunctionRecord): any
        C->>C: isBlockDirty(id: string, data: any): boolean
        C->>C: createDirtyItem(item: JunctionRecord, index: number): JunctionRecord
        C->>C: getSortFieldName(): string | undefined
        
        C->>P: emit('input', value: EmitValue[]): void
        P->>P: detectOrderChange(): void
        P->>P: enableSaveButton(): void
    end
```

1. **User Actions**
   - Edit block content
   - Reorder blocks
   - Add/delete blocks
   - Duplicate blocks

2. **Dirty State Tracking**
   ```typescript
   // Content changes
   const contentDirty = blocks.some(block => 
     isBlockDirty(block.id, block.item)
   );
   
   // Order changes
   const orderDirty = !arraysEqual(
     currentOrder,
     originalOrder
   );
   
   // Overall dirty state
   const isDirty = contentDirty || orderDirty;
   ```

3. **Emit Changes**
   ```typescript
   emit('input', prepareItemsForEmit(blocks));
   ```

### 4️⃣ Save Phase

When parent form saves:

#### Save & Update Sequence

```mermaid
sequenceDiagram
    participant U as User
    participant P as Parent Form
    participant API as Directus API
    participant C as Component
    participant W as Props Watcher
    
    U->>P: Click Save Button
    
    rect rgb(200, 230, 255)
        Note over P,API: Save Process
        P->>API: updateItem(collection: string, id: string | number, data: object): Promise<any>
        
        Note over API: Process mixed array
        API->>API: processMixedArray(array: EmitValue[]): void
        API->>API: identifyChangedItems(element: EmitValue): boolean
        API->>API: updateJunctionRecord(record: JunctionRecord): Promise<void>
        API->>API: updateRelatedItem(item: ItemRecord): Promise<void>
        
        API-->>P: UpdatedRecord
        P->>P: setFormValues(values: DirectusFormValues): void
        P->>C: props.value = updatedJunctionRecords
    end
    
    rect rgb(255, 230, 200)
        Note over W,C: Save Detection Logic
        W->>W: watchPropsValue(newValue: JunctionRecord[]): void
        W->>W: checkInternalUpdate(): boolean
        
        Note over W: Check save detection
        W->>W: getWasJustActive(): boolean
        W->>W: getSaveButtonActive(): boolean
        W->>W: detectSaveCompletion(wasActive: boolean, isActive: boolean): boolean
        
        W->>C: processLoadedRecords(newValue: JunctionRecord[]): Promise<void>
    end
    
    rect rgb(200, 255, 200)
        Note over C: Update Component State
        C->>C: deepClone(records: any): any
        C->>C: sortRecordsByField(records: JunctionRecord[], field: string): JunctionRecord[]
        C->>C: setItems(cloned: JunctionRecord[]): void
        
        Note over C: Reset original states
        C->>C: clearOriginalStates(): void
        C->>C: storeOriginalState(id: string, data: any): void
        C->>C: extractItemData(record: JunctionRecord): any
        
        Note over C: Update original order (Save detected!)
        C->>C: updateOriginalItemOrder(items: JunctionRecord[]): void
        C->>C: clearAllDirtyIndicators(): void
    end
```

1. **Save Detection**
   ```typescript
   function detectSave(newRecords: JunctionRecord[]): boolean {
     // New IDs indicate successful save
     const hasNewIds = newRecords.some(record => 
       !blockOriginalStates.has(record.id)
     );
     
     // All blocks have integer IDs after save
     const allIntegerIds = newRecords.every(record =>
       typeof record.id === 'number'
     );
     
     return hasNewIds || allIntegerIds;
   }
   ```

2. **State Reset**
   - Update original states
   - Clear dirty flags
   - Update original order

3. **Continue Cycle**
   - Ready for new changes

### 5️⃣ Global Discard Sequence

```mermaid
sequenceDiagram
    participant U as User
    participant P as Parent Form
    participant C as Component
    participant VW as Values Watcher
    
    U->>P: Click "Discard All Changes"
    
    rect rgb(255, 200, 200)
        Note over P: Directus Form Reset
        P->>P: resetToInitialValues(): void
        P->>P: deepClone(initialValues: DirectusFormValues): DirectusFormValues
        P->>C: setFieldValue(field: string, value: any[]): void
        
        Note over P: Triggers values watcher
    end
    
    rect rgb(255, 255, 200)
        Note over VW,C: Discard Detection
        VW->>VW: watchFieldValue(field: string): void
        VW->>VW: getFieldValue(field: string): any[]
        VW->>VW: getLastEmittedValue(): any[]
        
        VW->>VW: deepEqual(a: any, b: any): boolean
        VW->>VW: checkIfSkipProcessing(newValue: any[], lastEmit: any[]): boolean
        
        Note over VW: Detect revert to IDs only
        VW->>VW: isAllIDs(array: any[]): boolean
        VW->>VW: isObject(value: any): boolean
        VW->>VW: matchesOriginalOrder(current: any[], original: any[]): boolean
        VW->>VW: detectDiscardAction(allIDs: boolean, matchesOriginal: boolean): boolean
    end
    
    rect rgb(200, 255, 200)
        Note over C: Restore Original State
        C->>C: createOrderedItemsArray(): JunctionRecord[]
        
        Note over C: Restore original order
        C->>C: getOriginalItemOrder(): (string | number)[]
        C->>C: findItemById(id: string | number): JunctionRecord | undefined
        C->>C: filterValidItems(items: (JunctionRecord | undefined)[]): JunctionRecord[]
        
        C->>C: setItems(orderedItems: JunctionRecord[]): void
        C->>C: clearAllDirtyIndicators(): void
        
        Note over C: UX Enhancement
        C->>C: preserveExpandedItems(): void
        C->>C: getExpandedItems(): string[]
        
        C->>C: emitValue(): void
    end
```

**UX Enhancement**: Unlike standard interfaces, expanded blocks remain open after discard operations.

## 💾 State Management Details

### Block States

Each block maintains several states:

```typescript
interface BlockState {
  // Identity
  id: string | number;
  tempId?: string;         // For new blocks
  
  // Data
  item: any;               // Actual content
  collection: string;      // Block type
  
  // Metadata
  sort?: number;           // Order position
  isExpanded: boolean;     // UI state
  isDirty: boolean;        // Change tracking
}
```

### Dirty State Categories

1. **New Blocks**
   - Temporary IDs (uuid)
   - Always considered dirty
   - Full object emitted

2. **Modified Blocks**
   - Content changed
   - Detected via deep comparison
   - Full object emitted

3. **Moved Blocks**
   - Position changed
   - Sort value updated
   - Full object emitted if moved

4. **Clean Blocks**
   - No changes
   - Only ID emitted
   - Reduces payload size

### Optimization Strategies

1. **Selective Emitting**
   ```typescript
   // Only send changed data
   const payload = blocks.map(block => 
     block.isDirty ? block : block.id
   );
   ```

2. **Debounced Updates**
   ```typescript
   const debouncedEmit = debounce(() => {
     emit('input', prepareItemsForEmit(blocks));
   }, 300);
   ```

3. **Efficient Comparisons**
   ```typescript
   // Fast string comparison for content
   const contentHash = JSON.stringify(block.item);
   const hasChanged = contentHash !== originalHash;
   ```

## 📊 Core State Variables

### State Variable Architecture

```mermaid
graph LR
    subgraph "UI State"
        A[items<br/>Current blocks array]
        B[expandedItems<br/>Expanded block IDs]
        C[loading<br/>Loading states]
    end
    
    subgraph "Tracking State"
        D[blockOriginalStates<br/>Map: ID → Original data]
        E[originalItemOrder<br/>Array of IDs in order]
        F[isInitialLoad<br/>First load flag]
    end
    
    subgraph "Control Flags"
        G[isInternalUpdate<br/>Prevent loops]
        H[isFullyInitialized<br/>Ready flag]
    end
    
    subgraph "Metadata"
        I[relationInfo<br/>M2A config]
        J[m2aStructure<br/>Field structure]
        K[allowedCollections<br/>Available types]
    end
```

## ⚡ Critical Timing Details

### The Props.value Watcher Implementation

The most critical piece of the data flow is the props.value watcher. Here's the complete implementation with timing details:

```typescript
watch(() => props.value, async (newValue) => {
  // 1. Skip if we caused this update
  if (isInternalUpdate.value) {
    isInternalUpdate.value = false
    return
  }
  
  // 2. Wait for collections to be ready
  if (allowedCollections.value.length === 0) {
    await nextTick()
    checkDelayedOptions()
  }
  
  // 3. Process the loaded records
  await processLoadedRecords(newValue)
  
  // 4. Mark as initialized
  isFullyInitialized.value = true
  
  // 5. Store original order for dirty detection
  originalItemOrder.value = items.value.map(item => getItemId(item))
  
  // 6. CRITICAL: Detect save completion
  if (saveButtonWouldBeActive.value === false && wasJustActive.value) {
    // Save just completed - update original order!
    originalItemOrder.value = [...items.value.map(item => getItemId(item))]
    
    // Clear all dirty states after successful save
    blockOriginalStates.value.clear()
    items.value.forEach(item => {
      const blockId = getItemId(item)
      const itemData = extractItemData(item)
      blockOriginalStates.value.set(blockId, deepClone(itemData))
    })
  }
  
  wasJustActive.value = saveButtonWouldBeActive.value
}, { immediate: true, deep: true })
```

### Critical Timing Sequence

```mermaid
sequenceDiagram
    participant P as Props
    participant W as Watcher
    participant S as State
    participant UI as UI Update
    
    Note over P,UI: Initial Load
    P->>W: value = null
    W->>W: Skip (no data)
    
    Note over P,UI: Data Arrives
    P->>W: value = [junction records]
    W->>S: processLoadedRecords()
    S->>S: Store original states
    S->>S: Store original order
    S->>UI: Render blocks
    
    Note over P,UI: User Edit
    UI->>S: Update item
    S->>P: emit('input', mixed array)
    W->>W: isInternalUpdate = true
    W->>W: Skip processing
    
    Note over P,UI: Save Detection
    P->>W: value = [updated records]
    W->>W: Check save button state
    W->>S: Update original states
    W->>S: Clear dirty flags
```

## 🎯 Critical Watchers

### Store Value Watcher

```typescript
// Watch the actual form value in the store
const storeValue = computed(() => {
  const values = useFieldsStore().values?.[props.field]
  return values || []
})

watch(storeValue, (newValue) => {
  // Detect when Directus reverts to ID-only array
  if (isAllIds(newValue) && !isInternalUpdate.value) {
    // This is a discard operation!
    handleDiscardDetected()
  }
})
```

### Save Button State Tracking

```typescript
// Track save button state for save detection
const saveButtonWouldBeActive = computed(() => {
  const fieldsStore = useFieldsStore()
  return fieldsStore.hasEdits
})

let wasJustActive = false

// Critical: Update this flag in the watcher
watch(saveButtonWouldBeActive, (isActive) => {
  if (!isActive && wasJustActive) {
    // Save just completed!
    updateOriginalStatesAfterSave()
  }
  wasJustActive = isActive
})
```

## 🔍 Debugging State

Enable debug mode to track state changes:

```javascript
{
  "options": {
    "debugMode": true
  }
}
```

This logs:
- State transitions
- Dirty state calculations
- Emit payloads
- Save detection
- Critical timing events
- Watcher triggers

### Debug Helper Function

```typescript
function debugLog(action: string, data?: any) {
  if (!props.options?.debugMode) return
  
  console.group(`[ExpandableBlocks] ${action}`)
  console.log('Time:', new Date().toISOString())
  console.log('Component ID:', componentId)
  
  if (data) {
    console.log('Data:', data)
  }
  
  console.log('Current State:', {
    items: items.value.length,
    expanded: expandedItems.value,
    dirty: Array.from(blockOriginalStates.value.keys()).filter(id => 
      isBlockDirty(id, findItemById(id)?.item)
    ),
    initialized: isFullyInitialized.value
  })
  
  console.groupEnd()
}
```

---

> **Next**: Learn about [[API Integration|06-API-Integration]] or explore [[Development|07-Development]] guide