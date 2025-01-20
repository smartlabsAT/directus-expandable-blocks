# FieldAnalyzer Documentation

## Overview

The FieldAnalyzer is a service that analyzes Directus collection fields to identify searchable, filterable, and usable fields. It provides intelligent field filtering, metadata enrichment, and categorization capabilities.

## Purpose

When working with Directus collections, you often need to:
- Identify which fields are suitable for search operations
- Filter out system fields and non-data fields
- Get field metadata for UI display
- Group fields by type or interface
- Determine field display priorities

The FieldAnalyzer provides all of this functionality in a reusable service.

## Architecture

```
┌─────────────────────┐
│   HTTP Endpoint     │
└──────────┬──────────┘
           │
           ▼
┌─────────────────────┐
│   FieldAnalyzer     │
│     Service         │
└──────────┬──────────┘
           │
           ▼
┌─────────────────────┐
│  Directus           │
│  FieldsService      │
└──────────┬──────────┘
           │
           ▼
┌─────────────────────┐
│ Collection Schema   │
└─────────────────────┘
```

## Core Concepts

### 1. **SearchableField**
Represents a field that can be used for searching/filtering:
```typescript
{
  field: string;           // Field key
  name: string;           // Display name
  type: string;           // Data type
  interface?: string;     // UI interface
  note?: string;          // Description
  display_priority?: number; // UI ordering
  required?: boolean;
  readonly?: boolean;
  hidden?: boolean;
  options?: any;          // Field options (e.g., choices for select)
  conditions?: any;       // Conditional display rules
  validation?: any;       // Validation rules
  default_value?: any;    // Default value
  width?: string;         // Field width in form
  special?: string[];     // Special field flags
  translations?: any;     // Field translations
  display_options?: any;  // Display configuration
  meta?: any;            // Complete metadata object
  schema?: any;          // Database schema info
}
```

### 2. **Field Categories**
- **System Fields**: `id`, `date_created`, `user_updated`, etc.
- **Data Fields**: Fields that store actual data
- **Non-Data Fields**: `alias`, `presentation` types
- **Searchable Fields**: Text fields suitable for full-text search

### 3. **Display Priority**
Fields are automatically prioritized:
- **High Priority (100)**: `title`, `name`, `label`, `headline`
- **Medium Priority (50)**: `slug`, `description`, `subtitle`
- **Normal Priority (0)**: All other fields
- **Boosted**: Required fields (+10), Text fields (+5)

## API Reference

### Constructor
```typescript
const analyzer = new FieldAnalyzer({
  services: directusServices,
  schema: directusSchema,
  database?: knex,           // Optional
  accountability?: req.accountability  // Optional
});
```

### Main Methods

#### getSearchableFields()
```typescript
async getSearchableFields(
  collection: string,
  options?: FieldAnalyzerOptions
): Promise<SearchableField[]>
```

Get filtered and enriched searchable fields.

**Options:**
- `includeSystem`: Include system fields (default: false)
- `includeReadonly`: Include readonly fields (default: true)
- `includeHidden`: Include hidden fields (default: false)
- `includeNonData`: Include alias/presentation fields (default: false)
- `sortByPriority`: Sort by display priority (default: true)
- `types`: Filter by field types
- `interfaces`: Filter by interface types
- `includeMetadata`: Include full metadata (default: true)
- `includeSchema`: Include schema information (default: false)
- `includeTranslations`: Include translation information (default: true)
- `onlyTranslatable`: Only return translatable fields (default: false)
- `language`: Preferred language for display names

#### getAllFields()
```typescript
async getAllFields(collection: string): Promise<any[]>
```

Get all fields without filtering (raw from FieldsService).

#### hasSearchableFields()
```typescript
async hasSearchableFields(collection: string): Promise<boolean>
```

Check if a collection has any searchable fields.

#### getField()
```typescript
async getField(
  collection: string,
  fieldName: string
): Promise<SearchableField | null>
```

Get a specific field by name.

### Specialized Methods

#### getTextSearchableFields()
```typescript
async getTextSearchableFields(collection: string): Promise<SearchableField[]>
```

Get only text-based fields suitable for full-text search.

#### getNumericFields()
```typescript
async getNumericFields(collection: string): Promise<SearchableField[]>
```

Get only numeric fields (integer, float, decimal).

#### getDateTimeFields()
```typescript
async getDateTimeFields(collection: string): Promise<SearchableField[]>
```

Get only date/time fields.

#### getSelectFields()
```typescript
async getSelectFields(collection: string): Promise<SearchableField[]>
```

Get select/dropdown fields with their choice values.

#### getRelationFields()
```typescript
async getRelationFields(collection: string): Promise<SearchableField[]>
```

Get relation fields (M2O, O2M, M2M, M2A) with configuration.

#### getValidatedFields()
```typescript
async getValidatedFields(collection: string): Promise<SearchableField[]>
```

Get fields that have validation rules.

#### getConditionalFields()
```typescript
async getConditionalFields(collection: string): Promise<SearchableField[]>
```

Get fields with conditional display rules.

#### getFieldConfiguration()
```typescript
async getFieldConfiguration(
  collection: string,
  fieldName: string
): Promise<any>
```

Get complete configuration for a specific field.

#### hasTranslations()
```typescript
async hasTranslations(collection: string): Promise<boolean>
```

Check if a collection has translation support (table or JSON-based).

#### getTranslatableFields()
```typescript
async getTranslatableFields(collection: string): Promise<SearchableField[]>
```

Get only fields that can be translated.

#### getAvailableLanguages()
```typescript
async getAvailableLanguages(): Promise<Language[]>
```

Get available languages from Directus.

#### getTranslationTableFields()
```typescript
async getTranslationTableFields(collection: string): Promise<SearchableField[]>
```

Get fields from the translation table.

#### getTranslationFieldMap()
```typescript
async getTranslationFieldMap(collection: string): Promise<TranslationFieldMap[]>
```

Get mapping between main fields and translation fields.

#### getFieldsByType()
```typescript
async getFieldsByType(
  collection: string,
  options?: FieldAnalyzerOptions
): Promise<Record<string, SearchableField[]>>
```

Get fields grouped by their data type.

#### getFieldsByInterface()
```typescript
async getFieldsByInterface(
  collection: string,
  options?: FieldAnalyzerOptions
): Promise<Record<string, SearchableField[]>>
```

Get fields grouped by their interface type.

## Usage Examples

### Basic Usage
```typescript
const analyzer = new FieldAnalyzer({
  services,
  schema
});

// Get all searchable fields
const fields = await analyzer.getSearchableFields('products');
```

### Include System Fields
```typescript
const fields = await analyzer.getSearchableFields('products', {
  includeSystem: true
});
```

### Get Only Text Fields
```typescript
const textFields = await analyzer.getTextSearchableFields('articles');
// Returns only string, text, and json fields
```

### Get Fields by Type
```typescript
const fieldsByType = await analyzer.getFieldsByType('products');
/*
{
  string: [{ field: 'name', ... }, { field: 'sku', ... }],
  integer: [{ field: 'stock', ... }],
  decimal: [{ field: 'price', ... }]
}
*/
```

### Filter by Interface
```typescript
const fields = await analyzer.getSearchableFields('content', {
  interfaces: ['input', 'textarea', 'select-dropdown']
});
```

### Complete Example
```typescript
// In an endpoint
router.get('/fields/:collection', async (req, res) => {
  const { collection } = req.params;
  const { includeHidden, types } = req.query;

  const analyzer = new FieldAnalyzer({
    services: context.services,
    schema: await context.getSchema(),
    accountability: req.accountability
  });

  try {
    const searchableFields = await analyzer.getSearchableFields(collection, {
      includeHidden: includeHidden === 'true',
      types: types ? types.split(',') : [],
      includeMetadata: true
    });

    const textFields = await analyzer.getTextSearchableFields(collection);
    const fieldsByType = await analyzer.getFieldsByType(collection);

    res.json({
      searchable: searchableFields,
      textSearchable: textFields,
      byType: fieldsByType,
      total: searchableFields.length
    });
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
});
```

### Working with Select Fields
```typescript
// Get select fields with their choices
const selectFields = await analyzer.getSelectFields('products');

for (const field of selectFields) {
  console.log(`Field: ${field.field}`);
  if (field.options?.choices) {
    field.options.choices.forEach(choice => {
      console.log(`  - ${choice.value}: ${choice.text}`);
    });
  }
}
```

### Working with Relation Fields
```typescript
// Get all relation fields
const relationFields = await analyzer.getRelationFields('pages');

relationFields.forEach(field => {
  console.log(`Relation field: ${field.field}`);
  console.log(`Type: ${field.interface}`);
  if (field.options?.template) {
    console.log(`Display template: ${field.options.template}`);
  }
});
```

### Getting Complete Field Configuration
```typescript
// Get full configuration for a specific field
const statusField = await analyzer.getFieldConfiguration('products', 'status');

if (statusField?.meta?.options?.choices) {
  console.log('Status options:');
  statusField.meta.options.choices.forEach(choice => {
    console.log(`${choice.value}: ${choice.text}`);
  });
}
```

### Working with Translations
```typescript
// Check if collection has translations
const hasTranslations = await analyzer.hasTranslations('pages');

// Get translatable fields
const translatableFields = await analyzer.getTranslatableFields('pages');
translatableFields.forEach(field => {
  console.log(`${field.field}: ${field.translation_type}`);
  if (field.translation_table) {
    console.log(`  Table: ${field.translation_table}`);
  }
});

// Get available languages
const languages = await analyzer.getAvailableLanguages();
languages.forEach(lang => {
  console.log(`${lang.code}: ${lang.name}`);
});

// Get only translatable fields in searchable fields
const searchableTranslatable = await analyzer.getSearchableFields('pages', {
  onlyTranslatable: true
});
```

## Field Type Reference

### Data Types
- `string`: Short text
- `text`: Long text
- `integer`: Whole numbers
- `bigInteger`: Large whole numbers
- `float`: Decimal numbers
- `decimal`: Precise decimal numbers
- `boolean`: True/false
- `date`: Date only
- `dateTime`: Date and time
- `timestamp`: Unix timestamp
- `json`: JSON data
- `uuid`: UUID strings

### Non-Data Types
- `alias`: Computed/virtual fields
- `presentation`: Display-only elements

## Integration with Other Services

### With ItemLoader
```typescript
const analyzer = new FieldAnalyzer({ services, schema });
const loader = new ItemLoader({ database, schema, services });

// Get searchable fields
const searchableFields = await analyzer.getSearchableFields('products');

// Use field names for selective loading
const fieldNames = searchableFields.map(f => f.field);
const items = await loader.loadItems('products', {
  fields: fieldNames
});
```

### With RelationAnalyzer
```typescript
// Find where collection is used
const locations = await relationAnalyzer.getPossibleUsageLocations('products');

// Get searchable fields for each location
for (const location of locations) {
  const fields = await fieldAnalyzer.getSearchableFields(location.collection);
  console.log(`${location.collection} has ${fields.length} searchable fields`);
}
```

## Performance Considerations

### 1. **Caching**
The FieldAnalyzer doesn't cache by default. For high-traffic applications:
```typescript
// Implement caching wrapper
const fieldCache = new Map();

async function getCachedFields(collection: string) {
  const key = `fields:${collection}`;
  if (!fieldCache.has(key)) {
    const fields = await analyzer.getSearchableFields(collection);
    fieldCache.set(key, fields);
  }
  return fieldCache.get(key);
}
```

### 2. **Batch Operations**
When analyzing multiple collections:
```typescript
// Efficient
const collections = ['products', 'categories', 'brands'];
const allFields = await Promise.all(
  collections.map(c => analyzer.getSearchableFields(c))
);

// Less efficient
for (const collection of collections) {
  const fields = await analyzer.getSearchableFields(collection);
}
```

## Error Handling

### Collection Not Found
```typescript
try {
  const fields = await analyzer.getSearchableFields('non_existent');
} catch (error) {
  if (error instanceof InvalidCollectionError) {
    // Handle missing collection
  }
}
```

### Permission Errors
```typescript
// Pass accountability for permission checks
const analyzer = new FieldAnalyzer({
  services,
  schema,
  accountability: req.accountability
});
```

## Best Practices

1. **Use Specific Methods**: Use `getTextSearchableFields()` instead of filtering manually
2. **Cache Results**: Field schemas rarely change, cache when possible
3. **Filter Early**: Use options to filter at service level
4. **Handle Errors**: Always wrap in try-catch for collection errors
5. **Consider Performance**: Batch operations when analyzing multiple collections

## Translation Support

### Translation Patterns in Directus

1. **Translation Tables** (`*_translations`)
   - Separate table with `<collection>_translations` naming
   - Contains translated versions of fields
   - Linked via `<collection>_id` and `languages_code`

2. **JSON-based Translations**
   - Single field storing translations as JSON
   - Format: `{"en": "English", "de": "Deutsch"}`
   - Uses `translations` interface

### Translation Field Properties

```typescript
{
  field: 'title',
  translatable: true,
  translation_type: 'table',  // or 'json'
  translation_table: 'pages_translations',
  available_languages: ['en', 'de', 'fr']
}
```

## Future Enhancements

1. **Field Validation**
   - Validate field values against schema
   - Check field constraints

2. **Search Optimization**
   - Suggest optimal fields for search
   - Index recommendations

3. **Field Relationships**
   - Analyze field dependencies
   - Track computed field sources

4. **Advanced Translation Support**
   - Auto-detect translation patterns
   - Support for custom translation implementations
   - Translation coverage analysis