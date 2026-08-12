/**
 * Post-build verification for the browser bundle.
 *
 * The Directus SDK build can silently drop stylesheets: rollup-plugin-styler skips any
 * SFC style block whose content happens to parse as JavaScript (e.g. a block containing
 * only `@use './file.scss';`), and rollup only emits a warning. That is how the whole
 * interface stylesheet disappeared between 1.3.3 and 1.3.4 without anyone noticing.
 * See https://github.com/smartlabsAT/directus-expandable-blocks/issues/85
 *
 * This script fails the build when the shipped bundle is missing CSS it must contain,
 * or when uncompiled SCSS leaked into it.
 */

import fs from 'fs';
import path from 'path';

const BUNDLE_PATH = path.resolve('dist/index.js');

/**
 * Selectors that must be present in the bundled CSS. One structural sentinel per
 * stylesheet source, so that losing any single source fails the build:
 * `.expandable-blocks` / `.block-item` cover the global interface.scss, the remaining
 * entries cover scoped styles of the main component groups.
 */
const REQUIRED_SELECTORS = [
  '.expandable-blocks',
  '.block-item',
  '.block-header',
  '.nested-block-item',
  '.settings-menu-content',
  '.item-selector-table-wrapper',
];

/** Uncompiled SCSS that must never reach the bundle. */
const FORBIDDEN_PATTERNS = [
  { pattern: /@use\s+['"][^'"]+\.scss['"]/, label: "unresolved @use of a .scss file" },
  { pattern: /@include\s+[a-zA-Z-]+\s*[;(]/, label: 'uncompiled @include (SCSS mixin)' },
  { pattern: /\$[a-z][a-z0-9-]*:\s*[^;]+;\s*\\n/, label: 'uncompiled SCSS variable declaration' },
];

/**
 * Minimum number of scoped-style markers. The bundle carried ~450 before the regression;
 * a value far below that means style blocks were dropped again.
 */
const MIN_SCOPE_MARKERS = 300;

function fail(messages) {
  console.error('\n❌ Build verification failed - the bundle is missing styles:\n');
  for (const message of messages) console.error(`   - ${message}`);
  console.error(
    '\n   A style block was most likely dropped by rollup-plugin-styler. Check the build\n' +
      '   output for "Skipping processed file" warnings and make sure every SFC style block\n' +
      '   contains at least one literal CSS rule (see issue #85).\n',
  );
  process.exit(1);
}

if (!fs.existsSync(BUNDLE_PATH)) {
  fail([`${BUNDLE_PATH} does not exist - did the build run?`]);
}

const bundle = fs.readFileSync(BUNDLE_PATH, 'utf8');
const errors = [];

for (const selector of REQUIRED_SELECTORS) {
  const rule = new RegExp(`\\${selector}[^{}]*\\{`);
  if (!rule.test(bundle)) {
    errors.push(`missing CSS rule for "${selector}"`);
  }
}

for (const { pattern, label } of FORBIDDEN_PATTERNS) {
  if (pattern.test(bundle)) {
    errors.push(`${label} found in the bundle`);
  }
}

const scopeMarkers = bundle.split('data-v-').length - 1;

if (scopeMarkers < MIN_SCOPE_MARKERS) {
  errors.push(`only ${scopeMarkers} scoped-style markers found, expected at least ${MIN_SCOPE_MARKERS}`);
}

if (errors.length > 0) {
  fail(errors);
}

console.log(
  `✅ Build verification passed (${REQUIRED_SELECTORS.length} sentinel selectors, ${scopeMarkers} scoped-style markers).`,
);
