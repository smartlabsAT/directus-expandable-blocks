/**
 * Build script to organize TypeScript definitions for shared components
 * This script runs after the main Directus extension build to set up .d.ts files
 */

import { exec } from 'child_process';
import { promisify } from 'util';
import path from 'path';
import fs from 'fs';

const execAsync = promisify(exec);

async function buildTypeDefinitions() {
  console.log('🔧 Setting up TypeScript definitions for shared components...');
  
  try {
    console.log('📦 Organizing type definitions...');
    
    // Ensure dist/shared directory exists
    if (!fs.existsSync('dist/shared')) {
      fs.mkdirSync('dist/shared', { recursive: true });
    }
    
    // Copy manual TypeScript definitions
    if (fs.existsSync('src/shared/types.d.ts')) {
      await execAsync('cp src/shared/types.d.ts dist/shared/index.d.ts');
      console.log('✅ Copied shared type definitions to dist/shared/index.d.ts');
    }
    
    // Create proper shared module exports
    const sharedExportContent = `
/**
 * Shared ItemSelector components for other extensions
 * 
 * @example
 * import { useItemSelector, ItemSelectorDrawer } from 'directus-extension-expandable-blocks/shared';
 */

// Export composables
export { useItemSelector } from '../index.js';

// Export components
export { 
  ItemSelectorDrawer,
  ItemSearchPanel,
  FieldDisplay,
  UsagePopover,
  FieldSettingsMenu,
  ItemEditDrawer,
  ItemSelectorTable
} from '../index.js';

// Export types
export { 
  DEFAULT_ITEM_SELECTOR_CONFIG
} from '../index.js';

// Export version info
export const SHARED_VERSION = '1.3.1';
`;

    fs.writeFileSync('dist/shared/index.js', sharedExportContent.trim());
    console.log('✅ Created shared module export at dist/shared/index.js');
    
    console.log('✅ TypeScript definitions set up successfully!');
    console.log('📁 Shared components available at: dist/shared/');
    console.log('🔗 Import with: import { useItemSelector } from "directus-extension-expandable-blocks/shared"');
    
  } catch (error) {
    console.error('❌ Error setting up type definitions:', error);
    process.exit(1);
  }
}

buildTypeDefinitions();