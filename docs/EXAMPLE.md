# Expandable Blocks Extension - Examples

This document provides practical examples of using the Expandable Blocks extension in various scenarios.

## Example 1: Page Builder System

### Database Schema

```sql
-- Main pages table
CREATE TABLE pages (
  id serial PRIMARY KEY,
  title varchar(255),
  slug varchar(255) UNIQUE,
  status varchar(20) DEFAULT 'draft',
  content_blocks json -- M2A field
);

-- Junction table for M2A relationship
CREATE TABLE pages_content_blocks (
  id serial PRIMARY KEY,
  pages_id integer REFERENCES pages(id),
  collection varchar(64),
  item integer,
  sort integer DEFAULT 0
);

-- Content block types
CREATE TABLE content_hero (
  id serial PRIMARY KEY,
  headline varchar(255),
  subheadline text,
  background_image uuid REFERENCES directus_files(id),
  cta_text varchar(100),
  cta_link varchar(255),
  status varchar(20) DEFAULT 'published'
);

CREATE TABLE content_text (
  id serial PRIMARY KEY,
  title varchar(255),
  content text,
  columns integer DEFAULT 1,
  status varchar(20) DEFAULT 'published'
);

CREATE TABLE content_gallery (
  id serial PRIMARY KEY,
  title varchar(255),
  images json, -- M2M to files
  layout varchar(20) DEFAULT 'grid',
  status varchar(20) DEFAULT 'published'
);
```

### Directus Configuration

1. **Configure M2A Field on Pages:**
   ```javascript
   {
     field: 'content_blocks',
     type: 'm2a',
     interface: 'expandable-blocks',
     options: {
       enableSorting: true,
       startExpanded: false,
       accordionMode: false,
       showItemId: true,
       compactMode: false,
       isAllowedDelete: true,
       isAllowedDuplicate: true,
       maxBlocks: null,
       allowedCollections: [
         'content_hero',
         'content_text',
         'content_gallery',
         'content_video',
         'content_cta'
       ]
     }
   }
   ```

2. **Permission Configuration:**
   ```javascript
   // For editors - limited permissions
   {
     isAllowedDelete: false,     // Cannot delete blocks
     isAllowedDuplicate: true,   // Can duplicate
     maxBlocks: 10               // Limit to 10 blocks
   }
   
   // For admins - full permissions
   {
     isAllowedDelete: true,
     isAllowedDuplicate: true,
     maxBlocks: null             // Unlimited
   }
   ```

### Usage Example

```javascript
// Page data structure
{
  id: 1,
  title: "About Us",
  slug: "about-us",
  status: "published",
  content_blocks: [
    {
      id: 1,
      collection: "content_hero",
      item: {
        id: 1,
        headline: "Welcome to Our Company",
        subheadline: "Leading innovation since 2020",
        background_image: "uuid-here",
        cta_text: "Learn More",
        cta_link: "#services"
      }
    },
    {
      id: 2,
      collection: "content_text",
      item: {
        id: 1,
        title: "Our Story",
        content: "<p>Rich text content here...</p>",
        columns: 2
      }
    },
    {
      id: 3,
      collection: "content_gallery",
      item: {
        id: 1,
        title: "Our Office",
        images: ["uuid-1", "uuid-2", "uuid-3"],
        layout: "slider"
      }
    }
  ]
}
```

## Example 2: Product Variants System

### Configuration for E-commerce

```javascript
{
  field: 'variants',
  interface: 'expandable-blocks',
  options: {
    enableSorting: false,        // Variants don't need sorting
    startExpanded: true,         // Show all variants
    accordionMode: false,        // View multiple at once
    compactMode: true,           // Compact view for many variants
    showItemId: true,            // Show SKU/ID
    isAllowedDelete: true,
    isAllowedDuplicate: true,
    maxBlocks: 20,               // Reasonable variant limit
    allowedCollections: ['product_variants'],
    showFieldsFilter: [          // Only show relevant fields
      'sku',
      'size',
      'color',
      'price',
      'stock',
      'status'
    ]
  }
}
```

### Working with Variants

1. **Quick Duplicate**: Use the duplicate feature to create size variations
2. **Bulk Status Change**: Quickly change variant status from the header
3. **Individual Discard**: Revert price changes on specific variants
4. **Compact Overview**: See all variants at a glance in compact mode

## Example 3: FAQ Management

### Configuration for FAQ Sections

```javascript
{
  field: 'faq_items',
  interface: 'expandable-blocks',
  options: {
    enableSorting: true,         // Reorder FAQ priority
    startExpanded: false,        // Collapsed by default
    accordionMode: true,         // Edit one at a time
    compactMode: false,
    showItemId: false,           // IDs not relevant for FAQs
    isAllowedDelete: true,
    isAllowedDuplicate: true,
    maxBlocks: 50,               // Allow many FAQs
    allowedCollections: ['faq_questions']
  }
}
```

### FAQ Structure

```javascript
{
  id: 1,
  category: "General",
  faq_items: [
    {
      id: 1,
      collection: "faq_questions",
      item: {
        id: 1,
        question: "What are your business hours?",
        answer: "We are open Monday-Friday, 9 AM to 6 PM EST.",
        category: "general",
        tags: ["hours", "schedule"],
        status: "published"
      }
    }
  ]
}
```

## Example 4: Multi-language Content

### Configuration for Translations

```javascript
{
  field: 'translations',
  interface: 'expandable-blocks',
  options: {
    enableSorting: false,        // Languages have no order
    startExpanded: true,         // See all languages
    accordionMode: false,
    compactMode: true,           // Compact for overview
    showItemId: false,
    isAllowedDelete: false,      // Prevent accidental deletion
    isAllowedDuplicate: false,   // No duplicate languages
    maxBlocks: 10,               // Reasonable language limit
    allowedCollections: ['content_translations']
  }
}
```

## Example 5: Form Builder

### Dynamic Form Configuration

```javascript
{
  field: 'form_fields',
  interface: 'expandable-blocks',
  options: {
    enableSorting: true,         // Field order matters
    startExpanded: false,
    accordionMode: true,         // Focus on one field
    showItemId: true,            // Show field IDs
    isAllowedDelete: true,
    isAllowedDuplicate: true,
    maxBlocks: 30,               // Reasonable form size
    allowedCollections: [
      'form_field_text',
      'form_field_email',
      'form_field_select',
      'form_field_checkbox',
      'form_field_file'
    ]
  }
}
```

### Form Field Types

```javascript
// Text field
{
  id: 1,
  collection: "form_field_text",
  item: {
    label: "Full Name",
    name: "full_name",
    placeholder: "Enter your name",
    required: true,
    validation: "min:2|max:100"
  }
}

// Select field with options
{
  id: 2,
  collection: "form_field_select",
  item: {
    label: "Country",
    name: "country",
    options: [
      { value: "us", label: "United States" },
      { value: "uk", label: "United Kingdom" },
      { value: "de", label: "Germany" }
    ],
    required: true
  }
}
```

## Best Practices

### 1. Performance Optimization

```javascript
// For many blocks, use accordion mode
{
  accordionMode: true,      // Only one expanded
  startExpanded: false,     // Start collapsed
  compactMode: true        // Reduce visual space
}
```

### 2. User Experience

```javascript
// For critical content, limit destructive actions
{
  isAllowedDelete: false,   // Prevent deletion
  maxBlocks: 5              // Limit complexity
}
```

### 3. Content Types

```javascript
// Group related collections
{
  allowedCollections: [
    'content_text',         // Basic content
    'content_image',        // Media
    'content_video',
    'content_embed',        // External
    'content_code'
  ]
}
```

### 4. Field Filtering

```javascript
// Show only essential fields inline
{
  showFieldsFilter: [
    'title',      // Identification
    'status',     // Quick status
    'content'     // Main content
    // Hide: metadata, timestamps, technical fields
  ]
}
```

## Integration Tips

### With Flows

```javascript
// Trigger flow when blocks change
on('items.update', ({ payload, keys }) => {
  if (payload.content_blocks) {
    // Process block changes
    validateBlockOrder(payload.content_blocks);
    updatePageCache(keys[0]);
  }
});
```

### With Permissions

```javascript
// Role-based block limits
const roleOptions = {
  editor: {
    maxBlocks: 10,
    isAllowedDelete: false
  },
  admin: {
    maxBlocks: null,
    isAllowedDelete: true
  }
};
```

### With Validation

```javascript
// Custom validation for blocks
validateBlocks(blocks) {
  // Ensure at least one hero block
  const hasHero = blocks.some(b => 
    b.collection === 'content_hero'
  );
  
  if (!hasHero) {
    throw new Error('Page must have a hero section');
  }
}
```

## Troubleshooting Common Scenarios

### Scenario 1: Save button stays active
**Solution**: This is fixed in the latest version with proper dirty state tracking.

### Scenario 2: Can't see block content
**Check**: 
- User has read permissions for the related collection
- Fields aren't hidden by `showFieldsFilter`
- The collection is in `allowedCollections`

### Scenario 3: Performance with many blocks
**Optimize**:
- Enable `accordionMode`
- Use `compactMode`
- Set reasonable `maxBlocks` limit
- Consider pagination for very large datasets

### Scenario 4: Blocks not saving
**Verify**:
- Parent item is saved (not in create mode)
- User has create/update permissions
- No validation errors in console

## Example 6: Development Environment Setup

### IDE Configuration for Extension Development

When developing with or extending the Expandable Blocks extension:

#### VSCode Workspace Settings

```json
// .vscode/settings.json in your Directus project
{
  "vue.inlayHints.missingProps": true,
  "vue.autoInsert.dotValue": true,
  "typescript.preferences.includePackageJsonAutoImports": "on",
  "html.customData": [
    "./extensions/interfaces/expandable-blocks/.vscode/html-custom-data.json"
  ],
  "css.customData": [
    "./extensions/interfaces/expandable-blocks/.vscode/css-custom-data.json"
  ]
}
```

#### TypeScript Configuration for Extensions

```json
// tsconfig.json for custom extensions
{
  "extends": "./extensions/interfaces/expandable-blocks/tsconfig.json",
  "compilerOptions": {
    "types": [
      "./extensions/interfaces/expandable-blocks/src/types"
    ]
  }
}
```

#### CSS Variables Usage Example

```css
/* Using Directus theme variables in custom CSS */
.my-custom-block {
  background: var(--background-normal);
  border: 1px solid var(--border-normal);
  border-radius: var(--border-radius);
  padding: var(--input-padding);
}

.my-custom-block:hover {
  border-color: var(--primary);
  box-shadow: 0 0 0 2px var(--primary-subdued);
}

/* Status-specific styling */
.block-status-published {
  border-left: 4px solid var(--success);
}

.block-status-draft {
  border-left: 4px solid var(--warning);
}
```

#### Component Extension Example

```vue
<!-- CustomBlockInterface.vue -->
<template>
  <div class="custom-blocks">
    <!-- Use documented Directus components -->
    <v-button 
      :disabled="disabled"
      @click="addCustomBlock"
    >
      <v-icon name="add" />
      Add Custom Block
    </v-button>
    
    <!-- Leverage expandable blocks structure -->
    <expandable-blocks
      v-model="blocks"
      :options="customOptions"
    />
  </div>
</template>

<script setup lang="ts">
import type { 
  ExpandableBlocksOptions,
  JunctionRecord 
} from '@/extensions/interfaces/expandable-blocks/src/types';

const customOptions: ExpandableBlocksOptions = {
  enableSorting: true,
  accordionMode: false,
  compactMode: true,
  allowedCollections: ['my_custom_blocks']
};
</script>
```

This comprehensive example guide should help you implement Expandable Blocks effectively in your Directus projects!