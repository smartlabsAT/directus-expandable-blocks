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
       // Display Options
       enableSorting: true,
       startExpanded: false,
       accordionMode: false,
       showItemId: true,
       showCollectionName: true,
       compactMode: false,
       
       // Permissions & Actions
       isAllowedDelete: true,
       isAllowedDuplicate: true,
       allowLinkExisting: true,
       allowDuplicateExisting: true,
       maxBlocks: null,
       
       // Collections Configuration
       collection: [
         'content_hero',
         'content_text',
         'content_gallery',
         'content_video',
         'content_cta'
       ],
       allowedCollectionsExisting: [
         'shared_content_library',
         'content_templates'
       ],
       
       // Role-Based Permissions (optional)
       rolesCanCreate: ['admin', 'editor'],
       rolesCanUpdate: ['admin', 'editor', 'contributor'],
       rolesCanDelete: ['admin'],
       rolesCanSort: ['admin', 'editor']
     }
   }
   ```

2. **Permission Configuration:**
   ```javascript
   // For editors - limited permissions
   {
     isAllowedDelete: false,     // Cannot delete blocks
     isAllowedDuplicate: true,   // Can duplicate
     allowLinkExisting: true,    // Can add from library
     allowDuplicateExisting: false, // Cannot duplicate library items
     maxBlocks: 10,              // Limit to 10 blocks
     
     // Role-based restrictions
     rolesCanDelete: ['admin'],
     rolesCanCreate: ['admin', 'editor'],
     rolesCanSort: ['admin', 'editor']
   }
   
   // For admins - full permissions
   {
     isAllowedDelete: true,
     isAllowedDuplicate: true,
     allowLinkExisting: true,
     allowDuplicateExisting: true,
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

## Example 6: Using Add Existing Items Feature

### Shared Content Library Setup

```javascript
{
  field: 'page_sections',
  interface: 'expandable-blocks',
  options: {
    // Allow both new creation and linking existing
    collection: ['content_text', 'content_image', 'content_video'],
    allowedCollectionsExisting: [
      'shared_content_library',  // Pre-made content blocks
      'content_templates',       // Reusable templates
      'global_sections'          // Site-wide sections
    ],
    
    allowLinkExisting: true,
    allowDuplicateExisting: true, // Clone library items
    
    // Configure item selector
    itemSelectorOptions: {
      showSearch: true,
      showFieldSelection: true,
      defaultFields: ['title', 'preview', 'category'],
      itemsPerPage: 20,
      enableTableView: true
    }
  }
}
```

### Search and Filter Examples

```javascript
// Advanced search with field-specific queries
"title:Hero AND category:homepage"
"status:published OR featured:true"
"created_date:>2024-01-01"

// Simple search across all fields
"hero banner"
"contact form"
```

## Example 7: Translation Support

### Multi-language Content Blocks

```javascript
{
  field: 'localized_content',
  interface: 'expandable-blocks',
  options: {
    enableTranslations: true,
    collection: ['content_translated'],
    
    // Translation-specific options
    translationOptions: {
      defaultLanguage: 'en-US',
      showLanguageSelector: true,
      showTranslationIndicators: true
    }
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
  compactMode: true,       // Reduce visual space
  
  // Optimize item selector for large datasets
  itemSelectorOptions: {
    itemsPerPage: 50,      // Paginate results
    enableTableView: true,  // Faster scanning
    cacheSearch: true      // Cache search results
  }
}
```

### 2. User Experience

```javascript
// For critical content, limit destructive actions
{
  isAllowedDelete: false,   // Prevent deletion
  maxBlocks: 5,             // Limit complexity
  
  // Helpful UI options
  showCollectionName: true, // Clear block type indication
  showItemId: false,        // Hide technical IDs
  
  // Guide users with permissions
  rolesCanDelete: ['admin'], // Only admins can delete
  permissionMessages: {
    noDelete: 'Contact an admin to remove blocks',
    readOnly: 'You have view-only access to this block'
  }
}
```

### 3. Content Types

```javascript
// Separate new vs existing collections
{
  // Collections for creating new blocks
  collection: [
    'content_text',         // Basic content
    'content_image',        // Media
    'content_video',
    'content_embed',        // External
    'content_code'
  ],
  
  // Collections for linking existing items
  allowedCollectionsExisting: [
    'shared_components',    // Reusable components
    'brand_assets',         // Company assets
    'legal_disclaimers'     // Compliance content
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
- Check role-based permissions in interface options

### Scenario 5: Can't add existing items
**Check**:
- `allowLinkExisting` is set to true
- `allowedCollectionsExisting` includes target collections
- User has read permission on source collection
- Collections are properly configured in M2A relationship

### Scenario 6: Search not finding items
**Solutions**:
- Use field-specific search: `title:searchterm`
- Check if fields are included in API search configuration
- Verify translation fields are properly indexed
- Try simple search without operators first

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
} from 'directus-extension-expandable-blocks/types';

const customOptions: ExpandableBlocksOptions = {
  enableSorting: true,
  accordionMode: false,
  compactMode: true,
  collection: ['my_custom_blocks'],
  allowedCollectionsExisting: ['shared_blocks'],
  allowLinkExisting: true,
  
  // Role-based permissions
  rolesCanCreate: ['admin', 'editor'],
  rolesCanUpdate: ['admin', 'editor', 'contributor'],
  rolesCanDelete: ['admin'],
  rolesCanSort: ['admin', 'editor']
};
</script>
```

### API Usage Example

```javascript
// Using the bundle's API endpoints
const searchItems = async (collection, query) => {
  const response = await fetch(
    `/expandable-blocks-api/${collection}/search?` + 
    new URLSearchParams({
      q: query,
      limit: 20,
      fields: ['id', 'title', 'status']
    })
  );
  return response.json();
};

// Get items with full relations
const getItemsWithRelations = async (collection, ids) => {
  const response = await fetch(
    `/expandable-blocks-api/${collection}/items`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ ids, depth: 2 })
    }
  );
  return response.json();
};
```

This comprehensive example guide should help you implement Expandable Blocks effectively in your Directus projects!