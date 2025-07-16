import { defineInterface } from '@directus/extensions-sdk';
import InterfaceComponent from './interface.vue';

export default defineInterface({
  id: 'expandable-blocks',
  name: 'Expandable Blocks',
  icon: 'dashboard_customize',
  description: 'M2A interface with inline expandable editing',
  component: InterfaceComponent,
  types: ['alias'],
  localTypes: ['m2a'],
  group: 'relational',
  relational: true,
  options: ({ relations, field, stores }: any) => {
    
    // Handle both ref and non-ref cases
    const rels = (relations as any)?.value || relations || {};
    const fieldMeta = (field as any)?.value || field || {};
    const fieldName = fieldMeta.field;
    
    // Get collections from store
    const { useCollections } = stores || {};
    const collectionsStore = useCollections ? useCollections() : null;
    
    // Get M2A allowed collections - they are stored in m2o.meta
    let allowedCollections: string[] = [];
    
    // Check in m2o.meta for one_allowed_collections
    if (rels.m2o?.meta?.one_allowed_collections) {
      allowedCollections = rels.m2o.meta.one_allowed_collections;
    }
    
    // Helper function to get all available collections
    const getAllAvailableCollections = () => {
      if (!collectionsStore) {
        return [];
      }
      
      // Get all collections from the store
      const allCollections = collectionsStore.collections || [];
      
      // Filter out system collections and hidden ones
      return allCollections
        .filter((col: any) => {
          return (
            !col.collection.startsWith('directus_') &&
            col.meta?.hidden !== true &&
            col.collection !== 'extra_undefined' // Filter out the junction collection
          );
        })
        .map((col: any) => {
          const displayName = col.meta?.display_template || col.meta?.name || col.name ||
            col.collection
              .split('_')
              .map((part: string) => part.charAt(0).toUpperCase() + part.slice(1))
              .join(' ');
          
          return {
            text: displayName,
            value: col.collection
          };
        })
        .sort((a: any, b: any) => a.text.localeCompare(b.text));
    };
    
    // Format allowed collections for use in the interface
    const allowedChoices = Array.isArray(allowedCollections) && allowedCollections.length > 0
      ? allowedCollections.map((collectionName: string) => ({
          text: collectionName
            .split('_')
            .map((part: string) => part.charAt(0).toUpperCase() + part.slice(1))
            .join(' '),
          value: collectionName
        }))
      : getAllAvailableCollections();
    
    // Check if this is a new field (no M2A configuration yet)
    const isNewField = allowedCollections.length === 0;
    
    // Determine the appropriate note text
    const getCollectionNote = () => {
      if (allowedCollections.length > 0) {
        return 'Select which collections to allow as blocks. Leave empty to use all M2A configured collections.';
      }
      
      // For new fields without M2A configuration
      return 'This field will automatically use all collections configured in the M2A relationship after saving.';
    };
    
    
    // Base options that are always available
    const baseOptions = [
      {
        field: 'enableSorting',
        name: 'Enable Sorting',
        type: 'boolean',
        meta: {
          interface: 'boolean',
          options: {
            label: 'Allow drag & drop reordering'
          },
          width: 'half',
          note: 'Allow users to reorder blocks by dragging and dropping them'
        },
        schema: {
          default_value: true
        }
      },
      {
        field: 'showItemId',
        name: 'Show Item ID',
        type: 'boolean',
        meta: {
          interface: 'boolean',
          options: {
            label: 'Display the item ID in block headers'
          },
          width: 'half',
          note: 'Shows the actual item ID (not junction ID) in the block header'
        },
        schema: {
          default_value: true
        }
      },
      {
        field: 'startExpanded',
        name: 'Start Expanded',
        type: 'boolean',
        meta: {
          interface: 'boolean',
          options: {
            label: 'Expand all blocks by default'
          },
          width: 'half',
          note: 'When enabled, all blocks will be expanded when the page loads'
        },
        schema: {
          default_value: false
        }
      },
      {
        field: 'accordionMode',
        name: 'Accordion Mode',
        type: 'boolean',
        meta: {
          interface: 'boolean',
          options: {
            label: 'Only allow one expanded block at a time'
          },
          width: 'half',
          note: 'When enabled, expanding one block will automatically collapse all others'
        },
        schema: {
          default_value: false
        }
      },
      {
        field: 'showFieldsFilter',
        name: 'Show Only Specific Fields',
        type: 'json',
        meta: {
          interface: 'tags',
          options: {
            placeholder: 'Enter field names...'
          },
          width: 'full',
          note: 'Specify which fields to display in the inline editor. Leave empty to show all editable fields'
        },
        schema: {
          default_value: null
        }
      },
      {
        field: 'compactMode',
        name: 'Compact Mode',
        type: 'boolean',
        meta: {
          interface: 'boolean',
          options: {
            label: 'Use compact display'
          },
          width: 'half',
          note: 'Reduces the height of block headers and hides some metadata for a more compact view'
        },
        schema: {
          default_value: false
        }
      },
      {
        field: 'isAllowedDelete',
        name: 'Allow Delete',
        type: 'boolean',
        meta: {
          interface: 'boolean',
          options: {
            label: 'Allow users to delete blocks'
          },
          width: 'half',
          note: 'When disabled, users cannot delete existing blocks'
        },
        schema: {
          default_value: true
        }
      },
      {
        field: 'isAllowedDuplicate',
        name: 'Allow Duplicate',
        type: 'boolean',
        meta: {
          interface: 'boolean',
          options: {
            label: 'Allow users to duplicate blocks'
          },
          width: 'half',
          note: 'When disabled, users cannot duplicate existing blocks'
        },
        schema: {
          default_value: true
        }
      },
      {
        field: 'maxBlocks',
        name: 'Maximum Blocks',
        type: 'integer',
        meta: {
          interface: 'input',
          options: {
            placeholder: 'Leave empty for unlimited',
            min: 0
          },
          width: 'half',
          note: 'Maximum number of blocks allowed. Leave empty for unlimited blocks'
        },
        schema: {
          default_value: null
        }
      }
    ];

    // Only show allowed collections option if M2A is already configured
    if (!isNewField) {
      baseOptions.push({
        field: 'allowedCollections',
        name: 'Allowed Collections',
        type: 'json',
        meta: {
          width: 'full',
          interface: 'select-multiple-checkbox',
          options: {
            choices: allowedChoices
          } as any,
          note: getCollectionNote()
        },
        schema: {
          default_value: null
        }
      });
    }

    return baseOptions;
  }
});