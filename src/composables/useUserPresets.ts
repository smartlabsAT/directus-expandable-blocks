import { ref, type Ref } from 'vue';
import { useApi } from '@directus/extensions-sdk';
import { debounce } from 'lodash-es';
import { logDebug, logError, logWarn } from '../utils/logger-wrapper';

interface ExpandableBlocksPreset {
  id?: number | string;
  user: string;
  role: string | null;
  collection: string;
  search: string | null;
  layout: string | null;
  layout_query: any;
  layout_options: any;
  refresh_interval: number | null;
  filter: any;
  icon: string;
  color: string | null;
}

export function useUserPresets() {
  const api = useApi();
  
  // State
  const displayFieldsCache = ref<Record<string, string[]>>({});
  const selectedLanguageCache = ref<Record<string, string>>({});
  const showIdsCache = ref<Record<string, boolean>>({});
  const hideEmptyFieldsCache = ref<Record<string, boolean>>({});
  const sortFieldCache = ref<Record<string, string | null>>({});
  const sortDirectionCache = ref<Record<string, 'asc' | 'desc'>>({});
  const loading = ref(false);
  const error = ref<string | null>(null);
  const presetIds = ref<Record<string, number>>({});
  
  /**
   * Get preset name for a collection
   */
  function getPresetCollection(collection: string): string {
    return `expandable_blocks_fields_${collection}`;
  }
  
  /**
   * Load all presets for expandable blocks
   */
  async function loadPresets(): Promise<void> {
    loading.value = true;
    error.value = null;
    
    try {
      logDebug('Loading user presets');
      
      // Load all presets that match our pattern
      const response = await api.get('/presets', {
        params: {
          filter: {
            collection: {
              _starts_with: 'expandable_blocks_fields_'
            }
          },
          fields: ['id', 'collection', 'layout_options']
        }
      });
      
      logDebug('Presets API response', { 
        hasData: !!response.data?.data,
        presetsCount: response.data?.data?.length || 0
      });
      
      const presets = response.data?.data || [];
      
      // Parse presets into our cache
      displayFieldsCache.value = {};
      selectedLanguageCache.value = {};
      showIdsCache.value = {};
      hideEmptyFieldsCache.value = {};
      sortFieldCache.value = {};
      sortDirectionCache.value = {};
      presetIds.value = {};
      
      presets.forEach((preset: any) => {
        if (preset.collection && preset.layout_options) {
          // Extract actual collection name from preset collection
          const actualCollection = preset.collection.replace('expandable_blocks_fields_', '');
          
          if (preset.layout_options.displayFields) {
            displayFieldsCache.value[actualCollection] = preset.layout_options.displayFields;
          }
          
          if (preset.layout_options.selectedLanguage) {
            selectedLanguageCache.value[actualCollection] = preset.layout_options.selectedLanguage;
          }
          
          if (preset.layout_options.showIds !== undefined) {
            showIdsCache.value[actualCollection] = preset.layout_options.showIds;
          }
          
          if (preset.layout_options.hideEmptyFields !== undefined) {
            hideEmptyFieldsCache.value[actualCollection] = preset.layout_options.hideEmptyFields;
          }
          
          if (preset.layout_options.sortField !== undefined) {
            sortFieldCache.value[actualCollection] = preset.layout_options.sortField;
          }
          
          if (preset.layout_options.sortDirection !== undefined) {
            sortDirectionCache.value[actualCollection] = preset.layout_options.sortDirection;
          }
          
          presetIds.value[actualCollection] = preset.id;
          
          logDebug('Loaded preset for collection', { 
            collection: actualCollection,
            fields: preset.layout_options.displayFields,
            language: preset.layout_options.selectedLanguage,
            showIds: preset.layout_options.showIds,
            hideEmptyFields: preset.layout_options.hideEmptyFields,
            sortField: preset.layout_options.sortField,
            sortDirection: preset.layout_options.sortDirection,
            presetId: preset.id
          });
        }
      });
      
      logDebug('User presets loaded', { 
        collections: Object.keys(displayFieldsCache.value)
      });
    } catch (err) {
      error.value = 'Failed to load user presets';
      logError('Failed to load user presets', err);
    } finally {
      loading.value = false;
    }
  }
  
  /**
   * Save preset data for a collection
   */
  async function savePresetData(collection: string, data: { displayFields?: string[], selectedLanguage?: string, showIds?: boolean, hideEmptyFields?: boolean, sortField?: string | null, sortDirection?: 'asc' | 'desc' }): Promise<void> {
    loading.value = true;
    error.value = null;
    
    try {
      const presetCollection = getPresetCollection(collection);
      const presetId = presetIds.value[collection];
      
      logDebug('Saving preset data', { 
        collection,
        presetCollection,
        data,
        hasPresetId: !!presetId
      });
      
      // Merge with existing data
      const layoutOptions: any = {};
      if (data.displayFields !== undefined) {
        layoutOptions.displayFields = data.displayFields;
      } else if (displayFieldsCache.value[collection]) {
        layoutOptions.displayFields = displayFieldsCache.value[collection];
      }
      
      if (data.selectedLanguage !== undefined) {
        layoutOptions.selectedLanguage = data.selectedLanguage;
      } else if (selectedLanguageCache.value[collection]) {
        layoutOptions.selectedLanguage = selectedLanguageCache.value[collection];
      }
      
      if (data.showIds !== undefined) {
        layoutOptions.showIds = data.showIds;
      } else if (showIdsCache.value[collection] !== undefined) {
        layoutOptions.showIds = showIdsCache.value[collection];
      }
      
      if (data.hideEmptyFields !== undefined) {
        layoutOptions.hideEmptyFields = data.hideEmptyFields;
      } else if (hideEmptyFieldsCache.value[collection] !== undefined) {
        layoutOptions.hideEmptyFields = hideEmptyFieldsCache.value[collection];
      }
      
      if (data.sortField !== undefined) {
        layoutOptions.sortField = data.sortField;
      } else if (sortFieldCache.value[collection] !== undefined) {
        layoutOptions.sortField = sortFieldCache.value[collection];
      }
      
      if (data.sortDirection !== undefined) {
        layoutOptions.sortDirection = data.sortDirection;
      } else if (sortDirectionCache.value[collection] !== undefined) {
        layoutOptions.sortDirection = sortDirectionCache.value[collection];
      }
      
      const presetData = {
        collection: presetCollection,
        layout_options: layoutOptions,
        // Required fields for preset
        icon: 'box',
        layout: 'table'
      };
      
      let response;
      
      if (presetId) {
        // Update existing preset
        response = await api.patch(`/presets/${presetId}`, {
          layout_options: layoutOptions
        });
        logDebug('Updated existing preset', { presetId, layoutOptions });
      } else {
        // Create new preset
        response = await api.post('/presets', presetData);
        if (response.data?.data?.id) {
          presetIds.value[collection] = response.data.data.id;
          logDebug('Created new preset', { 
            presetId: response.data.data.id, 
            layoutOptions 
          });
        }
      }
      
      // Update cache
      if (data.displayFields !== undefined) {
        displayFieldsCache.value[collection] = data.displayFields;
      }
      if (data.selectedLanguage !== undefined) {
        selectedLanguageCache.value[collection] = data.selectedLanguage;
      }
      if (data.showIds !== undefined) {
        showIdsCache.value[collection] = data.showIds;
      }
      if (data.hideEmptyFields !== undefined) {
        hideEmptyFieldsCache.value[collection] = data.hideEmptyFields;
      }
      if (data.sortField !== undefined) {
        sortFieldCache.value[collection] = data.sortField;
      }
      if (data.sortDirection !== undefined) {
        sortDirectionCache.value[collection] = data.sortDirection;
      }
      
    } catch (err) {
      error.value = 'Failed to save preset data';
      logError('Failed to save preset data', err);
      throw err;
    } finally {
      loading.value = false;
    }
  }
  
  /**
   * Save display fields for a collection
   */
  async function saveDisplayFields(collection: string, fields: string[]): Promise<void> {
    return savePresetData(collection, { displayFields: fields });
  }
  
  /**
   * Debounced save function to avoid too many API calls
   */
  const debouncedSave = debounce(saveDisplayFields, 500);
  
  /**
   * Get display fields for a specific collection
   */
  function getDisplayFields(collection: string): string[] {
    const fields = displayFieldsCache.value[collection] || [];
    logDebug('Getting display fields', { 
      collection, 
      fields,
      allCollections: Object.keys(displayFieldsCache.value)
    });
    return fields;
  }
  
  /**
   * Set display fields for a specific collection (with debounce)
   */
  async function setDisplayFields(collection: string, fields: string[]): Promise<void> {
    displayFieldsCache.value[collection] = fields;
    
    try {
      await debouncedSave(collection, fields);
    } catch (err) {
      logWarn('Failed to persist display fields', { collection, fields });
    }
  }
  
  /**
   * Toggle a field in the display fields for a collection
   */
  async function toggleDisplayField(collection: string, field: string): Promise<void> {
    const currentFields = getDisplayFields(collection);
    const index = currentFields.indexOf(field);
    
    let newFields: string[];
    if (index > -1) {
      newFields = currentFields.filter(f => f !== field);
    } else {
      newFields = [...currentFields, field];
    }
    
    await setDisplayFields(collection, newFields);
  }
  
  /**
   * Get selected language for a specific collection
   */
  function getSelectedLanguage(collection: string): string | null {
    const language = selectedLanguageCache.value[collection] || null;
    logDebug('Getting selected language', { 
      collection, 
      language,
      allCollections: Object.keys(selectedLanguageCache.value)
    });
    return language;
  }
  
  /**
   * Save selected language for a collection
   */
  async function saveSelectedLanguage(collection: string, language: string): Promise<void> {
    selectedLanguageCache.value[collection] = language;
    
    try {
      await debouncedSaveLanguage(collection, language);
    } catch (err) {
      logWarn('Failed to persist selected language', { collection, language });
    }
  }
  
  /**
   * Debounced save function for language
   */
  const debouncedSaveLanguage = debounce(
    (collection: string, language: string) => savePresetData(collection, { selectedLanguage: language }), 
    500
  );
  
  /**
   * Get show IDs setting for a specific collection
   */
  function getShowIds(collection: string): boolean {
    return showIdsCache.value[collection] || false;
  }
  
  /**
   * Save show IDs setting for a collection
   */
  async function saveShowIds(collection: string, showIds: boolean): Promise<void> {
    showIdsCache.value[collection] = showIds;
    
    try {
      await debouncedSaveShowIds(collection, showIds);
    } catch (err) {
      logWarn('Failed to persist show IDs setting', { collection, showIds });
    }
  }
  
  /**
   * Debounced save function for show IDs
   */
  const debouncedSaveShowIds = debounce(
    (collection: string, showIds: boolean) => savePresetData(collection, { showIds }), 
    500
  );
  
  /**
   * Get hide empty fields setting for a specific collection
   */
  function getHideEmptyFields(collection: string): boolean {
    return hideEmptyFieldsCache.value[collection] || false;
  }
  
  /**
   * Save hide empty fields setting for a collection
   */
  async function saveHideEmptyFields(collection: string, hideEmptyFields: boolean): Promise<void> {
    hideEmptyFieldsCache.value[collection] = hideEmptyFields;
    
    try {
      await debouncedSaveHideEmptyFields(collection, hideEmptyFields);
    } catch (err) {
      logWarn('Failed to persist hide empty fields setting', { collection, hideEmptyFields });
    }
  }
  
  /**
   * Debounced save function for hide empty fields
   */
  const debouncedSaveHideEmptyFields = debounce(
    (collection: string, hideEmptyFields: boolean) => savePresetData(collection, { hideEmptyFields }), 
    500
  );
  
  /**
   * Get sort field for a specific collection
   */
  function getSortField(collection: string): string | null {
    return sortFieldCache.value[collection] || null;
  }
  
  /**
   * Get sort direction for a specific collection
   */
  function getSortDirection(collection: string): 'asc' | 'desc' {
    return sortDirectionCache.value[collection] || 'asc';
  }
  
  /**
   * Save sort settings for a collection
   */
  async function saveSortSettings(collection: string, sortField: string | null, sortDirection: 'asc' | 'desc'): Promise<void> {
    sortFieldCache.value[collection] = sortField;
    sortDirectionCache.value[collection] = sortDirection;
    
    try {
      await debouncedSaveSortSettings(collection, sortField, sortDirection);
    } catch (err) {
      logWarn('Failed to persist sort settings', { collection, sortField, sortDirection });
    }
  }
  
  /**
   * Debounced save function for sort settings
   */
  const debouncedSaveSortSettings = debounce(
    (collection: string, sortField: string | null, sortDirection: 'asc' | 'desc') => 
      savePresetData(collection, { sortField, sortDirection }), 
    500
  );
  
  /**
   * Migrate data from localStorage to presets
   */
  async function migrateFromLocalStorage(): Promise<void> {
    try {
      logDebug('Checking for localStorage data to migrate');
      
      const migratedCollections: string[] = [];
      
      for (let i = 0; i < localStorage.length; i++) {
        const key = localStorage.key(i);
        if (key && key.startsWith('displayFields_')) {
          const collection = key.replace('displayFields_', '');
          const savedFields = localStorage.getItem(key);
          
          if (savedFields) {
            try {
              const fields = JSON.parse(savedFields);
              if (Array.isArray(fields)) {
                await saveDisplayFields(collection, fields);
                migratedCollections.push(collection);
              }
            } catch (err) {
              logWarn('Failed to parse localStorage data', { key, error: err });
            }
          }
        }
      }
      
      if (migratedCollections.length > 0) {
        logDebug('Migrated localStorage data to presets', { 
          collections: migratedCollections 
        });
        
        // Clear migrated localStorage data
        migratedCollections.forEach(collection => {
          localStorage.removeItem(`displayFields_${collection}`);
        });
      }
    } catch (err) {
      logError('Failed to migrate localStorage data', err);
    }
  }
  
  /**
   * Initialize presets (load and migrate if needed)
   */
  async function initialize(): Promise<void> {
    await loadPresets();
    
    // Check if we need to migrate from localStorage
    const hasLocalStorageData = Array.from({ length: localStorage.length }, (_, i) => localStorage.key(i))
      .some(key => key?.startsWith('displayFields_'));
    
    if (hasLocalStorageData) {
      await migrateFromLocalStorage();
    }
  }
  
  return {
    // State
    displayFieldsCache,
    selectedLanguageCache,
    showIdsCache,
    hideEmptyFieldsCache,
    sortFieldCache,
    sortDirectionCache,
    loading,
    error,
    
    // Methods
    loadPresets,
    saveDisplayFields,
    getDisplayFields,
    setDisplayFields,
    toggleDisplayField,
    getSelectedLanguage,
    saveSelectedLanguage,
    getShowIds,
    saveShowIds,
    getHideEmptyFields,
    saveHideEmptyFields,
    getSortField,
    getSortDirection,
    saveSortSettings,
    initialize
  };
}