# UI/UX Design

This page covers the user interface design principles, component structure, and styling architecture of the Expandable Blocks extension.

## 🎨 Design Philosophy

The extension follows Directus' design principles:
- **Consistency**: Uses Directus CSS variables and components
- **Clarity**: Clear visual hierarchy and intuitive interactions
- **Performance**: Smooth transitions and responsive feedback
- **Accessibility**: Keyboard navigation and screen reader support

## 📐 Professional Header Design

The block header is the primary interaction point and contains several carefully designed elements:

```vue
<div class="block-header">
  <!-- Drag Handle -->
  <v-icon name="drag_indicator" class="drag-handle" />
  
  <!-- Collection Icon with Dirty Indicator -->
  <div class="icon-wrapper">
    <v-icon :name="getCollectionIcon(item)" />
    <div v-if="isBlockDirty(...)" class="dirty-indicator" />
  </div>
  
  <!-- Main Info -->
  <div class="block-info">
    <span class="block-title">{{ title }}</span>
    <v-chip class="collection-chip">{{ collection }}</v-chip>
    <span v-if="showItemId" class="item-id">ID: {{ id }}</span>
  </div>
  
  <!-- Status Display -->
  <v-menu v-if="hasStatusField">
    <div class="status-display">
      <span class="status-dot" />
      <span class="status-text">{{ status }}</span>
    </div>
  </v-menu>
  
  <!-- Actions Menu -->
  <v-menu v-if="hasActions">
    <v-button icon="more_vert" />
  </v-menu>
</div>
```

### Header Components Breakdown

#### 1. Drag Handle
- Only visible when sorting is enabled
- Changes cursor on hover
- Provides visual affordance for dragging
- Hidden in read-only mode

#### 2. Collection Icon
- Uses collection-specific icons
- Includes dirty state indicator (orange dot)
- Consistent 24x24px size
- Falls back to 'box' icon if none specified

#### 3. Block Information
- **Title**: Primary identifier, uses display template
- **Collection Chip**: Shows data source, color-coded
- **Item ID**: Optional, useful for debugging

#### 4. Status Display
- Dynamic color based on status value
- Click to change (if permissions allow)
- Visual consistency with Directus status fields
- Smooth color transitions

#### 5. Actions Menu
- Three-dot menu for additional actions
- Auto-hides when no actions available
- Contextual options based on state
- Consistent with Directus patterns

## 🎭 CSS Architecture

### CSS Variable Usage

The extension leverages Directus' CSS variables for consistency:

```css
.expandable-blocks {
  /* Colors */
  --primary: var(--theme--primary);
  --danger: var(--theme--danger);
  --warning: var(--theme--warning);
  --success: var(--theme--success);
  
  /* Spacing */
  --spacing-s: 8px;
  --spacing-m: 16px;
  --spacing-l: 24px;
  
  /* Borders */
  --border-radius: var(--theme--border-radius);
  --border-color: var(--theme--border-color-subdued);
  
  /* Typography */
  --font-family: var(--theme--fonts--sans--font-family);
  --font-size-base: 14px;
}
```

### Component Styling Structure

```css
/* Container */
.expandable-blocks-container {
  display: flex;
  flex-direction: column;
  gap: var(--spacing-m);
}

/* Individual Block */
.expandable-block {
  background: var(--theme--background);
  border: 2px solid var(--border-color);
  border-radius: var(--border-radius);
  transition: all 0.2s ease;
}

/* Hover States */
.expandable-block:hover {
  border-color: var(--theme--border-color);
  box-shadow: 0 2px 4px rgba(0, 0, 0, 0.05);
}

/* Dirty State */
.expandable-block.is-dirty {
  border-color: var(--theme--warning);
}

/* Expanded State */
.expandable-block.is-expanded {
  box-shadow: 0 4px 8px rgba(0, 0, 0, 0.1);
}
```

## 🎬 Animations & Transitions

### Expand/Collapse Animation

```css
.block-content {
  overflow: hidden;
  transition: height 0.3s ease-out;
}

.block-content-enter-active,
.block-content-leave-active {
  transition: opacity 0.2s ease;
}

.block-content-enter-from,
.block-content-leave-to {
  opacity: 0;
}
```

### Drag & Drop Animation

```css
.sortable-ghost {
  opacity: 0.5;
  background: var(--theme--primary-background);
}

.sortable-drag {
  cursor: grabbing !important;
  box-shadow: 0 8px 16px rgba(0, 0, 0, 0.15);
  transform: scale(1.02);
}

.sortable-chosen {
  cursor: grab;
}
```

### Loading States

```css
.loading-overlay {
  position: absolute;
  inset: 0;
  background: rgba(255, 255, 255, 0.9);
  display: flex;
  align-items: center;
  justify-content: center;
  transition: opacity 0.2s ease;
}

.skeleton-loader {
  animation: skeleton-pulse 1.5s ease-in-out infinite;
}

@keyframes skeleton-pulse {
  0%, 100% { opacity: 1; }
  50% { opacity: 0.5; }
}
```

## 🎯 Visual States

### 1. Empty State
- Friendly message when no blocks exist
- Clear call-to-action button
- Consistent with Directus empty states
- Optional custom empty message

### 2. Loading State
- Skeleton loaders for better perceived performance
- Maintains layout stability
- Progressive loading for large datasets
- Smooth transitions when loaded

### 3. Error State
- Clear error messaging
- Retry actions where applicable
- Graceful degradation
- Maintains data integrity

### 4. Dirty State Indicators
- Orange border on modified blocks
- Orange dot on collection icon
- Visual feedback in save button
- Clear indication of what changed

## 📱 Responsive Design

### Mobile Optimization

```css
@media (max-width: 768px) {
  .block-header {
    flex-wrap: wrap;
    gap: var(--spacing-s);
  }
  
  .block-info {
    flex: 1 1 100%;
    order: 2;
  }
  
  .collection-chip {
    font-size: 12px;
  }
  
  .compact-mode .block-header {
    padding: var(--spacing-s);
  }
}
```

### Touch Interactions
- Larger touch targets on mobile
- Swipe gestures for actions (planned)
- Touch-friendly drag handles
- Optimized scrolling performance

## 🎨 Theme Support

### Light Theme
- Clean white backgrounds
- Subtle shadows and borders
- High contrast for readability
- Professional appearance

### Dark Theme
- Proper contrast ratios
- Reduced eye strain
- Consistent with Directus dark mode
- Careful color selection

## ♿ Accessibility

### Keyboard Navigation
- Tab through blocks
- Enter to expand/collapse
- Space to select
- Escape to close menus

### Screen Reader Support
- Proper ARIA labels
- Semantic HTML structure
- Status announcements
- Focus management

### Visual Accessibility
- Color contrast compliance
- Focus indicators
- No color-only information
- Clear visual hierarchy

## 🖼️ Icons & Visual Elements

### Icon System
- Consistent 24x24px sizing
- Uses Directus icon library
- Meaningful icon choices
- Fallback options

### Status Indicators
```css
.status-dot {
  width: 8px;
  height: 8px;
  border-radius: 50%;
  background-color: var(--status-color);
  transition: background-color 0.2s ease;
}

/* Status Colors */
.status-published { --status-color: var(--theme--success); }
.status-draft { --status-color: var(--theme--warning); }
.status-archived { --status-color: var(--theme--foreground-subdued); }
```

### Visual Feedback
- Hover states on all interactive elements
- Active states for current actions
- Disabled states for unavailable actions
- Loading states for async operations

## 🎛️ Customization Options

### Compact Mode Styling
```css
.compact-mode {
  .block-header {
    padding: 8px 12px;
    min-height: 40px;
  }
  
  .block-title {
    font-size: 13px;
  }
  
  .collection-chip {
    padding: 2px 8px;
    font-size: 11px;
  }
}
```

### Custom Styling Hooks
- CSS classes for each state
- Data attributes for collection types
- Custom CSS variable injection
- Theme-aware styling

## 🏆 Best Practices

### Performance
- Use CSS transforms for animations
- Minimize repaints and reflows
- Optimize for 60fps animations
- Lazy load heavy components

### Maintainability
- Follow BEM naming convention
- Use CSS variables for theming
- Keep specificity low
- Document complex styles

### Consistency
- Match Directus design patterns
- Use existing components
- Follow spacing guidelines
- Maintain visual rhythm