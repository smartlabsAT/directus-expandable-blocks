import { ref, watch } from 'vue';
import { useStores } from '@directus/extensions-sdk';
import { debounce } from 'lodash-es';
import { logDebug, logError } from '../utils/logger-wrapper';
import { handleApiError } from '../utils/error-helpers';
import type { TranslationInfo, FieldWithTranslation, LanguageOption, ExpandableBlocksOptions } from '../types';
import { createApiClient } from '../services/api-client';
import type { IDirectusApiClient, SearchOptions } from '../services/api-client.types';

export function useItemSelector(api: any, _allowedCollections?: string[], _options?: ExpandableBlocksOptions) {
  const { useCollectionsStore } = useStores();
  const collectionsStore = useCollectionsStore();
  const itemRelations = ref<Record<string, any[]>>({});
  
  // Initialize API client
  const apiClient: IDirectusApiClient = createApiClient(api);

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

  // Watch for language changes and reload items
  watch(selectedLanguage, (newLang, oldLang) => {
    if (newLang !== oldLang && selectedCollection.value && availableItems.value.length > 0) {
      loadItems();
    }
  });

  // Pagination state
  const currentPage = ref(1);
  const itemsPerPage = ref(100);
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
      
      // Use the new API client to get metadata
      const metadata = await apiClient.getCollectionMetadata(selectedCollection.value);
      
      
      // Map native Directus fields to our format
      // TODO: Once we fully migrate, we can simplify this mapping
      const metadataCompat: any = {
        ...metadata,
        displayableFields: metadata.fields
          ?.filter(field => {
            // Filter out system fields but keep translatable fields
            if (field.field === 'id') return false;
            if (field.field === 'translations') return false; // Don't show the relation field itself
            if (['user_created', 'user_updated', 'date_created', 'date_updated', 'sort'].includes(field.field)) {
              return false;
            }
            // Hide fields marked as hidden
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
          availableLanguages: [] // Will be loaded separately if needed
        } : undefined
      };
      
      logDebug('Metadata after mapping', {
        collection: selectedCollection.value,
        displayableFieldsCount: metadataCompat.displayableFields?.length || 0,
        hasTranslationInfo: !!metadataCompat.translationInfo,
        displayableFieldNames: metadataCompat.displayableFields?.map((f: any) => f.field)
      });
      
      // Use displayableFields for UI (includes all fields like dropdowns, colors, etc.)
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
        // Fallback to searchableFields if displayableFields not available (backward compatibility)
        availableFields.value = metadataCompat.searchableFields.map((field: any) => ({
          field: field.field,
          type: field.type,
          name: field.field_name || field.name || field.field,
          interface: field.interface,
          display: field.display,
          options: field.options,
          display_name: field.field_name || field.name || field.field,
          searchable: true, // searchableFields are always searchable
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
          
          
          // Handle both object array and string array formats
          const fieldsToProcess = Array.isArray(metadataCompat.translationInfo.translationFields) 
            ? metadataCompat.translationInfo.translationFields
            : [];
            
          fieldsToProcess.forEach((fieldItem: any) => {
            // Extract field name - handle both object format and string format
            const fieldName = typeof fieldItem === 'string' ? fieldItem : fieldItem?.field;
            
            // Skip if field is undefined or null
            if (!fieldName) {
              return;
            }
            
            if (!availableFields.value.find(f => f.field === fieldName)) {
              
              availableFields.value.push({
                field: fieldName,
                type: 'string', // Default type for translation fields
                name: fieldName || 'unknown',
                display_name: fieldName || 'unknown',
                searchable: true,
                weight: 100, // Higher weight for translation fields
                translatable: true,
                translation_type: metadataCompat.translationInfo.translationType || 'json',
                interface: 'input', // Default interface
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
   * Returns both structured queries and unparsed text for fulltext search
   * Example: "id>99 hello" -> {queries: [{field: 'id'...}], unparsedText: 'hello'}
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

    // Track what parts were successfully parsed
    const parsedParts: string[] = [];
    
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
      // Support both double and single quotes
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
        
        // Track what was parsed
        parsedParts.push(fullMatch);
      }
      
      // Get unparsed text (everything that wasn't matched)
      let unparsedText = query;

      parsedParts.forEach(part => {
        // Use global replace to handle multiple occurrences
        unparsedText = unparsedText.split(part).join('');
      });
      unparsedText = unparsedText.trim();
      
      // If nothing was parsed, the whole query is unparsed text
      if (results.length === 0 && parsedParts.length === 0) {
        unparsedText = query;
      }
      
      return { queries: results, unparsedText };
    }
    
    // Parse with logical operators
    const filters = [];
    const unparsedParts: string[] = [];
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
      // Support quoted strings (double or single) and capture remaining text
      const regex = new RegExp(`^([\\w\\.]+)\\s*(${operatorPattern})\\s*(?:"([^"]+)"|'([^']+)'|([^\\s]+))(?:\\s+(.*))?$`);
      const match = part.match(regex);
      
      if (match) {
        const [, field, operator, quotedDouble, quotedSingle, unquotedValue, restText] = match;
        const value = (quotedDouble || quotedSingle || unquotedValue || '').trim();
        
        // If there's unparsed text after the value, add it to unparsedParts
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
        // This part couldn't be parsed as a structured query
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
    
    // Handle both object array (TranslationField[]) and string array formats
    if (Array.isArray(translationInfo.value.translationFields)) {
      if (translationInfo.value.translationFields.length === 0) return false;
      
      // Check if it's an array of objects with field property
      if (typeof translationInfo.value.translationFields[0] === 'object' && 'field' in translationInfo.value.translationFields[0]) {
        return (translationInfo.value.translationFields as any[]).some(tf => tf.field === field);
      } else {
        // It's an array of strings
        return (translationInfo.value.translationFields as string[]).includes(field);
      }
    }
    
    return false;
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
   * Load available languages from Directus
   */
  async function loadAvailableLanguages() {
    try {
      logDebug('Attempting to load languages from collection: languages');
      
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
        
        // Set default language if not set
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
          selectedLanguage.value = 'en-US';
        }
      }
    } catch (error) {
      logError('Failed to load languages, using defaults', error);
      // Fallback to common languages
      availableLanguages.value = [
        { code: 'en-US', name: 'English' },
        { code: 'de-DE', name: 'Deutsch' },
        { code: 'fr-FR', name: 'Français' }
      ];
      
      if (!selectedLanguage.value) {
        selectedLanguage.value = 'en-US';
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

      // Build params
      const params: any = {
        limit: itemsPerPage.value,
        offset: offset,
        fields: ['*'],
        meta: '*'
      };
      
      // If collection has translations, include them in the query
      if (translationInfo.value?.hasTranslations && translationInfo.value?.translationsCollection) {
        // Include translation fields in the query - load ALL translations
        params.fields = ['*', `translations.*`];
        // Don't filter by language - we need all translations for language switching
        // The getTranslatedFieldValue function will pick the right one
        
        logDebug('Including translations in query', {
          collection: selectedCollection.value,
          translationsCollection: translationInfo.value.translationsCollection,
          selectedLanguage: selectedLanguage.value,
          fields: params.fields
        });
      }
      
      // Add sorting if specified
      if (sortField.value) {
        // Check if field is translatable
        const isTranslatableField = isFieldTranslatable(sortField.value);
        
        if (isTranslatableField) {
          // Don't add server-side sorting for translatable fields
          // We'll handle it client-side after loading to avoid permission issues
          // Skipping server-side sort for translatable field - will sort client-side
        } else {
          // Regular field - use direct path for server-side sorting
          params.sort = `${sortDirection.value === 'desc' ? '-' : ''}${sortField.value}`;
        }
      }
      
      // Include translations if collection has them
      if (translationInfo.value?.hasTranslations) {
        params.fields.push('translations.*');
        
        // Only add deep filter when searching, not when sorting
        // This prevents 403 Forbidden errors when sorting by translated fields
        if (searchQuery.value) {
          const languageCode = selectedLanguage.value || 'en-US';
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
        // Parse query to get both structured queries and unparsed text
        const parseResult = parseMultipleQueries(searchQuery.value);
        
        
        // Handle structured queries if present
        if (parseResult.queries.length > 0) {
          // Build complex filter from multiple queries
          let currentGroup: any[] = [];
          const orGroups: any[] = [];
          let hasOr = false;
          
          parseResult.queries.forEach((q: any, index: number) => {
            const transformed = transformFieldForTranslation(
              q.field,
              q.operator,
              q.value
            );
            
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
            // Build filters with translation support
            const filters = parseResult.queries.map((q: any) => {
              const transformed = transformFieldForTranslation(q.field, q.operator, q.value);
              return transformed.filter;
            });
            
            params.filter = filters.length === 1 ? filters[0] : { _and: filters };
          }
        }
        
        // Add fulltext search for unparsed text if present
        if (parseResult.unparsedText) {
          params.search = parseResult.unparsedText;
        }
      }

      // Keep filter and deep as objects for the API client
      // The new API client handles the conversion internally
      
      
      // Add translation fields if translations are enabled
      let fieldsToLoad = Array.isArray(params.fields) ? params.fields : params.fields ? params.fields.split(',') : undefined;
      
      // If we have translations, ensure we load the translation data
      if (translationInfo.value?.hasTranslations && translationInfo.value?.translationsCollection) {
        if (!fieldsToLoad) {
          fieldsToLoad = ['*']; // Load all base fields
        }
        // Add translations relation to fields
        if (!fieldsToLoad.includes('translations.*')) {
          fieldsToLoad.push('translations.*');
        }
      }
      
      // Use the new API client for search
      const searchOptions: SearchOptions = {
        search: params.search,
        filter: params.filter, // Keep as object
        limit: params.limit,
        offset: params.offset,
        sort: params.sort,
        fields: fieldsToLoad,
        deep: params.deep // Keep as object if present
      };
      
      const result = await apiClient.searchItems(selectedCollection.value, searchOptions);
      
      let items = result.data || [];
      
      // Client-side sorting for translatable fields
      if (sortField.value && isFieldTranslatable(sortField.value)) {
        
        items = [...items].sort((a, b) => {
          const aValue = getTranslatedFieldValue(a, sortField.value!) || '';
          const bValue = getTranslatedFieldValue(b, sortField.value!) || '';
          
          // Handle different types
          if (typeof aValue === 'number' && typeof bValue === 'number') {
            return sortDirection.value === 'asc' ? aValue - bValue : bValue - aValue;
          }
          
          // String comparison
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
      
      // Clear any previous API errors
      apiError.value = null;


      // Load details for the items (non-blocking)
      if (availableItems.value.length > 0) {
        const itemIds = availableItems.value.map(item => item.id);
        // Fire and forget - don't await
        loadItemDetails(itemIds);
      }
    } catch (error: any) {
      availableItems.value = [];
      totalItems.value = 0;
      
      // Use centralized error handling
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
      // Use the new API client to load item details with relations
      const items = await apiClient.loadItemsWithRelations(
        selectedCollection.value,
        itemIds,
        ['*.*'] // Load with one level of relations
      );

      // Only process if this is still the current request
      if (requestId !== currentRequestId.value) {
          return;
      }

      // Transform API data to match UI expectations
      const transformedRelations: Record<string, any[]> = {};

      // Since we're now using native API, we need to adapt the response
      // Process usage data if available (from external API)
      items.forEach((item: any) => {
        // Check if we have usage data from the external API
        if (item.usage_summary?.total_count > 0 && item.usage_locations) {
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
              title: location.title || location.path || `ID: ${location.id}`,
              path: location.path,
              edit_url: location.edit_url,
              status: location.status,
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
    
    // Check if this field is in the translatable fields list
    const isTranslatableField = isFieldTranslatable(field);
    
    if (isTranslatableField && item.translations) {
      // Field is translatable and we have translation data
      if (Array.isArray(item.translations)) {
        // Find the translation for the selected language
        const translation = item.translations.find((t: any) => {
          return t.languages_code === lang || t.languages_id === lang || t.language === lang;
        });
        if (translation && translation[field] !== undefined) {
          return translation[field];
        }
      } else if (item.translations[field] !== undefined) {
        // Direct translation object
        return item.translations[field];
      }
    }
    
    // Fallback to main field value
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