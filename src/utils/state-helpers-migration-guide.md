# State Helpers Migration Guide

This guide explains how to refactor existing code to use the new centralized state management utilities in `state-helpers.ts`.

## Overview

The `state-helpers.ts` module provides reusable utilities for common state management patterns:

- **Deep equality checks** - `deepEqual()`
- **State cloning** - `deepClone()`
- **Dirty state management** - `StateTracker` class
- **Order tracking** - `OrderTracker` class
- **Batch updates** - `BatchStateUpdater` class
- **State diffing** - `createStateDiff()`

## Migration Examples

### 1. Replace Manual Deep Equality Checks

**Before:**
```typescript
function deepEqual(a: any, b: any): boolean {
  if (a === b) return true;
  if (a == null || b == null) return false;
  // ... manual implementation
}

// Usage
const hasChanged = !deepEqual(currentState, originalState);
```

**After:**
```typescript
import { deepEqual } from '../utils/state-helpers';

// Usage remains the same
const hasChanged = !deepEqual(currentState, originalState);
```

### 2. Replace Manual State Tracking with StateTracker

**Before:**
```typescript
const blockOriginalStates = ref<Map<string, any>>(new Map());
const blockDirtyStates = ref<Map<string, boolean>>(new Map());

function updateOriginalState(blockId: string, state: any): void {
  blockOriginalStates.value.set(blockId, deepClone(state));
}

function markBlockDirty(blockId: string, isDirty: boolean): void {
  blockDirtyStates.value.set(blockId, isDirty);
}

function isBlockDirty(blockId: string): boolean {
  return blockDirtyStates.value.get(blockId) || false;
}
```

**After:**
```typescript
import { StateTracker } from '../utils/state-helpers';

const blockStateTracker = new StateTracker<any>('BlockState');

// Store original state
blockStateTracker.storeOriginalState(blockId, state);

// Mark as dirty
blockStateTracker.setDirtyFlag(blockId, true);

// Check if dirty
const isDirty = blockStateTracker.isDirty(blockId);

// Check if changed from original
const hasChanged = blockStateTracker.hasChanged(blockId, currentState);

// Reset to original
const originalState = blockStateTracker.resetToOriginal(blockId);
```

### 3. Replace Order Tracking Logic

**Before:**
```typescript
const originalItemOrder = ref<(string | number)[]>([]);

function updateOriginalItemOrder(order: (string | number)[]): void {
  originalItemOrder.value = [...order];
}

function hasOrderChanged(currentOrder: (string | number)[]): boolean {
  if (originalItemOrder.value.length !== currentOrder.length) return true;
  return !originalItemOrder.value.every((id, index) => id === currentOrder[index]);
}
```

**After:**
```typescript
import { OrderTracker } from '../utils/state-helpers';

const orderTracker = new OrderTracker('BlockOrder');

// Store original order
orderTracker.storeOriginalOrder(order);

// Check if order changed
const hasChanged = orderTracker.hasOrderChanged(currentOrder);

// Get original order
const original = orderTracker.getOriginalOrder();
```

### 4. Use Batch Updates for Multiple State Changes

**Before:**
```typescript
// Updating multiple states individually
items.forEach(item => {
  blockOriginalStates.value.set(item.id, deepClone(item));
  blockDirtyStates.value.set(item.id, false);
});
```

**After:**
```typescript
import { BatchStateUpdater, StateTracker } from '../utils/state-helpers';

const tracker = new StateTracker<any>();
const updater = new BatchStateUpdater<any>();

// Queue updates
items.forEach(item => {
  updater.queueUpdate(item.id, item);
});

// Apply all at once
updater.applyTo(tracker);
```

### 5. Replace JSON.stringify/parse Patterns

**Before:**
```typescript
// For comparison
const isEqual = JSON.stringify(newVal) === JSON.stringify(oldVal);

// For cloning
const cloned = JSON.parse(JSON.stringify(originalData));
```

**After:**
```typescript
import { deepEqual, deepClone } from '../utils/state-helpers';

// For comparison
const isEqual = deepEqual(newVal, oldVal);

// For cloning
const cloned = deepClone(originalData);
```

### 6. Add State Diff Tracking

**New capability** - Track what specifically changed:

```typescript
import { createStateDiff } from '../utils/state-helpers';

const getOriginal = () => blockStateTracker.getOriginalState(blockId);
const getCurrent = () => items.value.find(item => item.id === blockId);

const diff = createStateDiff(getOriginal, getCurrent);

// Check what changed
const { hasChanges, changes } = diff();
if (hasChanges) {
  console.log('Changed fields:', changes);
  // Output: ['title', 'content.body (removed)', 'tags.0']
}
```

### 7. Safe Debugging Output

**Before:**
```typescript
console.log('State:', JSON.stringify(complexState));
// May throw on circular references
```

**After:**
```typescript
import { safeStringify } from '../utils/state-helpers';

console.log('State:', safeStringify(complexState, 2));
// Handles circular references and functions safely
```

## Complete Refactoring Example

See `useBlockState.refactored.ts` for a complete example of how to refactor a composable to use the new state helpers. Key changes:

1. Replace manual Maps with `StateTracker`
2. Replace order tracking logic with `OrderTracker`
3. Remove duplicate `deepEqual` implementation
4. Use `deepClone` from state-helpers
5. Add debug capabilities with `getStateDebugInfo()`

## Benefits

1. **Reduced code duplication** - Common patterns are centralized
2. **Better testing** - State helpers have comprehensive tests
3. **Improved debugging** - Built-in debug logging and state inspection
4. **Type safety** - Generic types for state tracking
5. **Performance** - Optimized implementations for common operations
6. **Consistency** - Same patterns used throughout the codebase

## Step-by-Step Migration

1. **Import state helpers** in files that need refactoring
2. **Identify patterns** - Look for Maps tracking states, deep equality checks, cloning
3. **Replace incrementally** - Start with one pattern at a time
4. **Test thoroughly** - Ensure behavior remains the same
5. **Remove old code** - Delete redundant implementations
6. **Update tests** - Use state helpers in tests too

## Testing

All state helpers come with comprehensive tests. When migrating:

1. Run existing tests to ensure nothing breaks
2. Consider adding tests for state tracking if missing
3. Use the helper test patterns as examples

```typescript
// Example test using StateTracker
it('should track block state changes', () => {
  const tracker = new StateTracker<BlockData>('test');
  const original = { title: 'Original', content: 'Test' };
  
  tracker.storeOriginalState('block1', original);
  
  expect(tracker.hasChanged('block1', original)).toBe(false);
  expect(tracker.hasChanged('block1', { ...original, title: 'Modified' })).toBe(true);
});
```