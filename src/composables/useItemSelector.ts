import { ref, type Ref } from 'vue';
import { useStores } from '@directus/extensions-sdk';
import { debounce } from 'lodash-es';
import { logDebug, logError } from '../utils/logger-wrapper';

export function useItemSelector(api: any) {  // collections entfernt
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
  const availableFields = ref<any[]>([]);

  // Pagination state
  const currentPage = ref(1);
  const itemsPerPage = ref(10);
  const totalItems = ref(0);

  /**
   * Load items from the selected collection
   */
  async function loadItems() {
    if (!selectedCollection.value) return;

    loading.value = true;
    try {
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
      totalItems.value = response.data.meta?.filter_count || 0;  // Optional chaining

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

  // Debounced load items direkt definieren
  const debouncedLoadItems = debounce(loadItems, 300);

  /**
   * Open the selector for a specific collection
   */
  async function open(collection: string) {
    logDebug('Opening item selector', { collection });

    selectedCollection.value = collection;

    // Get collection info from store
    const storeCollectionInfo = collectionsStore.getCollection(collection);
    selectedCollectionName.value = storeCollectionInfo?.name || collection;
    selectedCollectionIcon.value = storeCollectionInfo?.meta?.icon || 'box';

    // Load collection fields - NEU!
    try {
      const fieldsResponse = await api.get(`/fields/${collection}`);
      const fields = fieldsResponse.data.data || [];

      // Filter out system fields that you want to exclude
      const excludedFields = ['date_created', 'date_updated', 'id', 'status', 'user_created', 'user_updated', 'sort'];
      availableFields.value = fields.filter(field => !excludedFields.includes(field.field));

      logDebug('Loaded fields', {
        collection,
        fieldCount: availableFields.value.length,
        fields: availableFields.value.map(f => f.field)
      });
    } catch (error) {
      logError('Error loading fields', error);
      availableFields.value = [];
    }

    // Reset state
    searchQuery.value = '';
    currentPage.value = 1;
    availableItems.value = [];
    totalItems.value = 0;

    isOpen.value = true;

    // Load items
    await loadItems();
  }

  /**
   * Handle search query changes
   */
  function handleSearch(query: string) {
    searchQuery.value = query;
    currentPage.value = 1;
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
   * Close the selector
   */
  function close() {
    isOpen.value = false;
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
    availableFields,

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