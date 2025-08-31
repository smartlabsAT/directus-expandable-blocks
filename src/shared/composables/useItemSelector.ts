import { ref, watch } from 'vue';
import { useStores } from '@directus/extensions-sdk';
import { debounce } from 'lodash-es';
import { handleApiError } from '../../utils/error-helpers';
import type { TranslationInfo, FieldWithTranslation, LanguageOption } from '../../types';
import { createApiClient } from '../../services/api-client';
import type { IDirectusApiClient, SearchOptions } from '../../services/api-client.types';
import type { ItemSelectorConfig } from '../types/ItemSelectorConfig';
import { DEFAULT_ITEM_SELECTOR_CONFIG } from '../types/ItemSelectorConfig';
import { createScopedLogger } from '../utils/logger';

/**
 * Generic ItemSelector composable for reuse across extensions
 * 
 * @param api Directus API instance
 * @param allowedCollections Optional array of allowed collections
 * @param config Configuration options for customizing behavior
 * @returns ItemSelector state and methods
 */
export function useItemSelector(
  api: any, 
  allowedCollections?: string[], 
  config: ItemSelectorConfig = {}
) {
  // Merge provided config with defaults
  const finalConfig = { ...DEFAULT_ITEM_SELECTOR_CONFIG, ...config };
  
  // Create scoped logger with configurable prefix
  const logger = createScopedLogger(finalConfig.loggerPrefix);
  
  const { useCollectionsStore } = useStores();
  const collectionsStore = useCollectionsStore();
  const itemRelations = ref<Record<string, any[]>>({});
  
  // Initialize API client - use provided one or create default
  const apiClient: IDirectusApiClient = finalConfig.apiClient || createApiClient(api);

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
  const selectedLanguage = ref<string>(finalConfig.defaultLanguage);
  const availableLanguages = ref<LanguageOption[]>([]);

  // Watch for language changes and reload items
  watch(selectedLanguage, (newLang, oldLang) => {
    if (newLang !== oldLang && selectedCollection.value && availableItems.value.length > 0) {
      loadItems();
    }
  });

  // Pagination state
  const currentPage = ref(1);
  const itemsPerPage = ref(finalConfig.defaultItemsPerPage);
  const totalItems = ref(0);
  
  // Sorting state
  const sortField = ref<string | null>(null);
  const sortDirection = ref<'asc' | 'desc'>('asc');

  /**
   * Load collection metadata including searchable fields
   */
  async function loadCollectionMetadata() {
    if (!selectedCollection.value) return;
    
    try {
      apiError.value = null;
      
      // Use the API client to get metadata
      const metadata = await apiClient.getCollectionMetadata(selectedCollection.value);
      
      // Map native Directus fields to our format
      const metadataCompat: any = {
        ...metadata,
        displayableFields: metadata.fields
          ?.filter(field => {
            // Filter out system fields but keep translatable fields
            if (field.field === 'id') return false;
            if (field.field === 'translations') return false;
            if (['user_created', 'user_updated', 'date_created', 'date_updated', 'sort'].includes(field.field)) {
              return false;
            }
            if (field.meta?.hidden) return false;
            return true;
          })
          .map((field: any) => ({
            field: field.field,
            type: field.type || field.schema?.data_type || 'string',
            field_name: field.meta?.display || field.field,
            name: field.meta?.display || field.field,
            interface: field.meta?.interface,
            display: field.meta?.display,
            options: field.meta?.options,
            searchable: ['string', 'text', 'json'].includes(field.type || field.schema?.data_type || ''),
            weight: field.meta?.sort || 0,
            translatable: metadata.translations?.translatableFields?.includes(field.field) || false,
            translation_type: metadata.translations?.translatableFields?.includes(field.field) ? 'json' : 'none'
          })),
        translationInfo: metadata.translations ? {
          hasTranslations: true,
          translationType: 'json',
          translationsCollection: metadata.translations.translationsCollection,
          languageField: metadata.translations.languageField,
          translationFields: metadata.translations.translatableFields,
          availableLanguages: []
        } : undefined
      };
      
      logger.debug('Metadata after mapping', {
        collection: selectedCollection.value,
        displayableFieldsCount: metadataCompat.displayableFields?.length || 0,
        hasTranslationInfo: !!metadataCompat.translationInfo,
        displayableFieldNames: metadataCompat.displayableFields?.map((f: any) => f.field)
      });
      
      // Use displayableFields for UI
      if (metadataCompat?.displayableFields) {
        availableFields.value = metadataCompat.displayableFields.map((field: any) => ({
          field: field.field,
          type: field.type,
          name: field.field_name || field.name || field.field,
          interface: field.interface,
          display: field.display,
          options: field.options,
          display_name: field.field_name || field.name || field.field,
          searchable: field.searchable || false,
          weight: field.weight || 0,
          translatable: field.translatable || false,
          translation_type: field.translation_type || 'none'
        }));
      } else if (metadataCompat?.searchableFields) {
        // Fallback to searchableFields if displayableFields not available
        availableFields.value = metadataCompat.searchableFields.map((field: any) => ({
          field: field.field,
          type: field.type,
          name: field.field_name || field.name || field.field,
          interface: field.interface,
          display: field.display,
          options: field.options,
          display_name: field.field_name || field.name || field.field,
          searchable: true,
          weight: field.weight || 0,
          translatable: field.translatable || false,
          translation_type: field.translation_type || 'none'
        }));
      }
      
      // Store translation info
      if (metadataCompat?.translationInfo) {
        translationInfo.value = metadataCompat.translationInfo;
        
        // Load available languages
        await loadAvailableLanguages();
        
        // Add translation fields to availableFields
        if (metadataCompat.translationInfo.hasTranslations && 
            metadataCompat.translationInfo.translationFields && 
            metadataCompat.translationInfo.translationFields.length > 0) {
          
          const fieldsToProcess = Array.isArray(metadataCompat.translationInfo.translationFields) 
            ? metadataCompat.translationInfo.translationFields
            : [];
            
          fieldsToProcess.forEach((fieldItem: any) => {
            const fieldName = typeof fieldItem === 'string' ? fieldItem : fieldItem?.field;
            
            if (!fieldName) return;
            
            if (!availableFields.value.find(f => f.field === fieldName)) {
              availableFields.value.push({
                field: fieldName,
                type: 'string',
                name: fieldName || 'unknown',
                display_name: fieldName || 'unknown',
                searchable: true,
                weight: 100,
                translatable: true,
                translation_type: metadataCompat.translationInfo.translationType || 'json',
                interface: 'input',
                display: undefined,
                options: undefined
              });
            }
          });
        }
      }
      
    } catch (error: any) {
      // Use centralized error handling
      apiError.value = handleApiError(error, 'load', {
        logContext: { collection: selectedCollection.value }
      });
      
      // Fallback to empty fields
      availableFields.value = [];
    }
  }

  /**
   * Parse multiple search queries from a single string with logical operators
   */
  function parseMultipleQueries(query: string): { queries: any[], unparsedText: string } {
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

    const parsedParts: string[] = [];
    const parts = query.split(/\s+(AND|OR)\s+/i);
    
    if (parts.length === 1) {
      const results = [];
      const operatorPattern = Object.keys(operators)
          .map(op => op.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'))
          .join('|');
      
      const regex = new RegExp(`([\\w\\.]+)\\s*(${operatorPattern})\\s*(?:"([^"]+)"|'([^']+)'|([^\\s]+))`, 'g');
      
      let match;
      while ((match = regex.exec(query)) !== null) {
        const [fullMatch, field, operator, quotedDouble, quotedSingle, unquotedValue] = match;
        const value = quotedDouble || quotedSingle || unquotedValue;
        
        results.push({
          field,
          operator: operators[operator] || '_eq',
          value
        });
        
        parsedParts.push(fullMatch);
      }
      
      let unparsedText = query;
      parsedParts.forEach(part => {
        unparsedText = unparsedText.split(part).join('');
      });
      unparsedText = unparsedText.trim();
      
      if (results.length === 0 && parsedParts.length === 0) {
        unparsedText = query;
      }
      
      return { queries: results, unparsedText };
    }
    
    // Parse with logical operators
    const filters = [];
    const unparsedParts: string[] = [];
    let currentLogicalOp = 'AND';
    
    for (let i = 0; i < parts.length; i++) {
      const part = parts[i].trim();
      
      if (part === 'AND' || part === 'OR') {
        currentLogicalOp = part;
        continue;
      }
      
      const operatorPattern = Object.keys(operators)
          .map(op => op.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'))
          .join('|');
      const regex = new RegExp(`^([\\w\\.]+)\\s*(${operatorPattern})\\s*(?:"([^"]+)"|'([^']+)'|([^\\s]+))(?:\\s+(.*))?$`);
      const match = part.match(regex);
      
      if (match) {
        const [, field, operator, quotedDouble, quotedSingle, unquotedValue, restText] = match;
        const value = (quotedDouble || quotedSingle || unquotedValue || '').trim();
        
        if (restText) {
          unparsedParts.push(restText);
        }
        
        filters.push({
          field,
          operator: operators[operator] || '_eq',
          value,
          logicalOp: i > 0 ? currentLogicalOp : null
        });
      } else {
        unparsedParts.push(part);
      }
    }
    
    return { 
      queries: filters, 
      unparsedText: unparsedParts.join(' ').trim() 
    };
  }

  /**
   * Check if a field is translatable
   */
  function isFieldTranslatable(field: string): boolean {
    if (!translationInfo.value?.translationFields) return false;
    
    if (Array.isArray(translationInfo.value.translationFields)) {
      if (translationInfo.value.translationFields.length === 0) return false;
      
      if (typeof translationInfo.value.translationFields[0] === 'object' && 'field' in translationInfo.value.translationFields[0]) {
        return (translationInfo.value.translationFields as any[]).some(tf => tf.field === field);
      } else {
        return (translationInfo.value.translationFields as string[]).includes(field);
      }
    }
    
    return false;
  }

  /**
   * Transform field search to translation search if needed
   */
  function transformFieldForTranslation(field: string, operator: string, value: any) {
    const languageCode = selectedLanguage.value || finalConfig.defaultLanguage;
    
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
    
    return {
      filter: { [field]: { [operator]: value } },
      isTranslationSearch: false,
      needsAnd: false
    };
  }

  /**
   * Load available languages from Directus
   */
  async function loadAvailableLanguages() {
    try {
      logger.debug('Attempting to load languages from collection: languages');
      
      const response = await apiClient.searchItems('languages', {
        fields: ['code', 'name'],
        limit: 100,
        sort: ['name']
      });
      
      if (response?.data && response.data.length > 0) {
        availableLanguages.value = response.data.map((lang: any) => ({
          code: lang.code,
          name: lang.name || lang.code
        }));
        
        if (!selectedLanguage.value && availableLanguages.value.length > 0) {
          selectedLanguage.value = availableLanguages.value[0].code;
        }
      } else {
        // Fallback to common languages
        availableLanguages.value = [
          { code: 'en-US', name: 'English' },
          { code: 'de-DE', name: 'Deutsch' },
          { code: 'fr-FR', name: 'Français' }
        ];
        
        if (!selectedLanguage.value) {
          selectedLanguage.value = finalConfig.defaultLanguage;
        }
      }
    } catch (error) {
      logger.error('Failed to load languages, using defaults', error);
      // Fallback to common languages
      availableLanguages.value = [
        { code: 'en-US', name: 'English' },
        { code: 'de-DE', name: 'Deutsch' },
        { code: 'fr-FR', name: 'Français' }
      ];
      
      if (!selectedLanguage.value) {
        selectedLanguage.value = finalConfig.defaultLanguage;
      }
    }
  }
  
  /**
   * Load items from the selected collection
   */
  async function loadItems() {
    if (!selectedCollection.value) return;

    loading.value = true;
    try {
      const offset = (currentPage.value - 1) * itemsPerPage.value;

      const params: any = {
        limit: itemsPerPage.value,
        offset: offset,
        fields: ['*'],
        meta: '*'
      };
      
      // Include translations if available
      if (translationInfo.value?.hasTranslations && translationInfo.value?.translationsCollection) {
        params.fields = ['*', `translations.*`];
        
        logger.debug('Including translations in query', {
          collection: selectedCollection.value,
          translationsCollection: translationInfo.value.translationsCollection,
          selectedLanguage: selectedLanguage.value,
          fields: params.fields
        });
      }
      
      // Add sorting if specified
      if (sortField.value) {
        const isTranslatableField = isFieldTranslatable(sortField.value);
        
        if (!isTranslatableField) {
          params.sort = `${sortDirection.value === 'desc' ? '-' : ''}${sortField.value}`;
        }
      }
      
      // Include translations
      if (translationInfo.value?.hasTranslations) {
        params.fields.push('translations.*');
        
        if (searchQuery.value) {
          const languageCode = selectedLanguage.value || finalConfig.defaultLanguage;
          params.deep = {
            translations: {
              _filter: {
                languages_code: { _eq: languageCode }
              }
            }
          };
        }
      }

      // Apply search or filter
      if (searchQuery.value) {
        const parseResult = parseMultipleQueries(searchQuery.value);
        
        if (parseResult.queries.length > 0) {
          let currentGroup: any[] = [];
          const orGroups: any[] = [];
          let hasOr = false;
          
          parseResult.queries.forEach((q: any, index: number) => {
            const transformed = transformFieldForTranslation(q.field, q.operator, q.value);
            const filterToAdd = transformed.needsAnd ? { _and: [transformed.filter] } : transformed.filter;
            
            if (q.logicalOp === 'OR' || (index > 0 && parseResult.queries[index - 1].logicalOp === 'OR')) {
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
            const filters = parseResult.queries.map((q: any) => {
              const transformed = transformFieldForTranslation(q.field, q.operator, q.value);
              return transformed.filter;
            });
            
            params.filter = filters.length === 1 ? filters[0] : { _and: filters };
          }
        }
        
        if (parseResult.unparsedText) {
          params.search = parseResult.unparsedText;
        }
      }

      let fieldsToLoad = Array.isArray(params.fields) ? params.fields : params.fields ? params.fields.split(',') : undefined;
      
      if (translationInfo.value?.hasTranslations && translationInfo.value?.translationsCollection) {
        if (!fieldsToLoad) {
          fieldsToLoad = ['*'];
        }
        if (!fieldsToLoad.includes('translations.*')) {
          fieldsToLoad.push('translations.*');
        }
      }
      
      const searchOptions: SearchOptions = {
        search: params.search,
        filter: params.filter,
        limit: params.limit,
        offset: params.offset,
        sort: params.sort,
        fields: fieldsToLoad,
        deep: params.deep
      };
      
      const result = await apiClient.searchItems(selectedCollection.value, searchOptions);
      
      let items = result.data || [];
      
      // Client-side sorting for translatable fields
      if (sortField.value && isFieldTranslatable(sortField.value)) {
        items = [...items].sort((a, b) => {
          const aValue = getTranslatedFieldValue(a, sortField.value!) || '';
          const bValue = getTranslatedFieldValue(b, sortField.value!) || '';
          
          if (typeof aValue === 'number' && typeof bValue === 'number') {
            return sortDirection.value === 'asc' ? aValue - bValue : bValue - aValue;
          }
          
          const aStr = String(aValue).toLowerCase();
          const bStr = String(bValue).toLowerCase();
          
          if (sortDirection.value === 'asc') {
            return aStr.localeCompare(bStr);
          } else {
            return bStr.localeCompare(aStr);
          }
        });
      }
      
      availableItems.value = items;
      totalItems.value = result.meta?.filter_count || 0;
      
      apiError.value = null;

      // Load details for the items (non-blocking)
      if (availableItems.value.length > 0) {
        const itemIds = availableItems.value.map(item => item.id);
        loadItemDetails(itemIds);
      }
    } catch (error: any) {
      availableItems.value = [];
      totalItems.value = 0;
      
      apiError.value = handleApiError(error, 'search', {
        logContext: { 
          collection: selectedCollection.value,
          searchQuery: searchQuery.value,
          page: currentPage.value 
        }
      });
    } finally {
      loading.value = false;
    }
  }

  /**
   * Load detailed item information including usage data
   */
  async function loadItemDetails(itemIds: (string | number)[]) {
    if (!selectedCollection.value || itemIds.length === 0) return;

    if (detailsAbortController.value) {
      detailsAbortController.value.abort();
    }

    const requestId = ++currentRequestId.value;
    detailsAbortController.value = new globalThis.AbortController();
    loadingDetails.value = true;

    try {
      const items = await apiClient.loadItemsWithRelations(
        selectedCollection.value,
        itemIds,
        ['*.*']
      );

      if (requestId !== currentRequestId.value) {
          return;
      }

      const transformedRelations: Record<string, any[]> = {};

      items.forEach((item: any) => {
        if (item.usage_summary?.total_count > 0 && item.usage_locations) {
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
            
            group.items.push({
              id: location.id,
              title: location.title || location.path || `ID: ${location.id}`,
              path: location.path,
              edit_url: location.edit_url,
              status: location.status,
              ...location
            });
          });

          transformedRelations[item.id] = Array.from(byCollection.values());
        }
      });

      itemRelations.value = transformedRelations;
      
    } catch (error: any) {
      if (error.name !== 'AbortError') {
        logger.error('Error loading item details', error);
      }
    } finally {
      if (requestId === currentRequestId.value) {
        loadingDetails.value = false;
      }
    }
  }

  // Debounced load items
  const debouncedLoadItems = debounce(loadItems, 300);

  /**
   * Initialize settings from user preferences or defaults
   */
  function initializeSettings(collection: string, userPrefs: any) {
    if (userPrefs?.selectedLanguage) {
      selectedLanguage.value = userPrefs.selectedLanguage;
    } else if (!selectedLanguage.value) {
      selectedLanguage.value = finalConfig.defaultLanguage;
    }
    
    if (userPrefs?.itemsPerPage) {
      itemsPerPage.value = userPrefs.itemsPerPage;
    }
    
    if (userPrefs?.sortField) {
      sortField.value = userPrefs.sortField;
    }
    if (userPrefs?.sortDirection) {
      sortDirection.value = userPrefs.sortDirection;
    }
  }

  /**
   * Open the selector for a specific collection
   */
  async function open(collection: string, userPrefs?: any) {
    selectedCollection.value = collection;

    const storeCollectionInfo = collectionsStore.getCollection(collection);
    selectedCollectionName.value = storeCollectionInfo?.name || collection;
    
    // Use custom collection icon if provided, otherwise use default
    selectedCollectionIcon.value = finalConfig.collectionIcons[collection] || 
                                   storeCollectionInfo?.meta?.icon || 'box';
    
    initializeSettings(collection, userPrefs);
    await loadCollectionMetadata();

    searchQuery.value = '';
    currentPage.value = 1;
    availableItems.value = [];
    totalItems.value = 0;

    isOpen.value = true;
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
    
    if (detailsAbortController.value) {
      detailsAbortController.value.abort();
      detailsAbortController.value = null;
    }
    
    currentRequestId.value = 0;
    itemRelations.value = {};
  }

  /**
   * Get translated field value from item
   */
  function getTranslatedFieldValue(item: any, field: string, language?: string): string {
    const lang = language || selectedLanguage.value;
    
    if (!translationInfo.value?.hasTranslations) {
      return item[field] || '';
    }
    
    const isTranslatableField = isFieldTranslatable(field);
    
    if (isTranslatableField && item.translations) {
      if (Array.isArray(item.translations)) {
        const translation = item.translations.find((t: any) => {
          return t.languages_code === lang || t.languages_id === lang || t.language === lang;
        });
        if (translation && translation[field] !== undefined) {
          return translation[field];
        }
      } else if (item.translations[field] !== undefined) {
        return item.translations[field];
      }
    }
    
    return item[field] || '';
  }

  return {
    // Configuration
    config: finalConfig,
    
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