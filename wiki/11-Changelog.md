# Changelog

All notable changes to the Directus Expandable Blocks extension are documented here.

## [1.0.6] - 2025-07-16

### Fixed
- Removed unnecessary preview property from interface definition
  - The preview property was causing display issues
  - Interface now relies on default Directus preview generation

## [1.0.5] - 2025-07-15

### Fixed
- Changed interface icon from `view_stream` to `dashboard_customize` for better visibility
  - Previous icon was not displaying correctly in Directus interface
  - Updated to match the layout-blocks interface for consistency

## [1.0.4] - 2025-07-15

### Added
- Type definitions for toggle and activator components
- Comprehensive test documentation
- Improved CI/CD test infrastructure

### Fixed
- TypeScript TS2339 errors in composables  
- Missing component type definitions

### Changed
- Updated GitHub Actions from v3 to v4
- Enhanced debugging capabilities

## [1.0.3] - 2025-07-14

### Fixed
- Sorting persistence issues - blocks now maintain order correctly
- "Save and Stay" functionality - proper state management after save
- Global discard functionality - correctly reverts all changes
- Position-based dirty state tracking - accurate change detection

### Added
- Enhanced debugging with detailed console logging
- Improved position change detection

## [1.0.2] - 2025-07-13

### Fixed
- Foreign key default values for PostgreSQL compatibility
- Error handling for content block creation
- Type consistency issues with foreign keys

### Changed
- Improved error messages for better debugging

## [1.0.1] - 2025-07-12

### Fixed
- Props watcher for primaryKey changes
- Foreign key type consistency between string and number
- Data persistence issues when switching between items

### Added
- Better type checking for junction records

## [1.0.0] - 2025-07-11

### Added
- Initial release of Directus Expandable Blocks
- Inline expandable editing for M2A relationships
- Drag & drop sorting with visual feedback
- Native Directus save integration
- Smart dirty state detection
- Status management with visual indicators
- Compact and full view modes
- Accordion mode for single block editing
- Maximum block limits configuration
- Custom field filtering
- Comprehensive TypeScript support
- Full test coverage (Unit + E2E)

### Features
- No custom API calls - uses Directus native save
- Proper dirty state - save button only shows when needed
- Global discard support
- Permission controls
- Nested M2A display support
- Template system ready
- Keyboard navigation
- Mobile responsive

## Development History

### Pre-1.0.0 Development

The extension was developed to solve the challenge of inline editing for M2A relationships in Directus. Key development milestones:

1. **Initial Concept** - Identified need for better M2A editing
2. **Architecture Design** - Two-component system for edit/display
3. **Native Integration** - Decision to use Directus form system
4. **Dirty State Solution** - Smart tracking of individual block changes
5. **Testing Implementation** - Comprehensive test suite
6. **Documentation** - Extensive technical documentation

## Version Naming

We follow semantic versioning:
- **Major** (X.0.0): Breaking changes
- **Minor** (0.X.0): New features, backwards compatible
- **Patch** (0.0.X): Bug fixes

## Deprecations

### Planned for v2.0.0
- None currently planned

## Migration Guides

### From Other Block Editors

If migrating from other M2A editors:

1. **Data Structure**: Our extension uses standard Directus M2A structure
2. **No Custom Tables**: Works with existing junction tables  
3. **API Compatible**: Same data format as native M2A

### Upgrading

To upgrade between versions:

```bash
npm update directus-extension-expandable-blocks
```

Then restart Directus.

---

> **Note**: For detailed migration instructions for specific versions, see the [GitHub Releases](https://github.com/smartlabsAT/directus-expandable-blocks/releases) page.