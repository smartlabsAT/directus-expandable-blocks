import { ref } from 'vue';
import { useStores } from '@directus/extensions-sdk';
import { debounce } from 'lodash-es';
import { logDebug, logError } from '../utils/logger-wrapper';
import type { TranslationInfo, FieldWithTranslation, CollectionMetadata, LanguageOption, ExpandableBlocksOptions } from '../types';

export function useItemSelector(api: any, _allowedCollections?: string[], options?: ExpandableBlocksOptions) {
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
  const availableFields = ref<FieldWithTranslation[]>([]);
  const loadingRelations = ref(false);
  const apiError = ref<string | null>(null);
  
  // Request management
  const detailsAbortController = ref<globalThis.AbortController | null>(null);
  const currentRequestId = ref<number>(0);
  const loadingDetails = ref(false);
  
  // Translation state
  const translationInfo = ref<TranslationInfo | null>(null);
  const selectedLanguage = ref<string>('en-US');
  const availableLanguages = ref<LanguageOption[]>([]);


  // Pagination state
  const currentPage = ref(1);
  const itemsPerPage = ref(100);
  const totalItems = ref(0);
  
  // Sorting state
  const sortField = ref<string | null>(null);
  const sortDirection = ref<'asc' | 'desc'>('asc');

  /**
   * Get cache headers based on options
   */
  function getCacheHeaders() {
    return {
      'X-Cache-Enabled': String(options?.enableCache !== false) // Default true
    };
  }

  /**
   * Load collection metadata including searchable fields
   */
  async function loadCollectionMetadata() {
    if (!selectedCollection.value) return;
    
    try {
      apiError.value = null;
      const response = await api.get(`/expandable-blocks-api/${selectedCollection.value}/metadata`, {
        headers: getCacheHeaders()
      });
      
      const metadata = response.data as CollectionMetadata;
      
      if (metadata?.searchableFields) {
        // Transform searchableFields to match the expected format
        availableFields.value = metadata.searchableFields.map((field: any) => ({
          field: field.field,
          type: field.type,
          name: field.name || field.field,
          interface: field.interface,
          display: field.display,
          options: field.options,
          display_name: field.display_name || field.field,
          searchable: field.searchable,
          weight: field.weight,
          translatable: field.translatable || false,
          translation_type: field.translation_type || 'none'
        }));
      }
      
      // Store translation info
      if (metadata?.translationInfo) {
        translationInfo.value = metadata.translationInfo;
        
        
        // Update available languages if provided
        if (metadata.translationInfo.availableLanguages) {
          availableLanguages.value = metadata.translationInfo.availableLanguages;
        }
        
        // Add translation fields to availableFields for combined translations
        if (metadata.translationInfo.hasTranslations && 
            metadata.translationInfo.translationType === 'combined' &&
            metadata.translationInfo.translationFields) {
          
          // Add translation fields that are not already in availableFields
          metadata.translationInfo.translationFields.forEach((tf: any) => {
            if (!availableFields.value.find(f => f.field === tf.field)) {
              availableFields.value.push({
                field: tf.field,
                type: tf.type,
                name: tf.name || tf.field,
                display_name: tf.name || tf.field,
                searchable: false,
                weight: 0,
                translatable: true,
                translation_type: 'combined'
              });
            }
          });
          
        }
      }
      
    } catch (error) {
      logError('Error loading collection metadata', error);
      apiError.value = 'Fehler beim Laden der Metadaten. Bitte versuchen Sie es später erneut.';
      // Fallback to empty fields
      availableFields.value = [];
    }
  }


  /**
   * Parse multiple search queries from a single string with logical operators
   * Example: "title=product OR status=active" -> {_or: [{field: 'title'...}, {field: 'status'...}]}
   */
  function parseMultipleQueries(query: string): any {
    const operators: Record<string, string> = {
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
      // Allow dots in field names for translations.field syntax
      const regex = new RegExp(`([\\w\\.]+)(${operatorPattern})(?:"([^"]+)"|([^\\s]+))`, 'g');
      
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
      // Allow dots in field names for translations.field syntax
      const regex = new RegExp(`^([\\w\\.]+)(${operatorPattern})(?:"([^"]+)"|(.+))$`);
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
   * Check if a field is translatable
   */
  function isFieldTranslatable(field: string): boolean {
    if (!translationInfo.value?.translationFields) return false;
    return translationInfo.value.translationFields.some(tf => tf.field === field);
  }

  /**
   * Transform field search to translation search if needed
   */
  function transformFieldForTranslation(field: string, operator: string, value: any) {
    const languageCode = selectedLanguage.value || 'en-US';
    
    // Check if field is already a translation field (translations.xxx)
    if (field.startsWith('translations.')) {
      const actualField = field.replace('translations.', '');
      return {
        filter: {
          _and: [
            { translations: { languages_code: { _eq: languageCode } } },
            { translations: { [actualField]: { [operator]: value } } }
          ]
        },
        isTranslationSearch: true,
        needsAnd: false
      };
    }
    
    // Check if field is translatable
    if (isFieldTranslatable(field)) {
      return {
        filter: {
          _and: [
            { translations: { languages_code: { _eq: languageCode } } },
            { translations: { [field]: { [operator]: value } } }
          ]
        },
        isTranslationSearch: true,
        needsAnd: false
      };
    }
    
    // Regular field
    return {
      filter: { [field]: { [operator]: value } },
      isTranslationSearch: false,
      needsAnd: false
    };
  }

  /**
   * Load items from the selected collection
   */
  async function loadItems() {
    if (!selectedCollection.value) return;

    loading.value = true;
    try {
      const offset = (currentPage.value - 1) * itemsPerPage.value;

      // Build params
      const params: any = {
        limit: itemsPerPage.value,
        offset: offset,
        fields: ['*', 'user_updated.first_name', 'user_updated.last_name', 'user_updated.email'],
        meta: '*'
      };
      
      // Add sorting if specified
      if (sortField.value) {
        // Check if this field exists only in translations
        const isTranslationOnlyField = translationInfo.value?.translationFields?.some(
          (tf: any) => tf.field === sortField.value
        ) && !availableFields.value.some(
          f => f.field === sortField.value && !f.translatable
        );
        
        if (isTranslationOnlyField) {
          // For translation-only fields, use nested path: translations.fieldname
          // This allows Directus to sort by the nested field
          params.sort = `${sortDirection.value === 'desc' ? '-' : ''}translations.${sortField.value}`;
          logDebug('Using nested sort path for translation-only field', { 
            field: sortField.value,
            sortPath: `translations.${sortField.value}`
          });
        } else {
          // Regular field - use direct path
          params.sort = `${sortDirection.value === 'desc' ? '-' : ''}${sortField.value}`;
        }
      }
      
      // Include translations if collection has them
      if (translationInfo.value?.hasTranslations) {
        params.fields.push('translations.*');
        
        // Add deep parameter to filter translations by language
        const languageCode = selectedLanguage.value || 'en-US';
        params.deep = {
          translations: {
            _filter: {
              languages_code: { _eq: languageCode }
            }
          }
        };
      }

      // Apply search or filter
      if (searchQuery.value) {
        // Check if query contains multiple search terms
        const queries = parseMultipleQueries(searchQuery.value);
        if (queries.length > 0) {
          // Build complex filter from multiple queries
          let currentGroup: any[] = [];
          const orGroups: any[] = [];
          let hasOr = false;
          
          queries.forEach((q: any, index: number) => {
            const transformed = transformFieldForTranslation(
              q.field,
              q.operator,
              q.value
            );
            
            const filterToAdd = transformed.needsAnd ? { _and: [transformed.filter] } : transformed.filter;
            
            if (q.logicalOp === 'OR' || (index > 0 && queries[index - 1].logicalOp === 'OR')) {
              hasOr = true;
              if (currentGroup.length > 0) {
                orGroups.push(currentGroup.length === 1 ? currentGroup[0] : { _and: currentGroup });
                currentGroup = [];
              }
            }
            
            currentGroup.push(filterToAdd);
          });
          
          if (currentGroup.length > 0) {
            orGroups.push(currentGroup.length === 1 ? currentGroup[0] : { _and: currentGroup });
          }
          
          if (hasOr) {
            params.filter = { _or: orGroups };
          } else {
            // Build filters with translation support
            const filters = queries.map((q: any) => {
              const transformed = transformFieldForTranslation(q.field, q.operator, q.value);
              return transformed.filter;
            });
            
            params.filter = filters.length === 1 ? filters[0] : { _and: filters };
          }
        } else {
          // Fulltext search with translation support
          if (translationInfo.value?.hasTranslations && translationInfo.value.translationFields?.length > 0) {
            // Create OR conditions for all searchable fields including translations
            const searchConditions: any[] = [];
            const languageCode = selectedLanguage.value || 'en-US';
            
            // Build conditions for translation fields
            const translationConditions: any[] = [];
            translationInfo.value.translationFields.forEach(field => {
              if (['string', 'text'].includes(field.type)) {
                translationConditions.push({
                  [field.field]: { _contains: searchQuery.value }
                });
              }
            });
            
            // Add translation condition if we have translatable fields
            if (translationConditions.length > 0) {
              // For each translation field, add a condition with language filter
              translationConditions.forEach(condition => {
                searchConditions.push({
                  _and: [
                    { translations: { languages_code: { _eq: languageCode } } },
                    { translations: condition }
                  ]
                });
              });
            }
            
            // Also search in main fields
            if (availableFields.value?.length > 0) {
              availableFields.value.forEach(field => {
                if (['string', 'text'].includes(field.type) && !isFieldTranslatable(field.field)) {
                  searchConditions.push({
                    [field.field]: { _contains: searchQuery.value }
                  });
                }
              });
            }
            
            if (searchConditions.length > 0) {
              params.filter = { _or: searchConditions };
            } else {
              // Fallback to normal search if no conditions
              params.search = searchQuery.value;
            }
          } else {
            // Normal fulltext search
            params.search = searchQuery.value;
          }
        }
      }

      // Convert filter and deep to JSON strings if they exist
      if (params.filter) {
        params.filter = JSON.stringify(params.filter);
      }
      if (params.deep) {
        params.deep = JSON.stringify(params.deep);
      }
      
      const response = await api.get(`/expandable-blocks-api/${selectedCollection.value}/search`, { 
        params,
        headers: getCacheHeaders()
      });

      availableItems.value = response.data.data || [];
      totalItems.value = response.data.meta?.filter_count || 0;
      
      // Clear any previous API errors
      apiError.value = null;


      // Load details for the items (non-blocking)
      if (availableItems.value.length > 0) {
        const itemIds = availableItems.value.map(item => item.id);
        // Fire and forget - don't await
        loadItemDetails(itemIds);
      }
    } catch (error: any) {
      logError('Error loading items', error);
      availableItems.value = [];
      totalItems.value = 0;
      
      // Extract meaningful error message from API response
      if (error.response?.data?.errors?.[0]?.message) {
        // Our API error format
        apiError.value = error.response.data.errors[0].message;
      } else if (error.response?.data?.message) {
        // Alternative error format
        apiError.value = error.response.data.message;
      } else if (error.message) {
        // Generic error message
        apiError.value = error.message;
      } else {
        // Fallback
        apiError.value = 'Die API ist nicht erreichbar. Bitte versuchen Sie es später erneut.';
      }
    } finally {
      loading.value = false;
    }
  }



  /**
   * Load detailed item information including usage data
   */
  async function loadItemDetails(itemIds: (string | number)[]) {
    if (!selectedCollection.value || itemIds.length === 0) return;

    // Cancel previous request if still running
    if (detailsAbortController.value) {
      detailsAbortController.value.abort();
    }

    // Increment request ID to prevent race conditions
    const requestId = ++currentRequestId.value;

    // Create new abort controller
    detailsAbortController.value = new globalThis.AbortController();
    loadingDetails.value = true;

    try {
      const response = await api.post(
        `/expandable-blocks-api/${selectedCollection.value}/detail`,
        { ids: itemIds, fields: '*' },
        { 
          signal: detailsAbortController.value.signal,
          headers: getCacheHeaders()
        }
      );

      // Only process if this is still the current request
      if (requestId !== currentRequestId.value) {
          return;
      }

      // Transform API data to match UI expectations
      const transformedRelations: Record<string, any[]> = {};

      response.data.data.forEach((item: any) => {

        if (item.usage_summary?.total_count > 0) {
          // Group usage locations by collection
          const byCollection = new Map<string, any>();
          
          item.usage_locations.forEach((location: any) => {
            const collectionKey = location.collection;
            
            if (!byCollection.has(collectionKey)) {
              byCollection.set(collectionKey, {
                collection: collectionKey,
                field: location.field || 'unknown',
                count: 0,
                items: []
              });
            }
            
            const group = byCollection.get(collectionKey);
            group.count++;
            
            // Add item details
            group.items.push({
              id: location.id,
              title: location.path || location.title || `ID: ${location.id}`,
              ...location // Keep all other fields for potential future use
            });
          });

          transformedRelations[item.id] = Array.from(byCollection.values());
          
        }
      });


      itemRelations.value = transformedRelations;
      
    } catch (error: any) {
      if (error.name !== 'AbortError') {
        logError('Error loading item details', error);
        // Don't show error to user - details are supplementary
      }
    } finally {
      if (requestId === currentRequestId.value) {
        loadingDetails.value = false;
      }
    }
  }

  // Debounced load items direkt definieren
  const debouncedLoadItems = debounce(loadItems, 300);

  /**
   * Initialize settings from user preferences or defaults
   */
  function initializeSettings(collection: string, userPrefs: any) {
    // Initialize language
    if (userPrefs?.selectedLanguage) {
      selectedLanguage.value = userPrefs.selectedLanguage;
    } else if (!selectedLanguage.value) {
      selectedLanguage.value = 'en-US';
    }
    
    // Initialize items per page
    if (userPrefs?.itemsPerPage) {
      itemsPerPage.value = userPrefs.itemsPerPage;
    }
    
    // Initialize sort settings
    if (userPrefs?.sortField) {
      sortField.value = userPrefs.sortField;
    }
    if (userPrefs?.sortDirection) {
      sortDirection.value = userPrefs.sortDirection;
    }
    
    logDebug('Initialized settings', {
      collection,
      selectedLanguage: selectedLanguage.value,
      itemsPerPage: itemsPerPage.value,
      sortField: sortField.value,
      sortDirection: sortDirection.value
    });
  }

  /**
   * Open the selector for a specific collection
   */
  async function open(collection: string, userPrefs?: any) {

    selectedCollection.value = collection;

    // Get collection info from store
    const storeCollectionInfo = collectionsStore.getCollection(collection);
    selectedCollectionName.value = storeCollectionInfo?.name || collection;
    selectedCollectionIcon.value = storeCollectionInfo?.meta?.icon || 'box';
    
    // Initialize settings from user preferences
    initializeSettings(collection, userPrefs);

    // Load collection metadata including searchable fields
    await loadCollectionMetadata();

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
   * Update sort settings
   */
  function updateSort(field: string | null, direction: 'asc' | 'desc') {
    sortField.value = field;
    sortDirection.value = direction;
    currentPage.value = 1;
    debouncedLoadItems();
  }
  
  /**
   * Update items per page
   */
  function updateItemsPerPage(value: number) {
    itemsPerPage.value = value;
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
    
    // Cleanup abort controller
    if (detailsAbortController.value) {
      detailsAbortController.value.abort();
      detailsAbortController.value = null;
    }
    
    // Reset request tracking
    currentRequestId.value = 0;
    itemRelations.value = {};
  }

  /**
   * Get translated field value from item
   */
  function getTranslatedFieldValue(item: any, field: string, language?: string): string {
    const lang = language || selectedLanguage.value;
    
    // Check if field is translatable
    if (!translationInfo.value?.hasTranslations) {
      return item[field] || '';
    }
    
    // Check if this specific field is translatable
    const translatableField = translationInfo.value.translationFields?.find(
      tf => tf.field === field || tf.coversFields?.includes(field)
    );
    
    if (!translatableField) {
      return item[field] || '';
    }
    
    // Check for translations array (O2M relation)
    if (item.translations && Array.isArray(item.translations)) {
      // Find translation for selected language
      // Try different possible language field names
      const translation = item.translations.find((t: any) => {
        return t.languages_code === lang || 
               t.languages_id === lang || 
               t.language_code === lang ||
               t.language === lang;
      });
      
      if (translation) {
        // For combined translations where fields are covered
        if (translationInfo.value.translationType === 'combined' && translatableField.coversFields?.includes(field)) {
          // Return the translated value from the translation object
          return translation[field] || item[field] || '';
        }
        
        // For standard translations
        return translation[field] || item[field] || '';
      }
    }
    
    // Fallback to main value
    return item[field] || '';
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
    loadingDetails,
    availableFields,
    itemRelations,
    loadingRelations,
    apiError,
    
    // Translation state
    translationInfo,
    selectedLanguage,
    availableLanguages,

    // Pagination
    currentPage,
    itemsPerPage,
    totalItems,
    
    // Sorting
    sortField,
    sortDirection,

    // Methods
    open,
    close,
    loadItems,
    handleSearch,
    handlePageChange,
    getTranslatedFieldValue,
    isFieldTranslatable,
    updateSort,
    updateItemsPerPage
  };
}