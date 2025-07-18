<template>
  <teleport to="body">
    <div v-if="open" class="drawer-overlay" @click="handleClose">
      <div class="drawer-container" @click.stop>
        <!-- Drawer Header -->
        <div class="drawer-header">
          <div class="drawer-title">
            <v-icon :name="collectionIcon" />
            <span>Select {{ collectionName }}</span>
          </div>
          <v-icon 
            name="close" 
            clickable
            @click="handleClose"
          />
        </div>

        <!-- Drawer Content -->
        <div class="drawer-content">
          <!-- Search Bar -->
          <div class="search-container">
            <v-input
              v-model="searchQuery"
              type="search"
              placeholder="Search items..."
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

          <!-- Results Count -->
          <div v-else-if="searchQuery" class="results-info">
            <span>{{ items.length }} {{ items.length === 1 ? 'result' : 'results' }} found</span>
          </div>

          <!-- Items List -->
          <div v-if="!loading && items.length > 0" class="items-list">
            <label 
              v-for="item in items"
              :key="item.id || item"
              class="item-row"
            >
              <v-checkbox
                v-model="selectedItems"
                :value="item.id || item"
              />
              <div class="item-content">
                <div class="item-title">{{ extractItemTitle(item) }}</div>
                <div v-if="item.id" class="item-meta">ID: {{ item.id }}</div>
              </div>
            </label>
          </div>

          <!-- Empty State -->
          <div v-else-if="!loading" class="empty-state">
            <v-icon :name="searchQuery ? 'search_off' : 'inbox'" large />
            <p>{{ searchQuery ? 'No items found matching your search' : 'No items available' }}</p>
            <p v-if="searchQuery" class="empty-state-hint">Try adjusting your search terms</p>
          </div>
        </div>

        <!-- Drawer Footer -->
        <div class="drawer-footer">
          <div class="selection-info">
            {{ selectedItems.length }} item{{ selectedItems.length !== 1 ? 's' : '' }} selected
          </div>

          <v-button secondary @click="handleClose">
            <v-icon name="close"/>
            Cancel
          </v-button>
          <v-button
              :disabled="selectedItems.length === 0"
              kind="warning"
              @click="handleConfirmCopy"
              class="icon-button"
              v-tooltip.top="tooltipCopy"
          >
            <v-icon name="content_copy"/>
          </v-button>
          <v-button
              :disabled="selectedItems.length === 0"
              @click="handleConfirm"
              class="icon-button"
              v-tooltip.left="tooltipReference"
          >
            <v-icon name="link"/>
          </v-button>

        </div>
      </div>
    </div>
  </teleport>
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
}

const props = withDefaults(defineProps<Props>(), {
  loading: false
});

const emit = defineEmits<{
  close: [];
  confirm: [items: any[]];
  confirmCopy: [items: any[]];
  search: [query: string];
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

// Methods - using existing helper

function handleClose() {
  emit('close');
}

function clearSearch() {
  searchQuery.value = '';
  emit('search', '');
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

