<template>
  <v-drawer
    :model-value="open"
    class="item-selector-drawer"
    :title="`Select ${collectionName}`"
    @update:model-value="$emit('close')"
    @cancel="handleClose"
  >
    <!-- Custom Header -->
    <template #title>
      <div class="drawer-collection-header">
        <div class="header-icon-box">
          <v-icon :name="collectionIcon" />
        </div>
        <div class="header-content">
          <div class="header-name">Select {{ collectionName }}</div>
          <div v-if="!loading" class="header-count">
            <span v-if="!searchQuery && totalItems !== null">{{ totalItems }} {{ totalItems === 1 ? 'item' : 'items' }}</span>
            <span v-if="selectedItems.length > 0" class="selection-info-inline">
              ({{ selectedItems.length }} selected |
              <a class="deselect-link" @click="deselectAll">Deselect all</a>)
            </span>
          </div>
        </div>
      </div>
    </template>

    <!-- Search moved to main content -->

    <!-- Main Content -->
    <div class="drawer-collection-body">
      <!-- Search Bar -->
      <div class="search-container">
        <v-input
          v-model="searchQuery"
          type="search"
          placeholder="Search items..."
          class="search-input"
          @input="$emit('search', searchQuery)"
        >
          <template #prepend>
            <v-icon name="search" />
          </template>
          <template #append v-if="searchQuery">
            <v-icon 
              name="close" 
              clickable
              @click="clearSearch"
            />
          </template>
        </v-input>
      </div>
      
      <!-- Loading State -->
      <div v-if="loading" class="loading-state">
        <v-progress-circular indeterminate />
        <p>Loading items...</p>
      </div>
      
      <!-- Search Info Bar with Pagination -->
      <div v-else-if="searchQuery || totalItems > itemsPerPage" class="search-info-bar">
        <div class="results-info">
          <span v-if="searchQuery">Showing results for "{{ searchQuery }}"</span>
        </div>
        
        <!-- Pagination -->
        <v-pagination
          v-if="!searchQuery && totalItems > itemsPerPage && totalPages > 1"
          v-model="currentPageLocal"
          :length="totalPages"
          :total-visible="3"
          :show-first-last="true"
          @update:model-value="emit('update:current-page', $event)"
        />
        
        <!-- Simple prev/next for search results -->
        <div v-else-if="searchQuery && (currentPage > 1 || items.length === itemsPerPage)" class="search-pagination">
          <v-button 
            :disabled="currentPage === 1" 
            icon 
            x-small
            @click="emit('update:current-page', currentPage - 1)"
          >
            <v-icon name="chevron_left" />
          </v-button>
          <span class="page-info">Page {{ currentPage }}</span>
          <v-button 
            :disabled="items.length < itemsPerPage" 
            icon 
            x-small
            @click="emit('update:current-page', currentPage + 1)"
          >
            <v-icon name="chevron_right" />
          </v-button>
        </div>
      </div>

      <!-- Items List -->
      <v-list v-if="!loading && items.length > 0" class="items-list">
        <v-list-item
          v-for="item in items"
          :key="item.id || item"
          clickable
          :active="isSelected(item)"
          @click="toggleSelection(item)"
        >
          <v-list-item-icon>
            <v-checkbox
              :model-value="isSelected(item)"
              @click.stop
              @update:model-value="toggleSelection(item)"
            />
          </v-list-item-icon>
          
          <v-list-item-content>
            <v-list-item-title>{{ extractItemTitle(item) }}</v-list-item-title>
            <v-list-item-subtitle v-if="item.id">ID: {{ item.id }}</v-list-item-subtitle>
          </v-list-item-content>
        </v-list-item>
      </v-list>

      <!-- Empty State -->
      <v-notice v-else-if="!loading" :icon="searchQuery ? 'search_off' : 'inbox'">
        <div>{{ searchQuery ? 'No items found matching your search' : 'No items available' }}</div>
        <div v-if="searchQuery" class="empty-state-hint">Try adjusting your search terms</div>
      </v-notice>
    </div>

    <!-- Footer Actions -->
    <template #actions>
      <v-button
        :disabled="selectedItems.length === 0"
        kind="warning"
        icon
        @click="handleConfirmCopy"
        v-tooltip.top="tooltipCopy"
      >
        <v-icon name="content_copy"/>
      </v-button>
      
      <v-button
        :disabled="selectedItems.length === 0"
        icon
        @click="handleConfirm"
        v-tooltip.left="tooltipReference"
      >
        <v-icon name="link"/>
      </v-button>
    </template>
  </v-drawer>
</template>

<script setup lang="ts">
import { ref, computed, watch } from 'vue';
import { extractItemTitle } from '../utils/helpers';
import type { CollectionInfo } from '../types';

interface Props {
  open: boolean;
  collection: string | null;
  collectionName?: string;  // Props werden vom composable übergeben
  collectionIcon?: string;  // Props werden vom composable übergeben
  collections: CollectionInfo[];
  items: any[];
  loading?: boolean;
  currentPage?: number;
  itemsPerPage?: number;
  totalItems?: number;
}

const props = withDefaults(defineProps<Props>(), {
  loading: false
});

const emit = defineEmits<{
  close: [];
  confirm: [items: any[]];
  confirmCopy: [items: any[]];
  search: [query: string];
  'update:current-page': [page: number];
}>();

// Local state
const selectedItems = ref<(string | number)[]>([]);
const searchQuery = ref('');

// Tooltip texts
const tooltipCopy = 'Creates an independent copy of the selected item. Changes to the copy will not affect the original.';
const tooltipReference = 'Adds a reference to the selected item. Changes to the item will affect all places where it is used.';

// Computed
const collectionIcon = computed(() => {
  return props.collectionIcon || 'box';
});

const collectionName = computed(() => {
  return props.collectionName || props.collection || 'Items';
});

const totalPages = computed(() => {
  if (!props.totalItems || !props.itemsPerPage) return 1;
  return Math.ceil(props.totalItems / props.itemsPerPage);
});

const currentPageLocal = computed({
  get: () => props.currentPage || 1,
  set: (value) => emit('update:current-page', value)
});

// Methods - using existing helper

function handleClose() {
  emit('close');
}

function clearSearch() {
  searchQuery.value = '';
  emit('search', '');
}

function deselectAll() {
  selectedItems.value = [];
}

function isSelected(item: any) {
  const itemId = item.id || item;
  return selectedItems.value.includes(itemId);
}

function toggleSelection(item: any) {
  const itemId = item.id || item;
  const index = selectedItems.value.indexOf(itemId);
  
  if (index > -1) {
    selectedItems.value.splice(index, 1);
  } else {
    selectedItems.value.push(itemId);
  }
}

function handleConfirm() {
  // Get full item objects for selected IDs
  const selectedFullItems = selectedItems.value
    .map(itemId => props.items.find(item => item.id === itemId))
    .filter(item => item !== undefined);
  
  emit('confirm', selectedFullItems);
}

function handleConfirmCopy() {
  // Get full item objects for selected IDs
  const selectedFullItems = selectedItems.value
    .map(itemId => props.items.find(item => item.id === itemId))
    .filter(item => item !== undefined);
  
  emit('confirmCopy', selectedFullItems);
}

// Reset when drawer opens/closes
watch(() => props.open, (isOpen) => {
  if (isOpen) {
    selectedItems.value = [];
    searchQuery.value = '';
  }
});

// Reset when collection changes
watch(() => props.collection, () => {
  selectedItems.value = [];
  searchQuery.value = '';
});
</script>

