import { ref, type Ref } from 'vue';
import { useStores } from '@directus/extensions-sdk';
import { debounce } from 'lodash-es';
import { logDebug, logError } from '../utils/logger-wrapper';
import type { TranslationInfo, FieldWithTranslation, CollectionMetadata, LanguageOption } from '../types';

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
  const availableFields = ref<FieldWithTranslation[]>([]);
  const loadingRelations = ref(false);
  const apiError = ref<string | null>(null);
  
  // Translation state
  const translationInfo = ref<TranslationInfo | null>(null);
  const selectedLanguage = ref<string>('en-US');
  const availableLanguages = ref<LanguageOption[]>([]);


  // Pagination state
  const currentPage = ref(1);
  const itemsPerPage = ref(10);
  const totalItems = ref(0);


  /**
   * Load collection metadata including searchable fields
   */
  async function loadCollectionMetadata() {
    if (!selectedCollection.value) return;
    
    try {
      apiError.value = null;
      const response = await api.get(`/expandable-blocks-api/${selectedCollection.value}/metadata`);
      
      const metadata = response.data as CollectionMetadata;
      
      if (metadata?.searchableFields) {
        // Transform searchableFields to match the expected format
        availableFields.value = metadata.searchableFields.map((field: any) => ({
          field: field.field,
          type: field.type,
          name: field.name || field.field,
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
        
        logDebug('Translation info loaded', {
          hasTranslations: metadata.translationInfo.hasTranslations,
          translationType: metadata.translationInfo.translationType,
          translationFields: metadata.translationInfo.translationFields
        });
        
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
          
          logDebug('Added translation fields to availableFields', {
            addedFields: metadata.translationInfo.translationFields.map((tf: any) => tf.field)
          });
        }
      }
      
      logDebug('Loaded collection metadata', {
        collection: selectedCollection.value,
        fieldsCount: availableFields.value.length,
        hasTranslations: translationInfo.value?.hasTranslations || false
      });
    } catch (error) {
      logError('Error loading collection metadata', error);
      apiError.value = 'Fehler beim Laden der Metadaten. Bitte versuchen Sie es später erneut.';
      // Fallback to empty fields
      availableFields.value = [];
    }
  }

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
      
      // Include translations if collection has them
      if (translationInfo.value?.hasTranslations) {
        params.fields.push('translations.*');
      }

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

      const response = await api.get(`/expandable-blocks-api/${selectedCollection.value}/search`, { params });

      availableItems.value = response.data.data || [];
      totalItems.value = response.data.meta?.filter_count || 0;
      await loadItemRelations();
      
      // Clear any previous API errors
      apiError.value = null;

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
      apiError.value = 'Die API ist nicht erreichbar. Bitte versuchen Sie es später erneut.';
    } finally {
      loading.value = false;
    }
  }


  /**
   * Load relation information for all loaded items
   * Currently not implemented - placeholder for future usage tracking
   */
  async function loadItemRelations() {
    if (!selectedCollection.value || availableItems.value.length === 0) return;

    loadingRelations.value = true;
    itemRelations.value = {};

    try {
      // TODO: Implement relation loading when needed
      // This would load usage information for each item
      
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
      const translation = item.translations.find((t: any) => t.languages_code === lang);
      
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
  
  /**
   * Check if a field is translatable
   */
  function isFieldTranslatable(field: string): boolean {
    logDebug('isFieldTranslatable called', {
      field,
      hasTranslations: translationInfo.value?.hasTranslations,
      translationFields: translationInfo.value?.translationFields
    });
    
    if (!translationInfo.value?.hasTranslations) return false;
    
    // Check if field is in translationFields (only direct matches, not coversFields)
    const isTranslatable = translationInfo.value.translationFields?.some(
      tf => tf.field === field
    );
    
    logDebug('isFieldTranslatable result', {
      field,
      isTranslatable
    });
    
    if (isTranslatable) return true;
    
    // Also check availableFields as fallback
    const fieldInfo = availableFields.value.find(f => f.field === field);
    return fieldInfo?.translatable || false;
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
    apiError,
    
    // Translation state
    translationInfo,
    selectedLanguage,
    availableLanguages,

    // Pagination
    currentPage,
    itemsPerPage,
    totalItems,

    // Methods
    open,
    close,
    loadItems,
    handleSearch,
    handlePageChange,
    getTranslatedFieldValue,
    isFieldTranslatable
  };
}