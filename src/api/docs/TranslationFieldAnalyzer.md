# TranslationFieldAnalyzer Documentation

## Overview

The TranslationFieldAnalyzer is a specialized service for analyzing and managing translation patterns in Directus collections. It provides comprehensive translation detection, field mapping, and multi-language support.

## Purpose

Directus supports multiple translation patterns:
1. **Translation Tables** - Separate tables with `*_translations` naming
2. **JSON Fields** - Single fields storing translations as JSON objects
3. **Combined** - Multiple source fields translated into single translation fields
4. **Hybrid** - Combination of table and JSON approaches

The TranslationFieldAnalyzer:
- Detects which translation pattern is used
- Maps fields between main and translation tables
- Identifies translatable fields
- Provides translation coverage analysis
- Manages language information

## Architecture

```
┌─────────────────────┐
│   HTTP Endpoint     │
└──────────┬──────────┘
           │
           ▼
┌─────────────────────┐     ┌─────────────────────┐
│  FieldAnalyzer      │────▶│TranslationField     │
│                     │     │   Analyzer          │
└─────────────────────┘     └──────────┬──────────┘
                                      │
                                      ▼
                            ┌─────────────────────┐
                            │ Translation Tables  │
                            │ & JSON Fields       │
                            └─────────────────────┘
```

## Core Concepts

### 1. **Translation Patterns**

#### Table-based Translations
```
pages                    pages_translations
├── id                  ├── id
├── slug                ├── pages_id (link)
├── status              ├── languages_code
└── template            ├── title
                        ├── content
                        └── meta_description
```

#### JSON-based Translations
```
products
├── id
├── sku
├── price
└── name: {
      "en": "Product Name",
      "de": "Produktname",
      "fr": "Nom du produit"
    }
```

### 2. **TranslationInfo Structure**
```typescript
{
  hasTranslations: boolean;
  translationType: 'table' | 'json' | 'combined' | 'hybrid' | 'none';
  translationTable?: string;
  linkField?: string;
  languageField?: string;
  translationFields?: TranslationField[];
  availableLanguages?: Language[];
  fieldMapping?: TranslationFieldMapping[];
  isCombinedTranslation?: boolean;
  sourceFields?: string[];
}
```

**Translation Types:**
- `table`: Standard table-based translations with 1:1 field mapping
- `json`: JSON-based translations in a single field
- `combined`: Multiple source fields translated into single translation fields (e.g., all text content in one translation field)
- `hybrid`: Collection uses both table-based and JSON translations
- `none`: No translations detected

### 3. **Field Mapping**
The analyzer intelligently maps fields between main and translation tables, even when names don't match exactly.

## API Reference

### Constructor
```typescript
const analyzer = new TranslationFieldAnalyzer({
  database: knex,
  services: directusServices,
  schema?: directusSchema,
  accountability?: req.accountability,
  assumeCombinedPattern?: boolean  // Default: true
});
```

### Main Methods

#### analyzeCollection()
```typescript
async analyzeCollection(
  collection: string,
  options?: TranslationAnalysisOptions
): Promise<TranslationInfo>
```

Performs complete translation analysis of a collection.

**Options:**
- `includeFieldMapping`: Create field mappings (default: false)
- `includeLanguages`: Include available languages (default: false)
- `detectHybrid`: Detect hybrid translation setups (default: false)
- `translationTablePattern`: Custom pattern for translation tables
- `excludeFields`: Fields to exclude from analysis

#### hasTranslations()
```typescript
async hasTranslations(collection: string): Promise<boolean>
```

Quick check if a collection has any form of translations.

#### getTranslatableFields()
```typescript
async getTranslatableFields(collection: string): Promise<TranslationField[]>
```

Get all fields that can be translated.

#### getAvailableLanguages()
```typescript
async getAvailableLanguages(): Promise<Language[]>
```

Get all languages configured in Directus.

#### getTranslationCoverage()
```typescript
async getTranslationCoverage(collection: string): Promise<TranslationCoverage>
```

Analyze translation coverage and identify missing translations.

## Usage Examples

### Basic Analysis
```typescript
const analyzer = new TranslationFieldAnalyzer({
  database,
  services
});

// Analyze a collection
const info = await analyzer.analyzeCollection('pages');

if (info.hasTranslations) {
  console.log(`Translation type: ${info.translationType}`);
  if (info.translationType === 'table') {
    console.log(`Table: ${info.translationTable}`);
  }
}
```

### Get Translatable Fields
```typescript
const translatableFields = await analyzer.getTranslatableFields('products');

translatableFields.forEach(field => {
  console.log(`Field: ${field.field}`);
  console.log(`Method: ${field.translationMethod}`);
  if (field.translationTableFields) {
    console.log(`Maps to: ${field.translationTableFields.join(', ')}`);
  }
});
```

### Complete Analysis with Mapping
```typescript
const fullAnalysis = await analyzer.analyzeCollection('pages', {
  includeFieldMapping: true,
  includeLanguages: true
});

// Field mapping
fullAnalysis.fieldMapping?.forEach(mapping => {
  console.log(`${mapping.sourceField} -> ${mapping.translationField}`);
  console.log(`Confidence: ${mapping.confidence}`);
});

// Available languages
fullAnalysis.availableLanguages?.forEach(lang => {
  console.log(`${lang.code}: ${lang.name}`);
});
```

### Check Translation Coverage
```typescript
const coverage = await analyzer.getTranslationCoverage('products');

console.log(`Coverage: ${coverage.coveragePercent}%`);
console.log(`${coverage.translatedFields}/${coverage.totalFields} fields translated`);

coverage.missingTranslations.forEach(missing => {
  console.log(`Field '${missing.field}' missing: ${missing.languages.join(', ')}`);
});
```

### Integration with FieldAnalyzer
```typescript
const fieldAnalyzer = new FieldAnalyzer({
  services,
  schema,
  database
});

const translationAnalyzer = new TranslationFieldAnalyzer({
  database,
  services,
  schema
});

// Get searchable fields with translation info
const fields = await fieldAnalyzer.getSearchableFields('pages', {
  includeTranslations: true
});

// Get detailed translation info
const translationInfo = await translationAnalyzer.analyzeCollection('pages');
```

## Translation Pattern Detection

The analyzer uses intelligent pattern detection:

1. **Standard Patterns**: `{collection}_translations`, `{collection}_trans`
2. **Custom Patterns**: Can be specified via options
3. **Link Field Detection**: `{collection}_id`, `parent_id`, `item_id`
4. **Language Field Detection**: `languages_code`, `locale`, `lang`

## Field Mapping Strategy

When field names don't match between tables:

1. **Exact Match**: Direct name matching (confidence: 1.0)
2. **Type Match**: Same data type (confidence: 0.8)
3. **Pattern Match**: Similar naming patterns (confidence: 0.6)
4. **Fallback**: All text fields map to all translation fields (confidence: 0.5)

## Performance Considerations

### Caching
```typescript
// Cache translation info for repeated calls
const translationCache = new Map();

async function getCachedTranslationInfo(collection: string) {
  if (!translationCache.has(collection)) {
    const info = await analyzer.analyzeCollection(collection);
    translationCache.set(collection, info);
  }
  return translationCache.get(collection);
}
```

### Batch Analysis
```typescript
// Analyze multiple collections efficiently
const collections = ['pages', 'products', 'categories'];
const results = await Promise.all(
  collections.map(c => analyzer.analyzeCollection(c))
);
```

## Best Practices

1. **Use Caching**: Translation patterns rarely change
2. **Specify Options**: Only request needed data (fieldMapping, languages)
3. **Handle Edge Cases**: Not all collections have translations
4. **Validate Languages**: Ensure language codes are valid
5. **Monitor Coverage**: Use coverage analysis to find gaps

## Common Patterns

### Multi-language Content Site
```typescript
// Pages with full translation table
const pagesInfo = await analyzer.analyzeCollection('pages', {
  includeFieldMapping: true,
  includeLanguages: true
});

// Products with JSON translations
const productsInfo = await analyzer.analyzeCollection('products');
```

### E-commerce Catalog
```typescript
// Check which collections need translation
const collections = ['products', 'categories', 'brands'];
for (const collection of collections) {
  const hasTranslations = await analyzer.hasTranslations(collection);
  if (!hasTranslations) {
    console.log(`${collection} needs translation setup`);
  }
}
```

## Error Handling

```typescript
try {
  const info = await analyzer.analyzeCollection('my_collection');
} catch (error) {
  console.error('Translation analysis failed:', error);
  // Fallback to no translations
}
```

## Future Enhancements

1. **Auto-detection of Custom Patterns**
2. **Translation Synchronization**
3. **Missing Translation Reports**
4. **Translation Quality Metrics**
5. **Import/Export Translation Support**