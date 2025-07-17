# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [1.0.8] - 2025-07-17

### Fixed
- **Deep Equality Checking**: Implemented deepEqual function for proper object comparison in dirty state detection
- **isDirty State Persistence**: Fixed bug where isDirty state persisted after reverting changes
- **Paste Detection**: Fixed incorrect paste detection when adding new blocks
- **Sorting State After Save**: Blocks no longer incorrectly remain dirty after saving when only positions changed
- **Deleted Blocks Position**: Removed deleted blocks from originalItemOrder to prevent false position change detections
- **TypeError Prevention**: Added type check before using 'in' operator in extractItemTitle helper
- **Internal Update Handling**: Added isInternalUpdate flag to all functions that emit changes to prevent watch conflicts

### Added
- **Visual NEW Indicator**: New unsaved blocks now display a green pulsing dot instead of the blue dirty indicator
- **Disabled State for Discard**: "Discard Changes" option now appears disabled when no changes are present

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

## [1.0.4] - 2025-07-14

### Added
- Type definitions for toggle and activator components
- Improved TypeScript type safety
- Enhanced test documentation in CONTRIBUTING.md

### Fixed
- TypeScript TS2339 error in useExpandableBlocks composable (added type assertion for item.id)
- GitHub Actions v3 deprecation warnings (updated all actions to v4)
- Test workflow configuration for better CI compatibility

### Changed
- E2E tests temporarily disabled in CI environment due to Docker networking constraints
- Enhanced test infrastructure for better CI/CD compatibility
- Test workflow now properly configured for testing branch
- Type checking made non-blocking in CI with continue-on-error

### Technical Improvements
- Updated all GitHub Actions from v3 to v4 (checkout, setup-node, cache, upload-artifact)
- Added CI environment detection in E2E tests to skip when running in GitHub Actions
- Improved test scripts and documentation
- Better TypeScript error handling in composables

## [1.0.3] - 2025-07-14

### Fixed
- **Sorting Persistence**: Fixed issue where block reordering was not persisted when saving
  - Enhanced isDirty detection to track position changes alongside content changes
  - Blocks are now correctly marked as dirty when their position changes
- **Sort Field Access**: Fixed undefined sort field errors throughout the codebase
  - Corrected access path from `relationInfo.value?.sort_field` to `relationInfo.value?.meta?.sort_field`
  - Ensures proper sorting functionality across all operations
- **Save and Stay Functionality**: Fixed blocks reverting to original positions after "Save and Stay"
  - Added originalItemOrder tracking to detect save completion
  - Updates originalItemOrder when save is successful
  - Maintains block order correctly during continuous editing
- **Global Discard Functionality**: Fixed "Discard all changes" not working
  - Properly resets originalItemOrder to saved state
  - Restores blocks to their original positions and content
  - Distinguishes between save events and discard events

### Technical Improvements
- Improved position-based dirty state tracking
- Enhanced save detection mechanism
- Better state management for block ordering
- Consistent use of logger instead of console.log
- Improved debugging capabilities with structured logging

## [1.0.2] - 2025-07-12

### Fixed
- **Foreign Key Default Values**: Fixed integer foreign key fields receiving invalid default value `0`
  - Integer foreign key fields now correctly receive `null` instead of `0` 
  - Resolves PostgreSQL foreign key constraint violations when creating content blocks
  - Specifically fixes content_button creation which references pages table
  - UUID foreign key fields continue to work correctly (e.g., content_image)

### Technical Improvements
- Enhanced foreign key detection in default data generation
- Added debug logging for foreign key field processing
- Improved error handling for content block creation

## [1.0.1] - 2025-07-12

### Fixed
- **Props Watcher**: Added watcher for primaryKey changes to handle Directus loading lifecycle
  - Extension now correctly loads data when primaryKey changes from "+" to actual ID
  - Fixes issue where blocks wouldn't load on collections other than pages
- **Foreign Key Type Consistency**: Fixed foreign key type conversion from string to number
  - Ensures proper PostgreSQL foreign key constraints
  - Prevents junction record creation failures
- **Data Persistence**: Resolved blocks disappearing after page reload
  - Extension now correctly persists and loads blocks across all M2A collections
  - Fixed originalItemOrder population for proper dirty state tracking

### Technical Improvements
- Enhanced logging and debugging capabilities
- Improved M2A relationship detection and handling
- Better error handling for edge cases during component mounting

## [1.0.0] - 2024-07-11

### Added
- Initial release of Directus Expandable Blocks Interface
- Inline expandable editing for M2A (Many-to-Any) fields
- Drag & drop sorting with visual feedback and smooth animations
- Status management with visual indicators and quick status changes
- Dirty state tracking with visual feedback for unsaved changes
- Compact and full view modes for adaptive display
- Keyboard navigation support for accessibility
- Nested M2A relationship support for complex data structures
- Custom field filtering to show specific fields in edit mode
- Template system for pre-configured content templates
- Built-in content status workflows
- Configuration options for sorting, accordion mode, compact display
- Maximum block limits and permission controls
- Comprehensive test coverage with unit and e2e tests
- Full TypeScript support with type definitions
- Production-ready build system with Vite
- Complete documentation with usage examples

### Technical Features
- Vue 3 composition API implementation
- TypeScript strict mode compliance
- Comprehensive test suite with Vitest and Playwright
- CI/CD ready with automated testing
- Proper npm package structure for distribution
- ESM module support
- Tree-shakable code structure

### Coming Soon
- AI-powered content generation features
- Multi-language translation support
- Smart content improvement tools
- Context-aware AI suggestions

[1.0.8]: https://github.com/smartlabsAT/directus-expandable-blocks/releases/tag/v1.0.8
[1.0.7]: https://github.com/smartlabsAT/directus-expandable-blocks/releases/tag/v1.0.7
[1.0.6]: https://github.com/smartlabsAT/directus-expandable-blocks/releases/tag/v1.0.6
[1.0.5]: https://github.com/smartlabsAT/directus-expandable-blocks/releases/tag/v1.0.5
[1.0.4]: https://github.com/smartlabsAT/directus-expandable-blocks/releases/tag/v1.0.4
[1.0.3]: https://github.com/smartlabsAT/directus-expandable-blocks/releases/tag/v1.0.3
[1.0.2]: https://github.com/smartlabsAT/directus-expandable-blocks/releases/tag/v1.0.2
[1.0.1]: https://github.com/smartlabsAT/directus-expandable-blocks/releases/tag/v1.0.1
[1.0.0]: https://github.com/smartlabsAT/directus-expandable-blocks/releases/tag/v1.0.0