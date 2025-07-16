# Examples & Use Cases

This page provides practical examples of using the Expandable Blocks extension in various scenarios.

## 📄 Example 1: Page Builder System

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

-- Content block types
CREATE TABLE content_hero (
  id serial PRIMARY KEY,
  headline varchar(255),
  subheadline text,
  background_image uuid,
  cta_text varchar(100),
  cta_link varchar(255)
);

CREATE TABLE content_text (
  id serial PRIMARY KEY,
  title varchar(255),
  content text,
  columns integer DEFAULT 1
);

CREATE TABLE content_gallery (
  id serial PRIMARY KEY,
  title varchar(255),
  images json,
  layout varchar(20) DEFAULT 'grid'
);
```

### Directus Configuration

```javascript
{
  field: 'content_blocks',
  type: 'm2a',
  interface: 'expandable-blocks',
  options: {
    enableSorting: true,
    startExpanded: false,
    accordionMode: false,
    showItemId: false,
    compactMode: false,
    allowDelete: true,
    allowDuplicate: true,
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

### Result Structure

```javascript
{
  id: 1,
  title: "About Us",
  slug: "about-us",
  content_blocks: [
    {
      id: 1,
      collection: "content_hero",
      item: {
        headline: "Welcome to Our Company",
        subheadline: "Leading innovation since 2020"
      }
    },
    {
      id: 2,
      collection: "content_text",
      item: {
        title: "Our Story",
        content: "<p>Rich text content...</p>"
      }
    }
  ]
}
```

## 🛍️ Example 2: Product Variants

### Configuration

```javascript
{
  field: 'variants',
  interface: 'expandable-blocks',
  options: {
    enableSorting: false,      // Variants don't need sorting
    startExpanded: true,       // Show all variants
    accordionMode: false,      // View multiple at once
    compactMode: true,         // Compact view
    showItemId: true,          // Show SKU
    allowDelete: true,
    allowDuplicate: true,
    maxBlocks: 20,
    allowedCollections: ['product_variants']
  }
}
```

### Use Cases

1. **Quick Duplicate**: Clone a variant and change size/color
2. **Bulk Status**: Change availability across variants
3. **Price Updates**: Edit prices inline
4. **Stock Management**: Update inventory levels

## ❓ Example 3: FAQ Management

### Configuration

```javascript
{
  field: 'faq_items',
  interface: 'expandable-blocks',
  options: {
    enableSorting: true,       // Reorder FAQs
    startExpanded: false,      // Collapsed view
    accordionMode: true,       // One FAQ at a time
    compactMode: false,
    showItemId: false,
    allowDelete: true,
    allowDuplicate: true,
    allowedCollections: ['faq_questions']
  }
}
```

### FAQ Collection

```javascript
{
  collection: 'faq_questions',
  fields: [
    { field: 'question', type: 'string', interface: 'input' },
    { field: 'answer', type: 'text', interface: 'input-rich-text' },
    { field: 'category', type: 'string', interface: 'select-dropdown' },
    { field: 'helpful_count', type: 'integer', interface: 'input' }
  ]
}
```

## 🎨 Example 4: Design System Components

### Multi-Collection Setup

```javascript
{
  field: 'design_blocks',
  interface: 'expandable-blocks',
  options: {
    enableSorting: true,
    accordionMode: false,
    allowedCollections: [
      'component_button',      // CTA buttons
      'component_card',        // Info cards
      'component_testimonial', // Customer quotes
      'component_stats',       // Number displays
      'component_timeline'     // Process steps
    ]
  }
}
```

### Component Examples

**Button Component**:
```javascript
{
  text: "Get Started",
  link: "/signup",
  style: "primary",
  size: "large",
  icon: "arrow-right"
}
```

**Testimonial Component**:
```javascript
{
  quote: "Amazing product!",
  author: "Jane Doe",
  company: "Tech Corp",
  avatar: "uuid-here",
  rating: 5
}
```

## 📝 Example 5: Form Builder

### Dynamic Form Configuration

```javascript
{
  field: 'form_fields',
  interface: 'expandable-blocks',
  options: {
    enableSorting: true,
    startExpanded: false,
    allowedCollections: [
      'form_text_field',
      'form_select_field',
      'form_checkbox_field',
      'form_file_field'
    ]
  }
}
```

### Field Types

```javascript
// Text Field
{
  collection: 'form_text_field',
  item: {
    label: "Full Name",
    name: "full_name",
    type: "text",
    required: true,
    placeholder: "Enter your name"
  }
}

// Select Field
{
  collection: 'form_select_field',
  item: {
    label: "Country",
    name: "country",
    options: ["USA", "Canada", "UK"],
    required: true
  }
}
```

## 🏆 Best Practices

### 1. Collection Naming

```javascript
// Good: Descriptive and prefixed
'content_hero'
'content_text'
'product_variant'

// Avoid: Generic names
'block1'
'item'
'content'
```

### 2. Field Configuration

```javascript
// Optimize for use case
{
  // For content blocks
  enableSorting: true,
  accordionMode: false,
  
  // For variants
  enableSorting: false,
  compactMode: true,
  
  // For FAQs
  accordionMode: true,
  startExpanded: false
}
```

### 3. Performance Tips

```javascript
// Limit blocks for better performance
{
  maxBlocks: 50,              // Reasonable limit
  startExpanded: false,       // Don't expand all
  compactMode: true           // For many items
}
```

### 4. Status Indicators

```javascript
// Add status field to all blocks
{
  field: 'status',
  type: 'string',
  interface: 'select-dropdown',
  options: {
    choices: [
      { text: 'Draft', value: 'draft' },
      { text: 'Published', value: 'published' },
      { text: 'Archived', value: 'archived' }
    ]
  }
}
```

## 🌐 Frontend Integration

### Fetching Data

```javascript
// Using Directus SDK
const { data } = await directus.items('pages').readOne(1, {
  fields: ['*', 'content_blocks.*', 'content_blocks.item.*']
});

// Process blocks
data.content_blocks.forEach(block => {
  switch(block.collection) {
    case 'content_hero':
      renderHero(block.item);
      break;
    case 'content_text':
      renderText(block.item);
      break;
    // ... other block types
  }
});
```

### React Component Example

```jsx
function BlockRenderer({ blocks }) {
  return blocks.map(block => {
    const Component = blockComponents[block.collection];
    return Component ? (
      <Component key={block.id} {...block.item} />
    ) : null;
  });
}

const blockComponents = {
  content_hero: HeroBlock,
  content_text: TextBlock,
  content_gallery: GalleryBlock
};
```

### Vue Component Example

```vue
<template>
  <component
    v-for="block in blocks"
    :key="block.id"
    :is="getBlockComponent(block.collection)"
    v-bind="block.item"
  />
</template>

<script setup>
const blockComponents = {
  content_hero: () => import('./blocks/HeroBlock.vue'),
  content_text: () => import('./blocks/TextBlock.vue'),
  content_gallery: () => import('./blocks/GalleryBlock.vue')
};

function getBlockComponent(collection) {
  return blockComponents[collection];
}
</script>
```

---

> **Next**: Learn how to [[Contributing|09-Contributing]] or check the [[Roadmap|10-Roadmap]]