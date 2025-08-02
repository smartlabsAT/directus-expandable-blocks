import { ref, computed } from 'vue';
import { useStores, useApi } from '@directus/extensions-sdk';
import { debounce } from 'lodash-es';
import { logDebug, logError, logWarn } from '../utils/logger-wrapper';




interface CollectionSettings {
  displayFields?: string[];
  selectedLanguage?: string;
  showIds?: boolean;
  hideEmptyFields?: boolean;
  sortField?: string | null;
  sortDirection?: 'asc' | 'desc';
  itemsPerPage?: number;
  showLastUpdate?: boolean;
  viewMode?: 'list' | 'table';
  rememberSearch?: boolean;
  lastSearch?: string;
  drawerWidth?: number;
  columnWidths?: Record<string, number>;
}

interface AllSettings {
  [collection: string]: CollectionSettings;
}

export function useUserPresets() {
  // Try to use native preset store
  let presetsStore: any = null;
  let userStore: any = null;
  try {
    const { usePresetsStore, useUserStore } = useStores();
    presetsStore = usePresetsStore();
    userStore = useUserStore();
    logDebug('Using native Directus Preset Store');
  } catch {
    logWarn('Preset Store not available, using API only');
  }
  
  const api = useApi();
  
  // Get current user ID
  const currentUserId = computed(() => {
    return userStore?.currentUser?.id || null;
  });
  
  // Single preset ID for all settings
  const presetId = ref<number | null>(null);
  const allSettings = ref<AllSettings>({});
  const loading = ref(false);
  const error = ref<string | null>(null);
  
  // Fixed collection name for our preset
  const PRESET_COLLECTION = 'expandable_blocks';
  
  // Get current preset from store if available
  const expandableBlocksPreset = computed(() => {
    if (!presetsStore) return null;
    try {
      // Get user-specific preset (not global presets)
      const allPresets = presetsStore.collectionPresets?.[PRESET_COLLECTION] || [];
      return allPresets.find((p: any) => p.user !== null) || null;
    } catch {
      return null;
    }
  });
  
  /**
   * Load the single preset containing all settings
   */
  async function loadPreset(): Promise<void> {
    loading.value = true;
    error.value = null;
    
    try {
      logDebug('Loading expandable blocks preset');
      
      // Try store first
      if (presetsStore && presetsStore.hydrate) {
        await presetsStore.hydrate();
        const preset = expandableBlocksPreset.value;
        if (preset) {
          presetId.value = preset.id;
          if (preset.layout_options && typeof preset.layout_options === 'object') {
            allSettings.value = preset.layout_options as AllSettings;
            logDebug('Loaded preset from store', { 
              presetId: preset.id, 
              collections: Object.keys(allSettings.value) 
            });
            return;
          }
        }
      }
      
      // Fallback to API
      const response = await api.get('/presets', {
        params: {
          filter: {
            collection: { _eq: PRESET_COLLECTION },
            user: { _nnull: true } // Only get user-specific presets
          },
          fields: ['id', 'layout_options'],
          limit: 1
        }
      });
      
      const presets = response.data?.data || [];
      
      if (presets.length > 0) {
        const preset = presets[0];
        presetId.value = preset.id;
        
        if (preset.layout_options && typeof preset.layout_options === 'object') {
          allSettings.value = preset.layout_options as AllSettings;
          logDebug('Loaded preset via API', { 
            presetId: preset.id, 
            collections: Object.keys(allSettings.value) 
          });
        }
      } else {
        logDebug('No preset found, starting with empty settings');
        allSettings.value = {};
      }
    } catch (err) {
      error.value = 'Failed to load preset';
      logError('Failed to load preset', err);
    } finally {
      loading.value = false;
    }
  }
  
  /**
   * Save all settings to the preset
   */
  async function savePreset(): Promise<void> {
    logDebug('Saving preset', { 
      presetId: presetId.value,
      collections: Object.keys(allSettings.value)
    });
    
    loading.value = true;
    error.value = null;
    
    try {
      // Try using store methods
      if (presetsStore && presetId.value && presetsStore.update) {
        // Update existing preset via store
        await presetsStore.update(presetId.value, {
          layout_options: allSettings.value
        });
        logDebug('Updated preset via store', { presetId: presetId.value });
      } else if (presetsStore && !presetId.value && presetsStore.create) {
        // Create new preset via store
        logDebug('Creating preset with user ID', { userId: currentUserId.value });
        const created = await presetsStore.create({
          collection: PRESET_COLLECTION,
          layout: 'custom',
          layout_options: allSettings.value,
          icon: 'view_module',
          user: currentUserId.value // Create as user-specific preset
        });
        if (created?.id) {
          presetId.value = created.id;
          logDebug('Created preset via store', { presetId: created.id });
        }
      } else {
        // Fallback to API
        const presetData = {
          collection: PRESET_COLLECTION,
          layout: 'custom',
          layout_options: allSettings.value,
          icon: 'view_module',
          user: currentUserId.value // Create as user-specific preset
        };
        
        let response;
        
        if (presetId.value) {
          // Update existing preset
          await api.patch(`/presets/${presetId.value}`, {
            layout_options: allSettings.value
          });
          logDebug('Updated preset via API', { presetId: presetId.value });
        } else {
          // Create new preset
          logDebug('Creating preset via API with user ID', { userId: currentUserId.value });
          response = await api.post('/presets', presetData);
          if (response.data?.data?.id) {
            presetId.value = response.data.data.id;
            logDebug('Created preset via API', { presetId: presetId.value });
          }
        }
      }
    } catch (err) {
      error.value = 'Failed to save preset';
      logError('Failed to save preset', err);
    } finally {
      loading.value = false;
    }
  }

  // Debounced save
  const debouncedSave = debounce(savePreset, 500);

  /**
   * Get settings for a specific collection
   */
  function getCollectionSettings(collection: string): CollectionSettings {
    return allSettings.value[collection] || {};
  }
  
  /**
   * Update settings for a specific collection
   */
  function updateCollectionSettings(collection: string, updates: Partial<CollectionSettings>): void {
    if (!allSettings.value[collection]) {
      allSettings.value[collection] = {};
    }
    
    Object.assign(allSettings.value[collection], updates);
    debouncedSave();
  }
  
  // Specific getters and setters for each setting type
  function getDisplayFields(collection: string): string[] {
    return getCollectionSettings(collection).displayFields || [];
  }
  
  async function setDisplayFields(collection: string, fields: string[]): Promise<void> {
    updateCollectionSettings(collection, { displayFields: fields });
  }
  
  function getSelectedLanguage(collection: string): string | null {
    return getCollectionSettings(collection).selectedLanguage || null;
  }
  
  async function saveSelectedLanguage(collection: string, language: string): Promise<void> {
    updateCollectionSettings(collection, { selectedLanguage: language });
  }
  
  function getShowIds(collection: string): boolean {
    return getCollectionSettings(collection).showIds || false;
  }
  
  async function saveShowIds(collection: string, showIds: boolean): Promise<void> {
    updateCollectionSettings(collection, { showIds });
  }
  
  function getHideEmptyFields(collection: string): boolean {
    return getCollectionSettings(collection).hideEmptyFields || false;
  }
  
  async function saveHideEmptyFields(collection: string, hideEmptyFields: boolean): Promise<void> {
    updateCollectionSettings(collection, { hideEmptyFields });
  }
  
  function getSortField(collection: string): string | null {
    return getCollectionSettings(collection).sortField || null;
  }
  
  function getSortDirection(collection: string): 'asc' | 'desc' {
    return getCollectionSettings(collection).sortDirection || 'asc';
  }
  
  async function saveSortSettings(collection: string, sortField: string | null, sortDirection: 'asc' | 'desc'): Promise<void> {
    updateCollectionSettings(collection, { sortField, sortDirection });
  }
  
  function getItemsPerPage(collection: string): number {
    return getCollectionSettings(collection).itemsPerPage || 100;
  }
  
  async function saveItemsPerPage(collection: string, itemsPerPage: number): Promise<void> {
    updateCollectionSettings(collection, { itemsPerPage });
  }
  
  function getShowLastUpdate(collection: string): boolean {
    return getCollectionSettings(collection).showLastUpdate || false;
  }
  
  async function saveShowLastUpdate(collection: string, showLastUpdate: boolean): Promise<void> {
    updateCollectionSettings(collection, { showLastUpdate });
  }
  
  function getViewMode(collection: string): 'list' | 'table' {
    return getCollectionSettings(collection).viewMode || 'table';
  }
  
  async function saveViewMode(collection: string, viewMode: 'list' | 'table'): Promise<void> {
    updateCollectionSettings(collection, { viewMode });
  }
  
  function getRememberSearch(collection: string): boolean {
    return getCollectionSettings(collection).rememberSearch || false;
  }
  
  async function saveRememberSearch(collection: string, rememberSearch: boolean): Promise<void> {
    updateCollectionSettings(collection, { rememberSearch });
  }
  
  function getLastSearch(collection: string): string {
    return getCollectionSettings(collection).lastSearch || '';
  }
  
  async function saveLastSearch(collection: string, lastSearch: string): Promise<void> {
    const settings = getCollectionSettings(collection);
    if (settings.rememberSearch) {
      updateCollectionSettings(collection, { lastSearch });
    }
  }
  
  function getDrawerWidth(collection: string): number {
    return getCollectionSettings(collection).drawerWidth || 856;
  }
  
  async function saveDrawerWidth(collection: string, drawerWidth: number): Promise<void> {
    updateCollectionSettings(collection, { drawerWidth });
  }
  
  function loadColumnWidths(collection: string): Record<string, number> {
    return getCollectionSettings(collection).columnWidths || {};
  }
  
  async function saveColumnWidths(collection: string, columnWidths: Record<string, number>): Promise<void> {
    updateCollectionSettings(collection, { columnWidths });
  }
  
  async function clearColumnWidths(collection: string): Promise<void> {
    updateCollectionSettings(collection, { columnWidths: {} });
  }
  
  /**
   * Initialize - load preset
   */
  async function initialize(): Promise<void> {
    await loadPreset();
  }
  
  return {
    // State
    loading,
    error,
    
    // Methods
    loadPresets: loadPreset,
    saveDisplayFields: setDisplayFields,
    getDisplayFields,
    setDisplayFields,
    getSelectedLanguage,
    saveSelectedLanguage,
    getShowIds,
    saveShowIds,
    getHideEmptyFields,
    saveHideEmptyFields,
    getSortField,
    getSortDirection,
    saveSortSettings,
    getItemsPerPage,
    saveItemsPerPage,
    getShowLastUpdate,
    saveShowLastUpdate,
    getViewMode,
    saveViewMode,
    getRememberSearch,
    saveRememberSearch,
    getLastSearch,
    saveLastSearch,
    getDrawerWidth,
    saveDrawerWidth,
    saveColumnWidths,
    loadColumnWidths,
    clearColumnWidths,
    initialize
  };
}