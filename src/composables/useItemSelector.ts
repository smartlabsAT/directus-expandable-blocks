import { ref, type Ref } from 'vue';
import { useStores } from '@directus/extensions-sdk';
import { debounce } from 'lodash-es';
import { logDebug, logError } from '../utils/logger-wrapper';

export function useItemSelector(api: any) {  // collections entfernt
  const { useCollectionsStore } = useStores();
  const collectionsStore = useCollectionsStore();
  const itemRelations = ref<Record<string, any[]>>({});

  // State
  const isOpen = ref(false);
  const selectedCollection = ref<string | null>(null);
  const selectedCollectionName = ref<string | null>(null);
  const selectedCollectionIcon = ref<string | null>(null);
  const searchQuery = ref('');
  const availableItems = ref<any[]>([]);
  const loading = ref(false);
  const availableFields = ref<any[]>([]);
  const loadingRelations = ref(false);


  // Pagination state
  const currentPage = ref(1);
  const itemsPerPage = ref(10);
  const totalItems = ref(0);


  /**
   * Parse search query for field-specific searches
   * Supports multiple space-separated queries
   * Examples: "title=test", "status=published", "name=%test%", "title=product status=active"
   */
  function parseSearchQuery(query: string) {
    // Unterstützte Operatoren
    const operators = {
      '=%': '_contains',
      '!~': '_ncontains',
      '=': '_eq',
      '~': '_contains',
      '!=': '_neq',
      '>': '_gt',
      '<': '_lt',
      '>=': '_gte',
      '<=': '_lte',
      '^': '_starts_with',
      '$': '_ends_with',
      'empty': '_empty',
      '!empty': '_nempty',
      'null': '_null',
      '!null': '_nnull'
    };

    // Regex mit allen Operatoren
    const operatorPattern = Object.keys(operators)
        .map(op => op.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'))
        .join('|');

    const fieldSearchRegex = new RegExp(`^(\\w+)(${operatorPattern})(.+)$`);
    const match = query.match(fieldSearchRegex);

    if (match) {
      let [, field, operator, value] = match;

      // Spezialbehandlung für %
      if (value.startsWith('%') && value.endsWith('%')) {
        operator = '=%';
        value = value.slice(1, -1);
      }

      return {
        isFieldSearch: true,
        field,
        operator: operators[operator] || '_eq',
        value
      };
    }

    return {
      isFieldSearch: false,
      query
    };
  }

  /**
   * Parse multiple search queries from a single string with logical operators
   * Example: "title=product OR status=active" -> {_or: [{field: 'title'...}, {field: 'status'...}]}
   */
  function parseMultipleQueries(query: string): any {
    const operators = {
      '=%': '_contains',
      '!~': '_ncontains',
      '=': '_eq',
      '~': '_contains',
      '!=': '_neq',
      '>': '_gt',
      '<': '_lt',
      '>=': '_gte',
      '<=': '_lte',
      '^': '_starts_with',
      '$': '_ends_with',
      'empty': '_empty',
      '!empty': '_nempty',
      'null': '_null',
      '!null': '_nnull'
    };

    // Split by AND/OR while preserving the operators
    const parts = query.split(/\s+(AND|OR)\s+/i);
    
    if (parts.length === 1) {
      // No logical operators, parse as before
      const results = [];
      const operatorPattern = Object.keys(operators)
          .map(op => op.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'))
          .join('|');
      
      // Match pattern: field operator value (with support for quoted values)
      const regex = new RegExp(`(\\w+)(${operatorPattern})(?:"([^"]+)"|([^\\s]+))`, 'g');
      
      let match;
      while ((match = regex.exec(query)) !== null) {
        const [, field, operator, quotedValue, unquotedValue] = match;
        const value = quotedValue || unquotedValue;
        
        results.push({
          field,
          operator: operators[operator] || '_eq',
          value
        });
      }
      
      return results;
    }
    
    // Parse with logical operators
    const filters = [];
    let currentLogicalOp = 'AND'; // Default
    
    for (let i = 0; i < parts.length; i++) {
      const part = parts[i].trim();
      
      if (part === 'AND' || part === 'OR') {
        currentLogicalOp = part;
        continue;
      }
      
      // Parse individual query
      const operatorPattern = Object.keys(operators)
          .map(op => op.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'))
          .join('|');
      const regex = new RegExp(`^(\\w+)(${operatorPattern})(?:"([^"]+)"|(.+))$`);
      const match = part.match(regex);
      
      if (match) {
        const [, field, operator, quotedValue, unquotedValue] = match;
        const value = (quotedValue || unquotedValue || '').trim();
        
        filters.push({
          field,
          operator: operators[operator] || '_eq',
          value,
          logicalOp: i > 0 ? currentLogicalOp : null
        });
      }
    }
    
    return filters;
  }


  /**
   * Load items from the selected collection
   */
  async function loadItems() {
    if (!selectedCollection.value) return;

    loading.value = true;
    try {
      const offset = (currentPage.value - 1) * itemsPerPage.value;

      // Parse search query
      const searchParsed = parseSearchQuery(searchQuery.value);

      // Build params
      const params: any = {
        limit: itemsPerPage.value,
        offset: offset,
        fields: ['*'],
        meta: '*'
      };

      // Apply search or filter
      if (searchParsed.isFieldSearch) {
        // Field-specific search als Filter
        params.filter = {
          [searchParsed.field]: {
            [searchParsed.operator]: searchParsed.value
          }
        };
      } else if (searchQuery.value) {
        // Check if query contains multiple search terms
        const queries = parseMultipleQueries(searchQuery.value);
        if (queries.length > 0) {
          // Build complex filter from multiple queries
          let currentGroup = [];
          const orGroups = [];
          let hasOr = false;
          
          queries.forEach((q, index) => {
            const filter = {
              [q.field]: {
                [q.operator]: q.value
              }
            };
            
            if (q.logicalOp === 'OR' || (index > 0 && queries[index - 1].logicalOp === 'OR')) {
              hasOr = true;
              if (currentGroup.length > 0) {
                orGroups.push(currentGroup.length === 1 ? currentGroup[0] : { _and: currentGroup });
                currentGroup = [];
              }
            }
            
            currentGroup.push(filter);
          });
          
          if (currentGroup.length > 0) {
            orGroups.push(currentGroup.length === 1 ? currentGroup[0] : { _and: currentGroup });
          }
          
          if (hasOr) {
            params.filter = { _or: orGroups };
          } else {
            params.filter = { _and: queries.map(q => ({ [q.field]: { [q.operator]: q.value } })) };
          }
        } else {
          // Normale Volltextsuche
          params.search = searchQuery.value;
        }
      }

      const response = await api.get(`/items/${selectedCollection.value}`, { params });

      availableItems.value = response.data.data || [];
      totalItems.value = response.data.meta?.filter_count || 0;
      await loadItemRelations();

      logDebug('Loaded items', {
        collection: selectedCollection.value,
        searchQuery: searchQuery.value,
        isFieldSearch: searchParsed.isFieldSearch,
        itemsOnPage: availableItems.value.length,
        totalCount: totalItems.value
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
   * Load relation information for all loaded items
   */
  async function loadItemRelations() {
    if (!selectedCollection.value || availableItems.value.length === 0) return;

    loadingRelations.value = true;
    itemRelations.value = {};

    try {
      // Get all relations that point TO this collection
      // const relationsResponse = await api.get('/relations', {
      //   params: {
      //     filter: {
      //       related_collection: {
      //         _eq: selectedCollection.value
      //       }
      //     }
      //   }
      // });

      // const incomingRelations = relationsResponse.data.data || [];

      // Für jedes Item prüfen, wo es verwendet wird
      // for (const item of availableItems.value) {
      //   if (!item.id) continue;
      //
      //   const usages = [];

        // Prüfe jede eingehende Relation
        // for (const relation of incomingRelations) {
        //   try {
        //     // Suche nach Items die auf dieses Item verweisen
        //     const usageResponse = await api.get(`/items/${relation.collection}`, {
        //       params: {
        //         filter: {
        //           [relation.field]: {
        //             _eq: item.id
        //           }
        //         },
        //         fields: ['id', 'status', relation.meta?.display_template || '*'],
        //         limit: 100
        //       }
        //     });
        //
        //     if (usageResponse.data.data?.length > 0) {
        //       usages.push({
        //         collection: relation.collection,
        //         field: relation.field,
        //         items: usageResponse.data.data,
        //         count: usageResponse.data.data.length
        //       });
        //     }
        //   } catch (error) {
        //     logError(`Error checking usage in ${relation.collection}`, error);
        //   }
        // }

      //   if (usages.length > 0) {
      //     itemRelations.value[item.id] = usages;
      //   }
      // }

      logDebug('Loaded item relations', itemRelations.value);
    } catch (error) {
      logError('Error loading relations', error);
    } finally {
      loadingRelations.value = false;
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
    itemRelations,
    loadingRelations,

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