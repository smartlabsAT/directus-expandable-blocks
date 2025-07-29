# Column Width Implementation Plan

## Overview
Implementation of intelligent column widths with user-configurable defaults and sticky columns for the ItemSelectorTable component.

## Current Status
- [ ] Not started
- [ ] Analysis completed
- [ ] Implementation in progress
- [ ] Testing
- [ ] Completed

## Problem Statement
The current table implementation uses fixed column widths for all dynamic fields, which doesn't account for different field types (boolean vs. text vs. datetime). Additionally, when many columns are displayed, users lose context of which item they're viewing when scrolling horizontally.

## Solution Architecture

### 1. CSS Grid with Sticky Columns
Replace the current Flexbox layout with CSS Grid to enable:
- Fixed left columns (Checkbox + Title)
- Fixed right column (Actions)
- Scrollable middle section for dynamic fields
- Intelligent width calculation based on field types

### 2. Field Type Width Mapping
Default widths based on Directus field types:
```javascript
const DEFAULT_FIELD_WIDTHS = {
  // Boolean types
  'boolean': 80,
  'toggle': 80,
  
  // Selection types
  'status': 120,
  'select': 120,
  'dropdown': 120,
  
  // Date/Time types
  'date': 150,
  'datetime': 150,
  'time': 100,
  'timestamp': 150,
  
  // Numeric types
  'integer': 100,
  'float': 100,
  'decimal': 100,
  'bigInteger': 120,
  
  // Text types
  'string': 200,
  'text': 300,
  'wysiwyg': 300,
  'markdown': 300,
  'code': 250,
  
  // Media types
  'image': 100,
  'file': 150,
  
  // System types
  'uuid': 150,
  'hash': 150,
  'json': 250,
  'csv': 200,
  'geometry': 200,
  
  // Fallback
  'unknown': 150
};
```

### 3. User Preferences Storage
Extend the existing `useUserPresets` composable to store column width preferences per collection.

## Implementation Steps

### Phase 1: CSS Grid Foundation ✅ 
**Status**: Completed
**Files to modify**:
- `src/components/ItemSelectorTable.vue`

**Tasks**:
1. [x] Replace `.table-row` flexbox with CSS Grid
2. [x] Implement dynamic `grid-template-columns` computed property
3. [x] Add wrapper for horizontal scrolling
4. [x] Test basic grid layout without sticky columns

**Implementation Details**:
- Added `gridTemplateColumns` computed property that dynamically generates grid template
- Wrapped table in `table-scroll-container` div for horizontal scrolling
- Changed `.table-row` from `display: flex` to `display: grid`
- Added `min-width: max-content` to prevent grid collapse
- Updated overflow properties to prevent double scrollbars
- Added custom scrollbar styling for horizontal scroll container

**Code Structure**:
```vue
<template>
  <div class="item-selector-table-wrapper">
    <div class="table-scroll-container">
      <div class="table-header">
        <!-- Grid layout header -->
      </div>
      <div class="table-body">
        <!-- Grid layout rows -->
      </div>
    </div>
  </div>
</template>

<style>
.table-scroll-container {
  overflow-x: auto;
  overflow-y: visible;
}

.table-row {
  display: grid;
  grid-template-columns: v-bind(gridTemplateColumns);
  min-width: max-content;
}
</style>
```

### Phase 2: Sticky Columns Implementation ✅
**Status**: Completed
**Files to modify**:
- `src/components/ItemSelectorTable.vue`

**Tasks**:
1. [x] Implement sticky left columns (checkbox + title)
2. [x] Implement sticky right column (actions)
3. [x] Add proper z-index management
4. [x] Add box-shadows for visual separation
5. [x] Ensure proper background colors

**Implementation Details**:
- Checkbox column: `position: sticky; left: 0; z-index: 3`
- Title column: `position: sticky; left: 48px; z-index: 2`
- Actions column: `position: sticky; right: 0; z-index: 3`
- Box-shadows using ::before/::after pseudo-elements
- Header sticky cells have higher z-index (15) for proper layering
- Background colors prevent content bleed-through

**CSS Implementation**:
```css
/* Sticky left columns */
.checkbox-cell {
  position: sticky;
  left: 0;
  z-index: 3;
  background: var(--background-page);
  box-shadow: 2px 0 4px -2px rgba(0, 0, 0, 0.1);
}

.title-cell {
  position: sticky;
  left: 48px;
  z-index: 2;
  background: var(--background-page);
  box-shadow: 2px 0 4px -2px rgba(0, 0, 0, 0.1);
}

/* Sticky right column */
.actions-cell {
  position: sticky;
  right: 0;
  z-index: 3;
  background: var(--background-page);
  box-shadow: -2px 0 4px -2px rgba(0, 0, 0, 0.1);
}

/* Sticky header cells need higher z-index */
.header-row .checkbox-cell,
.header-row .title-cell,
.header-row .actions-cell {
  z-index: 5;
}
```

### Phase 3: Field Type Detection & Width Calculation ✅
**Status**: Completed
**Files to create/modify**:
- `src/utils/column-width-helpers.ts` (new file) ✅
- `src/components/ItemSelectorTable.vue` ✅

**Tasks**:
1. [x] Create `getDefaultFieldWidth(fieldType)` utility function
2. [x] Create `getFieldTypeFromInfo(fieldInfo)` helper
3. [x] Update `gridTemplateColumns` computed property
4. [x] Implement intelligent width calculation based on field types

**Implementation Details**:
- Created comprehensive field type to width mapping (80px - 300px)
- Field type detection checks interface first, then falls back to type
- Supports all major Directus field types and interfaces
- Column widths are now calculated per field instead of fixed 200px

**Implementation**:
```typescript
// src/utils/column-width-helpers.ts
export function getDefaultFieldWidth(fieldType: string): number {
  return DEFAULT_FIELD_WIDTHS[fieldType] || DEFAULT_FIELD_WIDTHS.unknown;
}

export function getFieldTypeFromInfo(fieldInfo: any): string {
  // Check interface first (more specific)
  if (fieldInfo?.interface) {
    switch (fieldInfo.interface) {
      case 'toggle':
      case 'boolean':
        return 'boolean';
      case 'datetime':
      case 'date':
      case 'time':
        return fieldInfo.interface;
      case 'select-dropdown':
      case 'select-radio':
        return 'select';
      case 'input-rich-text-html':
      case 'input-rich-text-md':
        return 'wysiwyg';
      case 'file-image':
        return 'image';
      case 'file':
        return 'file';
    }
  }
  
  // Fall back to type
  return fieldInfo?.type || 'unknown';
}
```

### Phase 4: User Settings UI
**Status**: Not started
**Files to modify**:
- `src/components/ItemSelectorTable.vue` (add hover gear icon)
- `src/components/ColumnWidthPopover.vue` (new component)
- `src/components/FieldSettingsMenu.vue` (add reset button)
- `src/types/index.ts` (extend interfaces)

**Tasks**:
1. [ ] Add hover gear icon to table header labels
2. [ ] Create ColumnWidthPopover component with slider
3. [ ] Implement relative width adjustment (-50% to +100%)
4. [ ] Add live preview during sliding
5. [ ] Add "Reset all column widths" button to FieldSettingsMenu
6. [ ] Integrate with useUserPresets for persistence

**New UX Concept**:
- **Direct manipulation**: Hover over column header → gear icon appears → click opens popover
- **Relative slider**: Center position = default width, slide left = narrower, slide right = wider
- **Live feedback**: Column width updates in real-time while sliding
- **Global reset**: Button in main settings to reset all columns to defaults

**Implementation Structure**:
```vue
<!-- In ItemSelectorTable.vue header cell -->
<div class="table-cell field-cell">
  <span class="field-header-label">
    {{ getFieldLabel(field) }}
  </span>
  <v-button
    v-show="hoveredField === field"
    icon
    x-small
    secondary
    class="column-settings-trigger"
    @click="openColumnSettings(field, $event)"
  >
    <v-icon name="settings" x-small />
  </v-button>
</div>

<!-- New ColumnWidthPopover.vue component -->
<v-menu :show-arrow="true" placement="top">
  <div class="column-width-popover">
    <div class="popover-title">Adjust Column Width</div>
    <v-slider
      v-model="relativeWidth"
      :min="-50"
      :max="100"
      :step="5"
      :thumb-label="true"
      @update:model-value="updateWidth"
    />
    <div class="width-indicator">{{ relativeWidth > 0 ? '+' : '' }}{{ relativeWidth }}%</div>
  </div>
</v-menu>
```

### Phase 5: Persistence Layer
**Status**: Not started
**Files to modify**:
- `src/composables/useUserPresets.ts`
- `src/components/ItemSelectorDrawer.vue`

**Tasks**:
1. [ ] Extend `LayoutOptions` interface with `columnWidths`
2. [ ] Add save/load methods for column widths
3. [ ] Implement debounced auto-save on slider change
4. [ ] Load settings when drawer opens

**Interface Extension**:
```typescript
interface LayoutOptions {
  // ... existing fields
  columnWidths?: Record<string, number>;
}
```

### Phase 6: Integration & Testing
**Status**: Not started

**Tasks**:
1. [ ] Connect all components together
2. [ ] Test with various field combinations
3. [ ] Test sticky columns with horizontal scrolling
4. [ ] Test settings persistence
5. [ ] Test performance with many columns
6. [ ] Browser compatibility testing

## Testing Scenarios

### Functional Tests
1. **Basic Grid Layout**
   - [ ] Columns display with correct default widths
   - [ ] Grid adjusts to available space
   - [ ] Horizontal scrolling works when needed

2. **Sticky Columns**
   - [ ] Checkbox column stays fixed on left
   - [ ] Title column stays fixed on left
   - [ ] Actions column stays fixed on right
   - [ ] Z-index layering works correctly
   - [ ] Background colors prevent bleed-through

3. **User Settings**
   - [ ] Slider changes update column widths in real-time
   - [ ] Settings persist after closing/reopening drawer
   - [ ] Reset to defaults works correctly
   - [ ] Only relevant field types show in settings

### Edge Cases
1. [ ] Single dynamic column
2. [ ] Many columns (20+)
3. [ ] Very narrow viewport
4. [ ] Mixed field types
5. [ ] No dynamic fields selected

## Performance Considerations

1. **CSS Grid Performance**
   - Use CSS custom properties for dynamic values
   - Minimize reflows during width changes
   - Debounce slider updates

2. **Memory Usage**
   - Store only modified widths (not defaults)
   - Clean up unused collection settings

## Future Enhancements

1. **Manual Column Resizing**
   - Drag handles between columns
   - Save manual adjustments

2. **Column Groups**
   - Group related fields
   - Collective width settings

3. **Export/Import Settings**
   - Share column configurations
   - Apply to similar collections

## Dependencies

- Vue 3 Composition API
- Directus SDK for preferences
- CSS Grid support (all modern browsers)
- CSS position: sticky (all modern browsers)

## Browser Support

- Chrome/Edge: Full support
- Firefox: Full support
- Safari: Full support (check sticky + overflow behavior)
- Mobile browsers: Test horizontal scrolling UX

## Notes & Decisions

1. **Why CSS Grid over Flexbox?**
   - Better control over column widths
   - Easier to implement sticky columns
   - More predictable behavior with dynamic content

2. **Why field type based widths?**
   - Boolean fields need minimal space
   - Text fields need more space for readability
   - Consistent UX across different collections

3. **Why user-configurable?**
   - Different use cases require different layouts
   - User preferences vary
   - Some collections may have unique requirements

## Related Files

- Current implementation: `src/components/ItemSelectorTable.vue`
- User preferences: `src/composables/useUserPresets.ts`
- Settings UI: `src/components/FieldSettingsMenu.vue`
- Type definitions: `src/types/index.ts`

## Resources

- [CSS Grid Guide](https://css-tricks.com/snippets/css/complete-guide-grid/)
- [Sticky Table Columns](https://css-tricks.com/position-sticky-and-table-headers/)
- [Directus Field Types](https://docs.directus.io/guides/data-model/fields)