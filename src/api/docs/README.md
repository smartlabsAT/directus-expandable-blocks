# RelationAnalyzer Documentation

This directory contains comprehensive documentation for the RelationAnalyzer service.

## 📚 Documentation Structure

### [RelationAnalyzer.md](./RelationAnalyzer.md)
Complete overview of the RelationAnalyzer service including:
- Architecture and design
- Core concepts and terminology  
- Implementation details
- Common use cases
- Debugging tips

### [API-Reference.md](./API-Reference.md)
Quick reference for the HTTP API:
- Endpoint documentation
- Request/response formats
- Field descriptions
- Error handling
- Usage examples

### [Developer-Guide.md](./Developer-Guide.md)
Guide for developers extending the service:
- Project structure
- Adding new features
- Testing strategies
- Performance optimization
- Security best practices
- Common pitfalls

## 🚀 Quick Start

```typescript
// Basic usage
const analyzer = new RelationAnalyzer({ database });
const locations = await analyzer.getPossibleUsageLocations('my_collection');

// With options
const locations = await analyzer.getPossibleUsageLocations('directus_files', {
  includeSystem: true,
  includeHidden: false
});
```

## 🎯 Main Purpose

The RelationAnalyzer helps answer critical questions about your Directus schema:

1. **"Where is this collection used?"**
   - Find all collections that reference your target collection
   - See which specific fields create the references

2. **"What type of relations exist?"**
   - M2A (Many-to-Any) with junction tables
   - M2O (Many-to-One) with foreign keys
   - O2M (One-to-Many) reverse relations

3. **"How are translations connected?"**
   - Automatic detection of translation tables
   - Synthetic relation creation for consistency

## 📋 Key Features

- ✅ **Complete Relation Analysis** - Finds all usage locations
- ✅ **Translation Support** - Handles Directus translation pattern
- ✅ **Performance Optimized** - Batch queries for efficiency
- ✅ **Type Safe** - Full TypeScript support
- ✅ **Extensible** - Easy to add new features
- ✅ **Well Documented** - Comprehensive docs and examples

## 🔧 Integration

The service integrates seamlessly with the Directus extensions system:

```typescript
// In your endpoint
router.get('/:collection', async (req, res) => {
  const analyzer = new RelationAnalyzer({
    database: context.database
  });
  
  const locations = await analyzer.getPossibleUsageLocations(
    req.params.collection
  );
  
  res.json(locations);
});
```

## 📝 Notes

- Currently part of the `expandable-blocks` extension
- Can be extracted as a standalone service
- No external dependencies beyond Knex
- Compatible with Directus v11.0.0+

## 🤝 Contributing

When adding new features:
1. Update the relevant documentation
2. Add examples to API-Reference.md
3. Document pitfalls in Developer-Guide.md
4. Keep the main overview current

## 📞 Support

For questions or issues:
1. Check the debugging tips in RelationAnalyzer.md
2. Review common pitfalls in Developer-Guide.md
3. Examine the error handling section
4. Look at the implementation source code