import { logger } from '../utils/logger-wrapper';
import { extractItemTitle, getActualItemId as getItemActualId, getActualItem, getItemCollection } from '../utils/helpers';
import { isValidCollection } from '../utils/validation';
import type { JunctionRecord, ItemRecord, CollectionInfo } from '../types';
import type { ExpandableBlocksContext } from '../types/composable-context';

/**
 * Composable for UI helper functions in the expandable blocks extension
 * 
 * Responsibilities:
 * - Collection name and icon retrieval
 * - Field filtering and display
 * - Status field handling
 * - Nested M2A detection
 * - Field name formatting
 */
export function useUIHelpers(ctx: ExpandableBlocksContext) {
  // Destructure what we need from context
  const { stores: { fieldsStore, collectionsStore } } = ctx.deps;
  const { mergedOptions, availableStatuses } = ctx.ui;
  const { m2aStructure } = ctx.data;
  
  // Item ID helpers
  function getActualItemId(item: JunctionRecord): string | number {
    return getItemActualId(item);
  }

  function getItemTitle(item: JunctionRecord): string {
    return extractItemTitle(item);
  }

  // Collection helpers
  function getCollectionName(item: JunctionRecord): string {
    const collection = getItemCollection(item);
    if (!collection) return 'Unknown';
    const collectionInfo = collectionsStore.getCollection(collection);
    return collectionInfo?.name || collection;
  }

  function getCollectionIcon(item: JunctionRecord): string | null {
    const collection = getItemCollection(item);
    if (!collection) return null;
    const collectionInfo = collectionsStore.getCollection(collection);
    return collectionInfo?.meta?.icon || null;
  }

  // Field helpers
  function getFieldsForItem(item: JunctionRecord): any[] {
    const actualItem = item.item || item;
    const collection = (actualItem as any).collection || item.collection;
    
    if (!isValidCollection(collection)) {
      logger.warn('No collection found for item:', item);
      return [];
    }
    
    return fieldsStore.getFieldsForCollection(collection)
      .filter((field: any) => {
        if (field.meta?.hidden || field.meta?.readonly) return false;
        if (['id', 'user_created', 'date_created', 'user_updated', 'date_updated'].includes(field.field)) return false;
        if (!field.meta?.interface) return false;
        
        if (mergedOptions.value?.showFieldsFilter && mergedOptions.value?.showFieldsFilter.length > 0) {
          return mergedOptions.value?.showFieldsFilter.includes(field.field);
        }
        
        return true;
      });
  }

  // Status helpers
  function hasStatusField(item: JunctionRecord): boolean {
    const actualItem = item.item || item;
    const collection = item.collection || (actualItem as any).collection;
    
    if (!isValidCollection(collection)) return false;
    
    const fields = fieldsStore.getFieldsForCollection(collection);
    return fields.some((field: any) => field.field === 'status');
  }

  function getItemStatus(item: JunctionRecord): string {
    const actualItem = getActualItem(item);
    return (actualItem as ItemRecord).status || 'draft';
  }

  function getStatusLabel(status: string): string {
    const statusConfig = availableStatuses.find(s => s.value === status);
    return statusConfig?.label || status;
  }

  // Nested M2A helpers
  function hasNestedM2A(item: JunctionRecord): boolean {
    if (!item.item || typeof item.item !== 'object') return false;
    if (!m2aStructure.value?.nestedM2AFields) return false;
    
    const collection = item.collection;
    return !!m2aStructure.value?.nestedM2AFields?.[collection];
  }

  function getM2AFields(item: JunctionRecord): Record<string, any> {
    if (!item.item || typeof item.item !== 'object') return {};
    
    const m2aFields: Record<string, any> = {};
    
    for (const [key, value] of Object.entries(item.item)) {
      if (Array.isArray(value) && value.length > 0 && value[0]?.collection && value[0]?.item) {
        m2aFields[key] = value;
      }
    }
    
    return m2aFields;
  }

  // Formatting helpers
  function formatFieldName(name: string): string {
    return name
      .replace(/_/g, ' ')
      .replace(/\b\w/g, l => l.toUpperCase());
  }

  return {
    // Item helpers
    getActualItemId,
    getItemTitle,
    
    // Collection helpers
    getCollectionName,
    getCollectionIcon,
    getFieldsForItem,
    
    // Status helpers
    hasStatusField,
    getItemStatus,
    getStatusLabel,
    
    // Nested M2A helpers
    hasNestedM2A,
    getM2AFields,
    
    // Formatting
    formatFieldName
  };
}