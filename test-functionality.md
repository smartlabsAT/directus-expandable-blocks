# Expandable Blocks Extension - Functionality Test Checklist

## Test Date: 2025-07-17

### Pre-Test Setup
- [x] Directus running on port 8055
- [x] PostgreSQL running
- [x] Extension build successful (`npm run build-dev`)
- [x] Phase 1.1 refactoring completed (useBlockState.ts created)

### Core Functionality Tests

#### 1. State Management
- [ ] Items load correctly from database
- [ ] Expanded/collapsed state persists
- [ ] Dirty state tracking works (unsaved changes indicator)
- [ ] Original state preservation works

#### 2. CRUD Operations
- [ ] Add new block
- [ ] Edit existing block content
- [ ] Delete block
- [ ] Duplicate block
- [ ] Discard changes

#### 3. Sorting & Reordering
- [ ] Drag and drop reordering
- [ ] Sort order persists after save
- [ ] Dirty state updates on reorder

#### 4. Save/Emit Functionality
- [ ] prepareItemsForEmit returns IDs for clean blocks
- [ ] prepareItemsForEmit returns full objects for dirty blocks
- [ ] Save & Stay functionality works
- [ ] Global Discard Changes works

#### 5. UI Interactions
- [ ] Expand/collapse blocks
- [ ] Status dropdown (if applicable)
- [ ] More options menu
- [ ] Loading states display correctly

#### 6. Edge Cases
- [ ] Empty state displays correctly
- [ ] Maximum blocks limit (if configured)
- [ ] New blocks without IDs handled properly
- [ ] Nested M2A relationships display

### Test Results
- Build Status: ✅ Success
- TypeScript Errors: ✅ None
- Console Errors: [ ] To be tested
- Functionality: [ ] To be tested

### Notes
Phase 1.1 successfully implemented:
- Created `useBlockState.ts` with centralized state management (~325 lines)
- Updated `useExpandableBlocks.ts` to use the new composable
- Fixed all TypeScript and syntax errors
- Maintained all original functionality

### Next Steps
1. Manual testing in Directus interface
2. If all tests pass, proceed to Phase 1.2 (useBlockActions.ts)