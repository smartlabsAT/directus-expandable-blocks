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
    const rels = relations || {};
    const _fieldMeta = field || {};
    
    // Get collections from store
    const { useCollections } = stores || {};
    const collectionsStore = useCollections ? useCollections() : null;
    
    // Get M2A allowed collections - they are stored in m2o.meta
    let allowedCollections: string[] = [];
    
    // Check in m2o.meta for one_allowed_collections
    if (rels.m2o?.meta?.one_allowed_collections) {
      allowedCollections = rels.m2o.meta.one_allowed_collections as string[];
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
    const baseOptions: any[] = [
      // Display Options Group
      {
        field: 'display_divider',
        name: 'Display Options',
        type: 'alias',
        meta: {
          interface: 'presentation-divider',
          options: {
            icon: 'visibility',
            color: '#00C897',
            title: 'Display Options',
            inlineTitle: false
          },
          special: ['alias', 'no-data'],
          width: 'full'
        }
      },
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
        field: 'showCollectionName',
        name: 'Show Collection Name',
        type: 'boolean',
        meta: {
          interface: 'boolean',
          options: {
            label: 'Display the collection name in block headers'
          },
          width: 'half',
          note: 'Shows the collection name for each block'
        },
        schema: {
          default_value: true
        }
      },
      /*
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
      */
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
      /*
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
      */
      
      // Limits & Restrictions Group
      {
        field: 'limits_divider',
        name: 'Limits & Restrictions',
        type: 'alias',
        meta: {
          interface: 'presentation-divider',
          options: {
            icon: 'rule',
            color: '#E35169',
            title: 'Limits & Restrictions',
            inlineTitle: false
          },
          special: ['alias', 'no-data'],
          width: 'full'
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
      // Collection Configuration Group
      baseOptions.push({
        field: 'collections_divider',
        name: 'Collection Configuration',
        type: 'alias',
        meta: {
          interface: 'presentation-divider',
          options: {
            icon: 'folder',
            color: '#6644FF',
            title: 'Collection Configuration',
            inlineTitle: false
          },
          special: ['alias', 'no-data'],
          width: 'full'
        }
      });
      
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
      
      // Add allowed collections for existing blocks option
      baseOptions.push({
        field: 'allowedCollectionsForExisting',
        name: 'Allowed Collections for Existing Blocks',
        type: 'json',
        meta: {
          width: 'full',
          interface: 'select-multiple-checkbox',
          options: {
            choices: allowedChoices
          } as any,
          note: 'Collections that can be linked or duplicated from existing items. Leave empty to use the same as "Allowed Collections".'
        },
        schema: {
          default_value: null
        }
      });
      
      // Add link/duplicate options for existing blocks
      baseOptions.push({
        field: 'allowLinkExisting',
        name: 'Allow Link Existing',
        type: 'boolean',
        meta: {
          interface: 'boolean',
          options: {
            label: 'Allow linking to existing blocks'
          },
          width: 'half',
          note: 'When enabled, users can add references to existing blocks'
        },
        schema: {
          default_value: true
        }
      });
      
      baseOptions.push({
        field: 'allowDuplicateExisting',
        name: 'Allow Duplicate Existing',
        type: 'boolean',
        meta: {
          interface: 'boolean',
          options: {
            label: 'Allow duplicating existing blocks'
          },
          width: 'half',
          note: 'When enabled, users can create copies of existing blocks'
        },
        schema: {
          default_value: true
        }
      });
      
      // Permissions Group
      baseOptions.push({
        field: 'permissions_divider',
        name: 'Permissions',
        type: 'alias',
        meta: {
          interface: 'presentation-divider',
          options: {
            icon: 'lock',
            color: '#FFA439',
            title: 'Permissions & Actions',
            inlineTitle: false
          },
          special: ['alias', 'no-data'],
          width: 'full'
        }
      });
      
      baseOptions.push({
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
      });
      
      baseOptions.push({
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
      });
      
      // Role-based Permissions Group
      baseOptions.push({
        field: 'role_permissions_divider',
        name: 'Role-based Permissions',
        type: 'alias',
        meta: {
          interface: 'presentation-divider',
          options: {
            icon: 'admin_panel_settings',
            color: '#9C27B0',
            title: 'Role-based Permissions',
            inlineTitle: false
          },
          special: ['alias', 'no-data'],
          width: 'full'
        }
      });
      
      baseOptions.push({
        field: 'role_permissions_info',
        name: 'Role Permissions Info',
        type: 'alias',
        meta: {
          interface: 'presentation-notice',
          options: {
            icon: 'info',
            color: 'blue-grey',
            text: 'Configure which roles can perform specific actions. Leave empty to allow all roles (default behavior). Administrators always have full access.'
          },
          special: ['alias', 'no-data'],
          width: 'full'
        }
      });
      
      baseOptions.push({
        field: 'rolesCanChangeStatus',
        name: 'Roles Can Change Status',
        type: 'json',
        meta: {
          interface: 'tags',
          options: {
            placeholder: 'Enter role name...',
            iconRight: 'vpn_key'
          },
          width: 'half',
          note: 'Enter role names that can change block status (e.g. editor, moderator)'
        },
        schema: {
          default_value: null
        }
      });
      
      baseOptions.push({
        field: 'rolesCanSort',
        name: 'Roles Can Sort',
        type: 'json',
        meta: {
          interface: 'tags',
          options: {
            placeholder: 'Enter role name...',
            iconRight: 'vpn_key'
          },
          width: 'half',
          note: 'Enter role names that can reorder blocks (e.g. editor, moderator)'
        },
        schema: {
          default_value: null
        }
      });
      
      baseOptions.push({
        field: 'rolesCanAddBlocks',
        name: 'Roles Can Add Blocks',
        type: 'json',
        meta: {
          interface: 'tags',
          options: {
            placeholder: 'Enter role name...',
            iconRight: 'vpn_key'
          },
          width: 'half',
          note: 'Enter role names that can add new blocks (e.g. editor, moderator)'
        },
        schema: {
          default_value: null
        }
      });
      
      baseOptions.push({
        field: 'rolesCanDelete',
        name: 'Roles Can Delete',
        type: 'json',
        meta: {
          interface: 'tags',
          options: {
            placeholder: 'Enter role name...',
            iconRight: 'vpn_key'
          },
          width: 'half',
          note: 'Enter role names that can delete blocks (e.g. editor, moderator)'
        },
        schema: {
          default_value: null
        }
      });
      
      baseOptions.push({
        field: 'rolesCanDuplicate',
        name: 'Roles Can Duplicate',
        type: 'json',
        meta: {
          interface: 'tags',
          options: {
            placeholder: 'Enter role name...',
            iconRight: 'vpn_key'
          },
          width: 'half',
          note: 'Enter role names that can duplicate blocks (e.g. editor, moderator)'
        },
        schema: {
          default_value: null
        }
      });
    }

    return baseOptions;
  }
});