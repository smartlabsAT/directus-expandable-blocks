import { ref, type Ref } from 'vue';
import { useStores } from '@directus/extensions-sdk';
import { debounce } from 'lodash-es';
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
  // Get stores
  const { useCollectionsStore } = useStores();
  const collectionsStore = useCollectionsStore();
  
  // State
  const isOpen = ref(false);
  const selectedCollection = ref<string | null>(null);
  const selectedCollectionName = ref<string | null>(null);
  const selectedCollectionIcon = ref<string | null>(null);
  const searchQuery = ref('');
  const availableItems = ref<any[]>([]);
  const loading = ref(false);
  
  // Pagination state
  const currentPage = ref(1);
  const itemsPerPage = ref(10);
  const totalItems = ref(0);

  /**
   * Open the selector for a specific collection
   */
  async function open(collection: string) {
    logDebug('Opening item selector', { collection });
    selectedCollection.value = collection;
    
    // Get collection info from store (same as BlockHeader does)
    const storeCollectionInfo = collectionsStore.getCollection(collection);
    
    // Set name and icon from store or use defaults
    selectedCollectionName.value = storeCollectionInfo?.name || collection;
    selectedCollectionIcon.value = storeCollectionInfo?.meta?.icon || 'box';
    
    // Reset search and pagination
    searchQuery.value = '';
    currentPage.value = 1;
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
      // Calculate offset
      const offset = (currentPage.value - 1) * itemsPerPage.value;
      
      const response = await api.get(`/items/${selectedCollection.value}`, {
        params: {
          limit: itemsPerPage.value,
          offset: offset,
          fields: ['*'],
          search: searchQuery.value || undefined,
          meta: '*'
        }
      });
      
      availableItems.value = response.data.data || [];
      


    totalItems.value = response.data.meta['filter_count']  || 0;
      
      logDebug('Loaded items', { 
        collection: selectedCollection.value, 
        searchQuery: searchQuery.value,
        itemsOnPage: availableItems.value.length,
        totalCount: totalItems.value,
        currentPage: currentPage.value,
        totalPages: Math.ceil(totalItems.value / itemsPerPage.value)
      });
    } catch (error) {
      logError('Error loading items', error);
      availableItems.value = [];
      totalItems.value = 0;
    } finally {
      loading.value = false;
    }
  }

  /**
   * Debounced load items function
   */
  const debouncedLoadItems = debounce(loadItems, 300);

  /**
   * Handle search query changes
   */
  function handleSearch(query: string) {
    searchQuery.value = query;
    currentPage.value = 1; // Reset to first page on search
    debouncedLoadItems();
  }
  
  /**
   * Handle page changes
   */
  function handlePageChange(page: number) {
    currentPage.value = page;
    loadItems();
  }

  /**
   * Close the selector and reset state
   */
  function close() {
    isOpen.value = false;
    selectedCollection.value = null;
    selectedCollectionName.value = null;
    selectedCollectionIcon.value = null;
    searchQuery.value = '';
    availableItems.value = [];
    currentPage.value = 1;
    totalItems.value = 0;
  }

  return {
    // State
    isOpen,
    selectedCollection,
    selectedCollectionName,
    selectedCollectionIcon,
    searchQuery,
    availableItems,
    loading,
    
    // Pagination
    currentPage,
    itemsPerPage,
    totalItems,
    
    // Methods
    open,
    close,
    loadItems,
    handleSearch,
    handlePageChange
  };
}