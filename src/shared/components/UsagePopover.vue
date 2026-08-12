<template>
  <v-menu :placement="placement" show-arrow class="usage-popover">
    <template #activator="{ toggle }">
      <v-chip
        x-small
        class="usage-chip"
        @click.stop="toggle"
      >
        <v-icon name="link" x-small/>
        {{ totalCount }}
      </v-chip>
    </template>
    
    <div class="usage-popover-content">
      <v-list class="usage-popover-list">
      <v-list-item disabled>
        <v-list-item-icon>
          <v-icon name="info" />
        </v-list-item-icon>
        <v-list-item-content>
          <v-list-item-title>This item is used in:</v-list-item-title>
        </v-list-item-content>
      </v-list-item>
      
      <v-divider />
      
      <!-- For each collection -->
      <template v-for="usage in relations" :key="`${usage.collection}-${usage.field}`">
        <v-list-item class="collection-header">
          <v-list-item-icon>
            <v-icon :name="getCollectionIcon(usage.collection)" small />
          </v-list-item-icon>
          <v-list-item-content>
            <v-list-item-title>
              {{ capitalizeField(usage.collection) }}
              <v-chip x-small label>{{ usage.count }}</v-chip>
            </v-list-item-title>
          </v-list-item-content>
        </v-list-item>
        
        <!-- Items in this collection -->
        <v-list-item
          v-for="usedIn in usage.items.slice(0, 5)"
          :key="usedIn.id"
          class="usage-item"
          clickable
          @click="handleItemClick(usage.collection, usedIn)"
        >
          <v-list-item-content>
            <div class="usage-item-header">
              <v-list-item-title class="usage-item-title">
                {{ getItemTitle(usedIn) }}
              </v-list-item-title>
              <v-button
                v-if="usedIn.edit_url || usedIn.id"
                x-small
                icon
                secondary
                class="usage-item-link"
                @click.stop="openInNewTab(usage.collection, usedIn)"
                v-tooltip.top="'Open in new tab'"
              >
                <v-icon name="open_in_new" x-small />
              </v-button>
            </div>
            <!-- Plain path display: <v-breadcrumb> is deprecated in Directus 12 and
                 every segment here is non-clickable anyway. -->
            <div
              v-if="getPathArray(usedIn).length > 0"
              class="usage-item-path"
            >
              <span
                v-for="(segment, segmentIndex) in formatPathAsBreadcrumbs(getPathArray(usedIn))"
                :key="segmentIndex"
                class="usage-item-path-segment"
              >
                <v-icon v-if="segmentIndex > 0" name="chevron_right" x-small />
                <v-icon :name="segment.icon" x-small />
                {{ segment.name }}
              </span>
            </div>
            <v-list-item-subtitle v-else-if="usedIn.path && typeof usedIn.path === 'string'">
              {{ usedIn.path }}
            </v-list-item-subtitle>
          </v-list-item-content>
        </v-list-item>
        
        <v-list-item v-if="usage.count > 5" disabled class="more-items">
          <v-list-item-content>
            <v-list-item-title>
              ... and {{ usage.count - 5 }} more
            </v-list-item-title>
          </v-list-item-content>
        </v-list-item>
      </template>
    </v-list>
    </div>
  </v-menu>
</template>

<script setup lang="ts">
import { computed } from 'vue';
import { useStores } from '@directus/extensions-sdk';
import { extractItemTitle } from '../utils/helpers';

interface UsageItem {
  id: string | number;
  title?: string;
  path?: string | Array<{ collection: string; id: string | number; field?: string; }>;
  edit_url?: string;
  breadcrumbs?: Array<{
    label: string;
    collection?: string;
    id?: string | number;
    url?: string;
    icon?: string;
  }>;
  [key: string]: unknown;
}

interface UsageRelation {
  collection: string;
  field?: string;
  count: number;
  items: UsageItem[];
}

interface Props {
  itemRelations: UsageRelation[];
  itemId?: string | number;
  placement?: 'top' | 'right' | 'bottom' | 'left';
}

const props = withDefaults(defineProps<Props>(), {
  placement: 'bottom'
});

const emit = defineEmits<{
  'item-click': [payload: { collection: string; item: UsageItem }];
}>();

// Stores
const { useCollectionsStore } = useStores();
const collectionsStore = useCollectionsStore();

// Computed
const relations = computed(() => props.itemRelations || []);

const totalCount = computed(() => {
  return relations.value.reduce((total, usage) => total + usage.count, 0);
});

// Methods
function getItemTitle(item: UsageItem): string {
  return extractItemTitle(item) || `ID: ${item.id}`;
}

function getCollectionIcon(collection: string): string {
  const collectionInfo = collectionsStore.getCollection(collection);
  return collectionInfo?.meta?.icon || 'box';
}

function capitalizeField(fieldName: string): string {
  return fieldName
    .replace(/_/g, ' ')
    .replace(/([A-Z])/g, ' $1')
    .trim()
    .split(' ')
    .map(word => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase())
    .join(' ');
}

function handleItemClick(collection: string, item: UsageItem) {
  // Open in new tab when clicking the item
  openInNewTab(collection, item);
  // Also emit the event for any other handling
  emit('item-click', { collection, item });
}

function openInNewTab(collection: string, item: UsageItem) {
  const url = item.edit_url || `/admin/content/${collection}/${item.id}`;
  window.open(url, '_blank');
}

function getPathArray(item: UsageItem): Array<{ collection: string; id: string | number; field?: string; }> {
  // Check if path is an array (new format from API)
  if (Array.isArray(item.path)) {
    return item.path;
  }
  // Check if breadcrumbs property exists (future compatibility)
  if (item.breadcrumbs && Array.isArray(item.breadcrumbs)) {
    return item.breadcrumbs;
  }
  return [];
}

function formatPathAsBreadcrumbs(pathArray: Array<{ collection: string; id: string | number; field?: string; }>) {
  if (!pathArray || pathArray.length === 0) return [];
  
  // Skip the first item (current item) to avoid duplication with the title
  // Only show the parent hierarchy
  const parentPath = pathArray.slice(1);
  
  if (parentPath.length === 0) return [];
  
  // Convert path array to breadcrumb format
  return parentPath.map((pathItem, _index) => ({
    name: pathItem.title || pathItem.collection_display || pathItem.collection,
    icon: pathItem.icon || getCollectionIcon(pathItem.collection),
    disabled: true, // All breadcrumb items are disabled (not clickable in popover)
    to: null // No navigation from breadcrumbs in popover
  }));
}
</script>

<style scoped lang="scss">
.usage-chip {
  background-color: var(--warning-10);
  color: var(--warning);
  border-color: var(--warning-25);
  cursor: pointer;
  
  &:hover {
    background-color: var(--warning-25);
  }
  
  :deep(.v-icon) {
    margin-right: 4px;
    color: var(--warning);
  }
}

.usage-popover-content {
  max-height: 400px;
  overflow-y: auto;
  overflow-x: hidden;
}

.usage-popover-list {
  min-width: 300px;
  max-width: 400px;
  
  .collection-header {
    background-color: var(--theme--background-subdued);
    font-weight: 600;
    
    :deep(.v-list-item-content) {
      padding: 8px 0;
    }
    
    :deep(.v-chip) {
      margin-left: 8px;
      background-color: var(--theme--background-normal);
    }
  }
  
  .usage-item {
    padding-left: 40px;
    
    &:hover {
      background-color: var(--background-highlight);
    }
    
    .usage-item-header {
      display: flex;
      align-items: center;
      gap: 8px;
    }
    
    .usage-item-title {
      font-size: 13px;
      flex: 1;
    }
    
    .usage-item-link {
      opacity: 0;
      transition: opacity 0.2s;
      
      :deep(.v-icon) {
        --v-icon-size: 14px;
      }
    }
    
    &:hover .usage-item-link {
      opacity: 0.7;
      
      &:hover {
        opacity: 1;
      }
    }
    
    .usage-item-path {
      display: flex;
      flex-wrap: wrap;
      align-items: center;
      gap: 2px;
      margin-top: 4px;
      font-size: 11px;
      opacity: 0.7;

      .usage-item-path-segment {
        display: inline-flex;
        align-items: center;
        gap: 2px;
      }

      :deep(.v-icon) {
        --v-icon-size: 12px;
      }
    }
    
    :deep(.v-list-item-subtitle) {
      font-size: 12px;
      color: var(--theme--foreground-subdued);
      margin-top: 2px;
    }
  }
  
  .more-items {
    padding-left: 40px;
    font-style: italic;
    opacity: 0.6;
    
    :deep(.v-list-item-title) {
      font-size: 12px;
    }
  }
}
</style>