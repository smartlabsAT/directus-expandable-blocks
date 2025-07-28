/**
 * Central export point for all types in the expandable-blocks extension
 * 
 * Types are organized into logical modules:
 * - options.ts: Configuration options
 * - data.ts: Data structures (Junction, Item, Collection)
 * - relations.ts: Relation and M2A types
 * - props.ts: Component prop types
 * - directus.ts: Directus-specific types and re-exports
 * - composable-context.ts: Composable context types
 */

// Configuration options
export * from './options';

// Data structures
export * from './data';

// Relation types
export * from './relations';

// Component props
export * from './props';

// Directus types
export * from './directus';

// Composable context types
export * from './composable-context';

// Translation types
export * from './translations';