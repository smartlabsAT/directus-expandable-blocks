import { ref, type Ref } from 'vue';
import type { CollectionInfo } from '../types';
import { logDebug, logError } from '../utils/logger-wrapper';

/**
 * Composable for managing the item selector drawer functionality
 * 
 * Handles:
 * - Opening/closing the drawer
 * - Loading items from selected collection
 * - Search functionality
 * - Selection state management
 */
export function useItemSelector(api: any, collections: Ref<CollectionInfo[]>) {
  // State
  const isOpen = ref(false);
  const selectedCollection = ref<string | null>(null);
  const searchQuery = ref('');
  const availableItems = ref<any[]>([]);
  const loading = ref(false);

  /**
   * Open the selector for a specific collection
   */
  async function open(collection: string) {
    logDebug('Opening item selector', { collection });
    selectedCollection.value = collection;
    searchQuery.value = '';
    isOpen.value = true;
    
    // Load items
    await loadItems();
  }

  /**
   * Load items from the selected collection
   */
  async function loadItems() {
    if (!selectedCollection.value) return;
    
    loading.value = true;
    try {
      const response = await api.get(`/items/${selectedCollection.value}`, {
        params: {
          limit: -1,
          fields: ['*'],
          filter: searchQuery.value ? {
            _or: [
              { name: { _contains: searchQuery.value } },
              { title: { _contains: searchQuery.value } },
              { label: { _contains: searchQuery.value } }
            ]
          } : {}
        }
      });
      
      availableItems.value = response.data.data || [];
      logDebug('Loaded items', { 
        collection: selectedCollection.value, 
        count: availableItems.value.length 
      });
    } catch (error) {
      logError('Error loading items', error);
      availableItems.value = [];
    } finally {
      loading.value = false;
    }
  }

  /**
   * Handle search query changes
   */
  async function handleSearch(query: string) {
    searchQuery.value = query;
    await loadItems();
  }

  /**
   * Close the selector and reset state
   */
  function close() {
    isOpen.value = false;
    selectedCollection.value = null;
    searchQuery.value = '';
    availableItems.value = [];
  }

  return {
    // State
    isOpen,
    selectedCollection,
    searchQuery,
    availableItems,
    loading,
    
    // Methods
    open,
    close,
    loadItems,
    handleSearch
  };
}