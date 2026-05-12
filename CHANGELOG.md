# Changelog

All notable changes to the Directus Expandable Blocks extension are documented here.

## [Unreleased]

### Changed
- **Dependencies**: Patch/minor updates across the toolchain
  - vite 8.0.3 → 8.0.12 (fixes 2 HIGH CVEs: dev server WebSocket file read, server.fs.deny bypass)
  - @directus/extensions-sdk 17.1.1 → 17.1.4, @directus/types 15.0.1 → 15.0.3
  - vue 3.5.32 → 3.5.34, @vitejs/plugin-vue 6.0.5 → 6.0.6, @vue/test-utils 2.4.6 → 2.4.10
  - vitest, @vitest/coverage-v8, @vitest/ui 4.1.2 → 4.1.6
  - @playwright/test 1.59.1 → 1.60.0, happy-dom 20.8.9 → 20.9.0
  - typescript 6.0.2 → 6.0.3, eslint 10.1.0 → 10.3.0, eslint-plugin-vue 10.8.0 → 10.9.1
  - @typescript-eslint/eslint-plugin, @typescript-eslint/parser 8.58.0 → 8.59.3
  - dotenv 17.4.0 → 17.4.2

### Notes
- Remaining `pnpm audit` findings stem from transitive dependencies of @directus/extensions-sdk
  (axios, lodash-es subdep, fast-xml-parser, unhead, postcss, follow-redirects) and require an
  upstream Directus SDK release to resolve.

## [1.3.4] - 2026-04-04

### Changed
- **Dependencies**: Updated all 23 outdated packages across 6 phases
  - ESLint 9 → 10, TypeScript 5 → 6, Vitest 1 → 4, Vite (new) → 8
  - @directus/extensions-sdk 11 → 17, @directus/types 13 → 15
  - happy-dom 12 → 20, @vitejs/plugin-vue 4 → 6
  - lodash-es 4.18.1, vue 3.5.32, sass 1.99.0, @types/node 22.x
  - All minor/patch linting, testing, and framework packages
- **tsconfig.json**: `moduleResolution` changed from `"node"` to `"bundler"`, removed unused `baseUrl`/`paths`
- **CI**: Updated to Node 20/22 and pnpm 10

### Fixed
- Fixed 3 `no-useless-assignment` lint errors detected by ESLint 10 (FieldDisplay.vue, useBlockWatchers.ts)
- Fixed 2 pre-existing unused import lint errors (build-types.js, useItemSelector.test.ts)
- Fixed `vi.fn()` constructor mock for Vitest 4 compatibility (useM2AData.spec.ts)
- Added workaround for TypeScript 6.0.2 compiler crash with SDK v17 types (src/index.ts)
- Updated `vue-shim.d.ts` to use `import type` for DefineComponent

## [1.1.1] - 2025-08-23

### Fixed
- **Issue #23**: Fixed sticky table header in item selector component not staying in place when scrolling
  - Restructured template with separate header and body containers for proper sticky behavior
  - Header container now sticks at `top: 125px` below Directus navigation
  - Implemented horizontal scroll synchronization between header and body
  - Fixed column alignment issues with sort icons and spacers
  - Preserved all design elements (zebra striping, hover states, selection)
  - Maintained sticky checkbox and actions columns functionality

## [1.1.0] - 2025-08-05

> **Major Release, 30+ new features, and Usage References & Tracking system!**

### 🔗 NEW FEATURE: Usage References & Tracking
- **Deep Links**: Direct links to pages/items using the block
- **Pre-Delete Warnings**: See ALL usages BEFORE deleting
- **Usage Count**: Number of references at a glance
- **Circular Reference Detection**: Identify circular dependencies

### Added
- **Bundle Extension Architecture**: Converted to bundle extension with interface and API endpoint
- **Add Existing Items**: Select and link existing items from other collections
  - Advanced search with field-specific queries and tag-based filtering
  - Configurable field display in item selector
  - Pagination and bulk selection support
  - Inline item editing without leaving the interface
- **Translation Support**: Full support for Directus translation fields
  - Language selector in item selector
  - Translation field indicators
  - Proper loading and display of translated values
- **Role-Based Permissions**: Granular permission control based on user roles
  - Configure create, read, update, delete permissions per role
  - Respect Directus collection permissions
  - Visual indicators for read-only blocks
- **Usage Tracking**: See where items are used across collections
  - Usage warnings with intelligent filtering
  - Breadcrumbs and deeplinks to usage locations
- **Enhanced Search**: Advanced search capabilities
  - Field-specific search with AND/OR operators
  - Tag-based search interface with drag & drop
  - Search result count display
  - Remember last search functionality
  - Case-insensitive search with `_icontains` operator
- **Improved UI/UX**:
  - Adjustable drawer width with persistent settings
  - Table view in item selector with sticky headers
  - Items per page selector with persistent preferences
  - Server-side sorting with persistent settings
  - Hide empty fields option
  - Redesigned settings menu with two-column layout
  - Visual NEW indicator for unsaved blocks
- **API Endpoints**: New backend API for enhanced functionality
  - `/expandable-blocks-api/:collection/search` - Search items with relations
  - `/expandable-blocks-api/:collection/items` - Get items with full relation data
  - Efficient data loading with caching
  - Permission-based filtering
- **Frontend Title Field Validation**: Prevents invalid sort requests by validating title fields against available collection fields
- **Backend Sort Field Validation**: Automatic fallback to 'id' field when invalid sort fields are requested

### Changed
- **Development**: Enhanced development workflow
  - Use pnpm for package management
  - Automatic rebuild watcher for development
  - Comprehensive unit test coverage
  - Improved logging system (never use console.log directly)
- **Build System**: Updated to bundle extension type
  - Interface and API endpoint in single package
  - Shared code between frontend and backend
  - Optimized build output
- **npm Package Optimization**: Reduced package size from ~14MB to ~1MB by moving demo.gif to external hosting
- **Cache TTL Standardization**: All cache TTL values standardized to 30 seconds for improved data freshness
- **TypeScript Configuration**: Removed explicit `@vue/runtime-core` type reference for better CI/CD compatibility

### Fixed
- **TypeScript Errors**: Resolved all TypeScript type errors across the codebase
- **Save Flow**: Improved save flow and unsaved changes handling
- **Permission Checks**: Proper permission validation for all operations
- **Translation Fields**: Correctly handle translation field metadata
- **Search Performance**: Resolved search input lag in item selector
- **Memory Leaks**: Fixed potential memory leaks in watchers
- **403 INVALID_PAYLOAD Errors**: Fixed errors when sorting by non-existent fields (broken since commit 09d2be3)
- **Translation Field Sorting**: Restored functionality by allowing Directus to handle `translation.*` fields natively
- **Delete Button Visibility**: Hide delete button for unsaved items without IDs
- **GitHub Actions TypeScript Error**: Resolved TS2688 error by removing redundant type definitions

### Technical Improvements
- Migrated to @directus/types for better type safety
- Added comprehensive logging system with scoped loggers
- Improved error handling and user feedback
- Enhanced performance with singleton cache
- Better code reuse with extracted helper functions
- Comprehensive documentation in GitHub Wiki

### Security
- **XSS Prevention**: Implemented native DOM-based HTML sanitization
  - Custom sanitization without external dependencies
  - Removes dangerous HTML elements (script, link, meta, style)
  - Strips event handlers and javascript: URLs
  - Secure WYSIWYG content rendering in FieldDisplay component
- **TypeScript Safety**: Eliminated all `any` types in critical paths
- **Input Validation**: Enhanced validation for all user inputs

### Testing
- **100% Test Pass Rate**: 533 tests passing, 5 skipped (timeout issues)
- **API Test Coverage**: Complete test suite for all API services
  - ServiceFactory tests with mocked Knex database
  - ItemLoader tests with proper chain method mocking
  - RelationAnalyzer and TranslationFieldAnalyzer coverage
- **Code Quality**: Reduced Qodana issues from 238 to 99
  - Fixed all TypeScript import errors
  - Added Vue 3 compiler macro support
  - Configured proper linting for Vue 3 projects

## [1.0.8] - 2025-07-17

### Fixed
- **Deep Equality Checking**: Implemented deepEqual function for proper object comparison in dirty state detection
- **isDirty State Persistence**: Fixed bug where isDirty state persisted after reverting changes
- **Paste Detection**: Fixed incorrect paste detection when adding new blocks
- **Sorting State After Save**: Blocks no longer incorrectly remain dirty after saving when only positions changed
- **Deleted Blocks Position**: Removed deleted blocks from originalItemOrder to prevent false position change detections
- **TypeError Prevention**: Added type check before using 'in' operator in extractItemTitle helper
- **Internal Update Handling**: Added isInternalUpdate flag to all functions that emit changes to prevent watch conflicts
- **Paste Raw Value**: Fixed UI not updating immediately when using Directus' "paste raw value" functionality
  - Improved detection of paste events to handle all three data types (IDs only, objects with ID, objects without ID)
  - Correctly process mixed data arrays containing both IDs and full objects
  - Properly mark pasted blocks as dirty/new to ensure correct save behavior
  - Preserve original states for existing blocks during paste operations

### Added
- **Visual NEW Indicator**: New unsaved blocks now display a green pulsing dot instead of the blue dirty indicator
- **Disabled State for Discard**: "Discard Changes" option now appears disabled when no changes are present
- **processPasteData Function**: New dedicated handler for paste operations with support for all data types
- **Enhanced Logging**: Added detailed paste event logging with 📋 emoji for better debugging

### Changed
- **Add Block Button Style**: Updated button design to match Directus M2A interface style
- **Status Dropdown Behavior**: Fixed immediate API save on status changes (Issue #6) - changes now wait for global save

## [1.0.7] - 2025-07-16

### Fixed
- **Issue #7**: Removed confusing "No collections configured" warning when creating new M2A fields
  - The "Allowed Collections" field is now hidden for new M2A fields until after saving
  - Collections are automatically detected from the M2A configuration
  - Improved user experience when setting up new fields
- **Issue #9**: Fixed empty "Allowed Collections" selection preventing all collections
  - Empty selection now correctly means "no restrictions" (all collections allowed)
  - When no specific collections are selected, the interface detects available collections from the junction table
  - Resolves issue where users couldn't add any blocks when "Allowed Collections" was empty

### Changed
- Temporarily disabled "Start Expanded" and "Compact Mode" options in the interface configuration
  - These options are commented out pending future UI improvements
  - Functionality remains in the codebase for future re-enabling

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

---

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

For the complete development history and additional details, see the [Wiki Changelog](https://github.com/smartlabsAT/directus-expandable-blocks/wiki/Changelog).