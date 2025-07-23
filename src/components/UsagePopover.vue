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
          @click="$emit('item-click', { collection: usage.collection, item: usedIn })"
        >
          <v-list-item-content>
            <v-list-item-title class="usage-item-title">
              {{ getItemTitle(usedIn) }}
            </v-list-item-title>
            <v-list-item-subtitle v-if="usedIn.path">
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
  path?: string;
  [key: string]: any;
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

defineEmits<{
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
    background-color: var(--background-subdued);
    font-weight: 600;
    
    :deep(.v-list-item-content) {
      padding: 8px 0;
    }
    
    :deep(.v-chip) {
      margin-left: 8px;
      background-color: var(--background-normal);
    }
  }
  
  .usage-item {
    padding-left: 40px;
    
    &:hover {
      background-color: var(--background-highlight);
    }
    
    .usage-item-title {
      font-size: 13px;
    }
    
    :deep(.v-list-item-subtitle) {
      font-size: 12px;
      color: var(--foreground-subdued);
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