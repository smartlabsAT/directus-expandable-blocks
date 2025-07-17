# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

This is a **Directus CMS interface extension** (v1.0.6) that provides an advanced M2A (Many-to-Any) relationship editor with inline expandable editing capabilities. The extension integrates seamlessly with Directus' native save system without custom API calls.

## Technology Stack

- **Framework**: Vue 3 (Composition API)
- **Build Tool**: Vite
- **Language**: TypeScript (strict mode)
- **Testing**: Vitest (unit) + Playwright (E2E)
- **Directus**: v11.0.0+ compatible
- **Key Libraries**: @directus/extensions-sdk, vuedraggable

## Development Commands

```bash
# Development (auto-rebuilds)
npm run dev          # Watch mode - IMPORTANT: Use this, not build!
npm run build-dev    # Single build without minification

# Testing
npm run test         # Unit tests
npm run test:coverage # With coverage
npm run test:e2e     # E2E tests
npm run test:e2e:debug # Debug E2E

# Release
npm run release:patch  # Bump patch version
npm run release:minor  # Bump minor version
npm run release:major  # Bump major version

# Production
npm run build        # Production build (only for releases)
```

## Architecture & Code Structure

### Two-Component Architecture

1. **interface.vue** (~1400 lines) - Main editable interface
   - Full CRUD operations for M2A blocks
   - Drag & drop sorting with dirty state tracking
   - Save/discard integration with Directus forms
   - Permission controls and customizable options

2. **NestedBlocks.vue** (~130 lines) - Read-only display
   - Shows nested M2A relationships
   - Recursive rendering for deep structures
   - No state conflicts with parent

### Key Composables & Utilities

- **useExpandableBlocks.ts** - Core business logic composable
- **m2a-helper.ts** - M2A data transformation utilities
- **logger.ts** - Debug logging with enable/disable
- **helpers.ts** - General utility functions

### State Management

- Uses Vue 3 Composition API with reactive refs
- Tracks original states for dirty detection
- Handles complex save/discard scenarios
- Integrates with Directus form state via `useFieldsStore()`

### Native Directus Integration

The extension works directly with Directus' native systems:
- No custom API calls - uses built-in save/revert
- Proper dirty state detection
- Works with Save & Stay functionality
- Integrates with global Discard Changes

## Important Development Notes

1. **NEVER run `npm run build` manually** - There's an automatic watcher running that rebuilds on changes
2. Changes in `/extensions/expandable-blocks/src/` are automatically detected and rebuilt
3. This extension is part of a larger Smartlabs CMS project using Directus v11.2.0
4. When testing, ensure Directus is running (port 8055) with PostgreSQL (port 6801)

## Testing Approach

- Unit tests use Vitest with Vue Test Utils
- E2E tests use Playwright against a running Directus instance
- Test files are colocated with source files (*.test.ts)
- Coverage reports available via `npm run test:coverage`

## Key Files to Understand

1. **src/interface.vue** - Main component logic and UI
2. **src/composables/useExpandableBlocks.ts** - Core business logic
3. **src/utils/m2a-helper.ts** - M2A data handling
4. **src/types/index.ts** - TypeScript type definitions
5. **ARCHITECTURE.md** - Comprehensive technical documentation (1800+ lines)