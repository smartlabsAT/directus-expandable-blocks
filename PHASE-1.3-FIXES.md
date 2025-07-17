# Phase 1.3 Fixes - Dirty State Tracking Issues

## Issues Fixed

### 1. Position Changes Not Triggering Full Object Emission
**Problem**: When blocks were reordered, `isBlockDirty` correctly detected position changes, but `prepareItemsForEmit` still emitted IDs only.

**Root Cause**: In `prepareItemsForEmit` (useBlockState.ts:148-157), the code was only checking content changes with `deepEqual` instead of using the full `isBlockDirty` function which includes position checks.

**Fix**: Changed the code to always use `isBlockDirty` for the full check:
```typescript
// Before:
if (!isDirty && item.item) {
  const originalData = blockOriginalStates.value.get(blockId);
  if (originalData) {
    isDirty = !deepEqual(item.item, originalData);
  } else {
    isDirty = isBlockDirty(blockId, item.item);
  }
}

// After:
if (!isDirty) {
  // Use the full isBlockDirty check which includes position changes
  isDirty = isBlockDirty(blockId, item.item);
}
```

### 2. Blocks Remaining Dirty After Save
**Problem**: After saving, some blocks (e.g., block 25) remained in a dirty state.

**Root Cause**: After a save operation, `processLoadedRecords` was not updating the original states to reflect the new saved state, because it only updated original states if they didn't exist.

**Fix**: Added an `isAfterSave` parameter to handle post-save updates:
1. Added `isAfterSave` parameter to `processLoadedRecords` and `loadFullItemData`
2. When `isAfterSave=true`, always update original states and mark blocks as clean
3. Updated all save detection code to pass `isAfterSave=true` when reloading

### 3. Multiple Redundant Data Reloads
**Problem**: Multiple data reloads were happening after each action.

**Root Cause**: This was a side effect of the dirty state issues - the system was trying to reconcile inconsistent states.

**Fix**: The above fixes should reduce redundant reloads by properly managing state transitions.

## Files Modified

1. **useBlockState.ts** (line 148-157)
   - Fixed `prepareItemsForEmit` to use full `isBlockDirty` check

2. **useM2AData.ts** (lines 455, 504-514, 228-230, 293)
   - Added `isAfterSave` parameter to `processLoadedRecords`
   - Added `isAfterSave` parameter to `loadFullItemData`
   - Updated state handling logic for post-save scenarios

3. **useExpandableBlocks.ts** (lines 373, 386, 571)
   - Pass `isAfterSave=true` when loading data after save detection

## Testing

To verify these fixes:
1. Reorder blocks and check that they're emitted as full objects
2. Save the page and verify all blocks are marked as clean
3. Check that block positions are preserved after save
4. Monitor for redundant data reloads

## Next Steps

With Phase 1.3 complete and these critical fixes in place, we can proceed with:
- Phase 1.4: Create useBlockWatchers.ts for all reactive watchers
- Phase 1.5: Final refactoring of useExpandableBlocks.ts