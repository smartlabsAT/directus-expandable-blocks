import { defineInterface } from '@directus/extensions-sdk';
import InterfaceComponent from './interface.vue';

export default defineInterface({
  id: 'expandable-blocks',
  name: 'Expandable Blocks',
  icon: 'view_stream',
  description: 'M2A interface with inline expandable editing',
  component: InterfaceComponent,
  types: ['alias'],
  localTypes: ['m2a'],
  group: 'relational',
  relational: true,
  options: ({ relations, field }: any) => {
    
    // Handle both ref and non-ref cases
    const rels = (relations as any)?.value || relations || {};
    const fieldMeta = (field as any)?.value || field || {};
    const fieldName = fieldMeta.field;
    
    // Get M2A allowed collections - they are stored in m2o.meta
    let allowedCollections: string[] = [];
    
    // Check in m2o.meta for one_allowed_collections
    if (rels.m2o?.meta?.one_allowed_collections) {
      allowedCollections = rels.m2o.meta.one_allowed_collections;
    }
    
    // Format allowed collections for use in the interface
    const allowedChoices = Array.isArray(allowedCollections) && allowedCollections.length > 0
      ? allowedCollections.map((collectionName: string) => ({
          text: collectionName
            .split('_')
            .map((part: string) => part.charAt(0).toUpperCase() + part.slice(1))
            .join(' '),
          value: collectionName
        }))
      : [];
    
    
    return [
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
    },
    {
      field: 'enableAI',
      name: 'Enable AI Assistant',
      type: 'boolean',
      meta: {
        interface: 'boolean',
        options: {
          label: 'Enable AI-powered content generation and improvement'
        },
        width: 'half',
        note: 'Adds AI features like content improvement, generation, and translation'
      },
      schema: {
        default_value: false
      }
    },
    {
      field: 'aiProvider',
      name: 'AI Provider',
      type: 'string',
      meta: {
        interface: 'select-dropdown',
        options: {
          choices: [
            { text: 'OpenAI (ChatGPT)', value: 'openai' },
            { text: 'Anthropic (Claude)', value: 'claude' },
            { text: 'Custom API', value: 'custom' }
          ]
        },
        width: 'half',
        note: 'Choose your AI service provider',
        conditions: [
          {
            rule: {
              enableAI: {
                _eq: true
              }
            },
            hidden: false
          }
        ]
      },
      schema: {
        default_value: 'openai'
      }
    },
    {
      field: 'aiApiKey',
      name: 'API Key',
      type: 'string',
      meta: {
        interface: 'input',
        options: {
          placeholder: 'Enter your API key...',
          masked: true
        },
        width: 'full',
        note: '⚠️ Your API key is stored locally in your browser only',
        conditions: [
          {
            rule: {
              enableAI: {
                _eq: true
              }
            },
            hidden: false
          }
        ]
      }
    },
    {
      field: 'aiModel',
      name: 'Model',
      type: 'string',
      meta: {
        interface: 'select-dropdown',
        options: {
          choices: [
            { text: 'GPT-3.5 Turbo (Fast & Cost-effective)', value: 'gpt-3.5-turbo' },
            { text: 'GPT-4 (Best Quality)', value: 'gpt-4' },
            { text: 'GPT-4 Turbo', value: 'gpt-4-turbo-preview' },
            { text: 'GPT-4o (Latest)', value: 'gpt-4o' },
            { text: 'Claude 3 Haiku (Fast)', value: 'claude-3-haiku-20240307' },
            { text: 'Claude 3 Sonnet (Balanced)', value: 'claude-3-sonnet-20240229' },
            { text: 'Claude 3 Opus (Best)', value: 'claude-3-opus-20240229' },
            { text: 'Claude 3.5 Sonnet (Latest)', value: 'claude-3-5-sonnet-20241022' }
          ],
          allowOther: true
        },
        width: 'half',
        note: 'Select the AI model to use. You can also enter a custom model name.',
        conditions: [
          {
            rule: {
              enableAI: {
                _eq: true
              }
            },
            hidden: false
          }
        ]
      },
      schema: {
        default_value: 'gpt-3.5-turbo'
      }
    },
    {
      field: 'aiTemperature',
      name: 'Creativity (Temperature)',
      type: 'float',
      meta: {
        interface: 'slider',
        options: {
          min: 0,
          max: 2,
          step: 0.1
        },
        width: 'half',
        note: 'Lower = more focused, Higher = more creative (0.0 - 2.0)',
        conditions: [
          {
            rule: {
              enableAI: {
                _eq: true
              }
            },
            hidden: false
          }
        ]
      },
      schema: {
        default_value: 0.7
      }
    },
    {
      field: 'aiMaxTokens',
      name: 'Max Response Length',
      type: 'integer',
      meta: {
        interface: 'input',
        options: {
          min: 100,
          max: 4000,
          placeholder: '1000'
        },
        width: 'half',
        note: 'Maximum length of AI responses (100-4000 tokens)',
        conditions: [
          {
            rule: {
              enableAI: {
                _eq: true
              }
            },
            hidden: false
          }
        ]
      },
      schema: {
        default_value: 1000
      }
    },
    {
      field: 'aiCustomUrl',
      name: 'Custom API URL',
      type: 'string',
      meta: {
        interface: 'input',
        options: {
          placeholder: 'https://api.example.com'
        },
        width: 'full',
        note: 'Only required for custom API providers',
        conditions: [
          {
            rule: {
              enableAI: {
                _eq: true
              },
              aiProvider: {
                _eq: 'custom'
              }
            },
            hidden: false
          }
        ]
      }
    },
    {
      field: 'allowedCollections',
      name: 'Allowed Collections',
      type: 'json',
      meta: {
        width: 'full',
        interface: allowedChoices.length > 0 ? 'select-multiple-checkbox' : 'tags',
        options: allowedChoices.length > 0 
          ? {
              choices: allowedChoices
            }
          : {
              placeholder: 'Enter collection names (e.g. content_text, content_image)',
              allowCustom: true,
              iconRight: 'info',
              presets: [
                { text: 'Content Text', value: 'content_text' },
                { text: 'Content Image', value: 'content_image' },
                { text: 'Content Hero', value: 'content_hero' },
                { text: 'Content CTA', value: 'content_cta' }
              ]
            },
        note: allowedChoices.length === 0 
          ? '⚠️ No collections configured in the M2A relation. Configure allowed collections in the M2A field first, or enter them manually here.' 
          : 'Select which collections to allow as blocks. Leave empty to use all M2A allowed collections.'
      },
      schema: {
        default_value: null
      }
    }
  ];
  },
  preview: '<div>Expandable Blocks</div>'

});