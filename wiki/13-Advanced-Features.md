# Advanced Features

This page covers the advanced functionality and capabilities of the Expandable Blocks extension.

## 🔒 Permission Controls

The extension provides granular permission controls that can be configured per field:

```typescript
interface PermissionOptions {
  isAllowedDelete?: boolean;     // Can delete blocks
  isAllowedDuplicate?: boolean;  // Can duplicate blocks
  maxBlocks?: number | null;     // Maximum blocks allowed
}
```

### Auto-hiding Menu

The three-dot menu automatically hides when both delete and duplicate permissions are disabled, creating a cleaner interface for read-only scenarios.

## 🎯 Block-Level Actions

Each block supports several actions accessible through the three-dot menu:

### 1. **Duplicate Block**
- Creates an exact copy of the block
- Automatically appends "(Copy)" suffix to the title
- Maintains all field values and relationships
- Respects `isAllowedDuplicate` permission

### 2. **Discard Changes**
- Reverts individual block to its last saved state
- Only appears when the block has unsaved changes
- Maintains block expansion state
- Does not affect other blocks

### 3. **Delete Block**
- Removes block with confirmation dialog
- Respects `isAllowedDelete` permission
- Updates dirty state tracking
- Properly cleans up from state management

### 4. **Status Change**
- Quick status updates directly from the header
- Available when collection has a status field
- Updates without requiring block expansion
- Visual feedback through status indicator

## 🌐 Global Integration

The extension seamlessly integrates with Directus' native form system:

### Save Button State
- Accurately reflects unsaved changes across all blocks
- Considers both content changes and sort order changes
- Updates in real-time as users make edits
- Works with "Save and Stay" functionality

### Discard All Changes
- Global discard resets all blocks to saved state
- Preserves block expansion states for better UX
- Clears all dirty indicators
- Syncs with Directus' native discard functionality

### Form Validation
- Integrates with Directus field validation
- Shows validation errors inline within blocks
- Prevents saving when validation fails
- Highlights blocks with validation errors

## 🚀 Performance Features

### Smart Loading
- Blocks load data only when expanded
- Prevents unnecessary API calls
- Shows loading indicators during fetch
- Caches loaded data for quick re-expansion

### Efficient Rendering
- Accordion mode limits DOM elements
- Compact mode reduces visual overhead
- Virtual scrolling ready for future enhancement
- Optimized re-render cycles

### State Management
- Efficient dirty checking with Maps
- Minimal re-renders on state changes
- Proper cleanup of deleted block states
- Memory-efficient data structures

## 🎨 Customization Options

### Display Modes

#### Accordion Mode
- Only one block expanded at a time
- Automatically collapses others
- Reduces visual clutter
- Ideal for long lists

#### Compact Mode
- Condensed header design
- Smaller fonts and spacing
- More blocks visible at once
- Perfect for overview scenarios

#### Start Expanded
- All blocks expanded on load
- Useful for quick editing
- Can be combined with accordion mode
- Configurable per field

### Visual Customization

#### Show Item IDs
- Displays database IDs in headers
- Useful for debugging
- Helps identify specific records
- Can be toggled per field

#### Custom Icons
- Uses collection-specific icons
- Falls back to default if not set
- Consistent with Directus UI
- Enhances visual recognition

## 🔄 Advanced Sorting

### Drag & Drop Features
- Visual feedback during drag
- Smooth animations
- Auto-scroll when near edges
- Maintains data integrity

### Sort Order Persistence
- Tracks original positions
- Detects order changes
- Updates sort field on save
- Preserves manual ordering

### Sort Field Configuration
- Automatically detects sort field
- Falls back to manual tracking
- Works with custom sort fields
- Maintains consistency

## 📊 Batch Operations

### Multi-Select (Planned)
- Select multiple blocks at once
- Bulk delete operations
- Bulk duplicate functionality
- Bulk status changes

### Quick Actions (Planned)
- Keyboard shortcuts
- Context menus
- Inline editing
- Quick navigation

## 🔍 Search & Filter (Planned)

### Content Search
- Search across all block fields
- Highlight matching content
- Filter by collection type
- Quick jump to results

### Advanced Filtering
- Filter by status
- Filter by date ranges
- Filter by user
- Custom filter conditions

## 📋 Templates (Planned)

### Template Creation
- Save any block as template
- Name and categorize templates
- Include all field values
- Share across projects

### Template Usage
- Quick insert from library
- Modify after insertion
- Combine multiple templates
- Template management UI

## 🔐 Security Features

### Permission Enforcement
- All operations respect Directus permissions
- Server-side validation on all changes
- No client-side permission bypassing
- Graceful degradation for limited permissions

### Data Integrity
- Validates relationships before save
- Prevents orphaned records
- Maintains referential integrity
- Handles cascade deletes properly

### XSS Protection
- No direct HTML rendering
- Sanitized user inputs
- Safe attribute binding
- Content Security Policy compliant