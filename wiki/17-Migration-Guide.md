# Migration Guide

This guide helps you migrate from Directus' standard M2A interface to the Expandable Blocks extension.

## 🚀 Quick Start Migration

### From Standard M2A Interface

Migrating to Expandable Blocks is straightforward and requires no data changes:

1. **Install the Extension**
   ```bash
   npm install directus-extension-expandable-blocks
   ```

2. **Change the Interface Type**
   - Navigate to Settings → Data Model → Your Collection
   - Find your M2A field
   - Change interface from `list-m2a` to `expandable-blocks`
   - Save changes

3. **Configure Options** (Optional)
   - Enable/disable features as needed
   - Set permissions and limits
   - Customize display options

4. **No Data Migration Required**
   - All existing data is preserved
   - Relationships remain intact
   - No database changes needed

## 📊 Version Compatibility

### Directus Versions
- **Directus 10.x**: ✅ Fully supported
- **Directus 11.x**: ✅ Fully supported (recommended)
- **Directus 9.x**: ❌ Not supported (requires Vue 3)

### Browser Requirements
- Modern browsers with ES6 support
- Chrome 90+, Firefox 88+, Safari 14+, Edge 90+
- Mobile browsers: iOS Safari 14+, Chrome Android 90+

### Node.js Requirements
- Node.js 16.x or higher
- npm 7.x or higher (or equivalent yarn/pnpm)

## 🔄 Feature Comparison

| Feature | Standard M2A | Expandable Blocks |
|---------|--------------|-------------------|
| Inline Editing | ❌ | ✅ |
| Drag & Drop Sorting | ✅ | ✅ |
| Expand/Collapse | ❌ | ✅ |
| Dirty State Tracking | Limited | ✅ Full |
| Accordion Mode | ❌ | ✅ |
| Compact View | ❌ | ✅ |
| Permission Controls | Basic | ✅ Advanced |
| Nested M2A Display | ❌ | ✅ |
| Quick Status Updates | ❌ | ✅ |
| Individual Block Actions | ❌ | ✅ |

## 🛠️ Migration Scenarios

### Scenario 1: Basic M2A Field

**Before:**
```javascript
{
  interface: 'list-m2a',
  options: {
    template: '{{title}}'
  }
}
```

**After:**
```javascript
{
  interface: 'expandable-blocks',
  options: {
    template: '{{title}}',
    enableSorting: true,
    startExpanded: false
  }
}
```

### Scenario 2: With Custom Permissions

**Before:**
```javascript
{
  interface: 'list-m2a',
  options: {
    enableCreate: true,
    enableSelect: true
  }
}
```

**After:**
```javascript
{
  interface: 'expandable-blocks',
  options: {
    enableCreate: true,
    enableSelect: true,
    isAllowedDelete: true,
    isAllowedDuplicate: true,
    maxBlocks: 10
  }
}
```

### Scenario 3: Limited Collections

**Before:**
```javascript
{
  interface: 'list-m2a',
  special: ['m2a'],
  meta: {
    one_allowed_collections: ['posts', 'pages']
  }
}
```

**After:**
```javascript
{
  interface: 'expandable-blocks',
  special: ['m2a'],
  meta: {
    one_allowed_collections: ['posts', 'pages']
  },
  options: {
    allowedCollections: ['posts', 'pages'], // Optional override
    accordionMode: true
  }
}
```

## 🎯 Migration Best Practices

### 1. Test in Development First
- Clone your production environment
- Apply the interface change
- Test all functionality
- Verify data integrity

### 2. Gradual Rollout
- Start with non-critical fields
- Monitor user feedback
- Apply to more fields progressively
- Keep standard interface as fallback

### 3. User Training
- Document new features for users
- Highlight inline editing capabilities
- Explain accordion/compact modes
- Show drag & drop functionality

### 4. Performance Considerations
- Enable accordion mode for large datasets
- Use compact mode for better overview
- Consider lazy loading benefits
- Monitor API request patterns

## ⚠️ Common Migration Issues

### Issue 1: Permissions Not Working

**Problem:** Users can't edit blocks after migration

**Solution:**
```javascript
// Check Directus permissions for:
// 1. The M2A junction collection (read/update)
// 2. Related collections (read/update)
// 3. Individual fields (read/update)
```

### Issue 2: Display Templates Not Showing

**Problem:** Block titles show as "No item"

**Solution:**
```javascript
// Ensure display_template is set in collection meta:
{
  meta: {
    display_template: '{{title}} - {{status}}'
  }
}
```

### Issue 3: Sorting Not Working

**Problem:** Drag and drop doesn't save order

**Solution:**
```javascript
// Check if sort field exists and has proper permissions:
{
  options: {
    enableSorting: true
  },
  // Ensure junction collection has 'sort' field
}
```

## 🔧 Advanced Migration

### Custom Field Mapping

If your M2A structure differs from standard:

```javascript
// Custom junction field names
const customMapping = {
  itemField: 'related_item', // Instead of 'item'
  collectionField: 'related_collection', // Instead of 'collection'
  sortField: 'position' // Instead of 'sort'
};
```

### Programmatic Migration

For bulk migrations across multiple fields:

```typescript
async function migrateToExpandableBlocks() {
  const fields = await api.get('/fields');
  
  const m2aFields = fields.data.filter(
    field => field.meta?.interface === 'list-m2a'
  );
  
  for (const field of m2aFields) {
    await api.patch(`/fields/${field.collection}/${field.field}`, {
      meta: {
        ...field.meta,
        interface: 'expandable-blocks',
        options: {
          ...field.meta.options,
          enableSorting: true,
          startExpanded: false,
          accordionMode: true
        }
      }
    });
  }
}
```

## 📝 Rollback Procedure

If you need to rollback to standard M2A:

1. **Change Interface Back**
   ```javascript
   {
     interface: 'list-m2a', // Revert to standard
     options: {
       // Original options
     }
   }
   ```

2. **No Data Changes Required**
   - All data remains intact
   - Relationships preserved
   - Sort order maintained

3. **Clear Cache**
   - Clear browser cache
   - Restart Directus if needed

## 🆘 Migration Support

### Getting Help

1. **Documentation**: Check our comprehensive [Wiki](https://github.com/smartlabsAT/directus-expandable-blocks/wiki)
2. **Issues**: Report problems on [GitHub Issues](https://github.com/smartlabsAT/directus-expandable-blocks/issues)
3. **Community**: Join Directus Discord for community support

### Pre-Migration Checklist

- [ ] Backup your database
- [ ] Test in development environment
- [ ] Review current M2A field configuration
- [ ] Plan rollback strategy
- [ ] Communicate changes to users
- [ ] Monitor after deployment

## 🎉 Post-Migration

### New Capabilities Available

After migrating, users can:
- Edit items inline without popups
- Drag and drop to reorder
- Expand/collapse for better overview
- Track unsaved changes per block
- Duplicate blocks quickly
- Use keyboard shortcuts
- Work more efficiently

### Performance Improvements

- Reduced API calls with lazy loading
- Better state management
- Optimized re-renders
- Improved user experience
- Faster data entry