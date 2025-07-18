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
            </v-input>
          </div>

          <!-- Loading State -->
          <div v-if="loading" class="loading-state">
            <v-progress-circular indeterminate />
            <p>Loading items...</p>
          </div>

          <!-- Items List -->
          <div v-else-if="items.length > 0" class="items-list">
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
          <div v-else class="empty-state">
            <v-icon name="search_off" large />
            <p>No items found</p>
          </div>
        </div>

        <!-- Drawer Footer -->
        <div class="drawer-footer">
          <div class="selection-info">
            {{ selectedItems.length }} item{{ selectedItems.length !== 1 ? 's' : '' }} selected
          </div>
          <v-button secondary @click="handleClose">
            Cancel
          </v-button>
          <v-button 
            :disabled="selectedItems.length === 0"
            @click="handleConfirm"
          >
            Add Selected
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
  search: [query: string];
}>();

// Local state
const selectedItems = ref<(string | number)[]>([]);
const searchQuery = ref('');

// Computed
const collectionInfo = computed(() => {
  if (!props.collection || !props.collections) return null;
  // Ensure collections is an array
  const collectionsArray = Array.isArray(props.collections) ? props.collections : [];
  return collectionsArray.find(c => c.collection === props.collection);
});

const collectionIcon = computed(() => {
  return collectionInfo.value?.icon || 'box';
});

const collectionName = computed(() => {
  return collectionInfo.value?.name || props.collection || 'Items';
});

// Methods - using existing helper

function handleClose() {
  emit('close');
}

function handleConfirm() {
  // Get full item objects for selected IDs
  const selectedFullItems = selectedItems.value
    .map(itemId => props.items.find(item => item.id === itemId))
    .filter(item => item !== undefined);
  
  emit('confirm', selectedFullItems);
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

