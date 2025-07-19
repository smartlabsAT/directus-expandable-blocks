<template>
  <v-drawer
      :model-value="open"
      class="item-selector-drawer"
      @update:model-value="$emit('close')"
      @cancel="handleClose"
      :icon="collectionIcon"
      :title="'Select Item(s)'"
      :small-header="false"
      :header-shadow="false"
  >
    <template #subtitle>
      <v-breadcrumb :items="[{ name: collectionName, disabled: true }]"/>
    </template>

    <template #title-outer:prepend>
      <v-button class="header-icon" rounded icon secondary disabled>
        <v-icon :name="collectionIcon"/>
      </v-button>
    </template>

    <!-- Main Content -->
    <div class="drawer-collection-body">
      <!-- Search Bar -->
      <div class="search-container">
        <v-input
            v-model="searchQuery"
            type="search"
            placeholder="Search items..."
            class="search-input"
            @update:model-value="$emit('search', $event)"
        >
          <template #prepend>
            <v-progress-circular v-if="loading" indeterminate small/>
            <v-icon v-else name="search"/>
          </template>
          <template #append>
            <v-icon
                v-if="searchQuery"
                name="close"
                clickable
                @click="clearSearch"
            />
          </template>
        </v-input>
      </div>

      <!-- Search Info Bar with Pagination -->
      <div class="search-info-bar">
        <div class="results-info">
          <span v-if="searchQuery">
            Showing {{ totalItems }} results for "{{ searchQuery }}"
          </span>
          <span v-else-if="totalItems !== null">
            {{ totalItems }} {{ totalItems === 1 ? 'item' : 'items' }}
          </span>
          <span v-if="selectedItems.length > 0" class="selection-info-inline">
            - {{ selectedItems.length }} selected
            (<a class="deselect-link" @click="deselectAll">Deselect all</a>)
          </span>
        </div>

        <div class="pagination-controls">
          <v-pagination
              v-if="totalItems > itemsPerPage && totalPages > 1"
              v-model="currentPageLocal"
              :length="totalPages"
              :total-visible="3"
              :show-first-last="true"
              @update:model-value="emit('update:current-page', $event)"
          />

          <!-- Settings Button -->
          <v-menu placement="bottom-end" show-arrow>
            <template #activator="{ toggle }">
              <v-button
                  v-tooltip.bottom="'Display Settings'"
                  icon
                  x-small
                  secondary
                  @click="toggle"
              >
                <v-icon name="settings"/>
              </v-button>
            </template>

            <v-list>
              <v-list-item-content>
                <div class="field-selector-header">Select fields to display:</div>
              </v-list-item-content>
              <v-divider/>
              <v-list-item
                  v-for="field in availableFields"
                  :key="field.field"
                  clickable
                  @click="toggleFieldDisplay(field.field)"
              >
                <v-list-item-icon>
                  <v-checkbox
                      :model-value="displayFields.includes(field.field)"
                      @update:model-value="toggleFieldDisplay(field.field)"
                      @click.stop
                  />
                </v-list-item-icon>
                <v-list-item-content>
                  <v-list-item-title>{{ field.name || field.field }}</v-list-item-title>
                  <v-list-item-subtitle>{{ field.type }}</v-list-item-subtitle>
                </v-list-item-content>
              </v-list-item>
            </v-list>
          </v-menu>
        </div>
      </div>

      <!-- Items List -->
      <v-list v-if="items.length > 0" class="items-list">
        <v-list-item
            v-for="item in items"
            :key="item.id || item"
            clickable
            :active="isSelected(item)"
            @click="toggleSelection(item)"
            class="custom-list-item"
        >
          <v-list-item-icon>
            <v-checkbox
                :model-value="isSelected(item)"
                @click.stop
                @update:model-value="toggleSelection(item)"
            />
          </v-list-item-icon>

          <v-list-item-content>
            <!-- Titel-Zeile mit fester Position -->
            <div class="item-title-row">
              <span class="item-title">{{ extractItemTitle(item) }}</span>
              <v-chip v-if="item.id" x-small label class="item-id-badge">
                ID: {{ item.id }}
              </v-chip>
            </div>

            <!-- Additional Fields - darunter -->
            <div v-if="displayFields.length > 0" class="item-fields">
              <div
                  v-for="field in displayFields"
                  :key="field"
                  class="field-item"
              >
                <span class="field-label">{{ getFieldLabel(field) }}:</span>

                <!-- Boolean as Badge -->
                <v-chip
                    v-if="typeof item[field] === 'boolean'"
                    x-small
                    :class="item[field] ? 'boolean-true' : 'boolean-false'"
                >
                  {{ item[field] ? 'Yes' : 'No' }}
                </v-chip>

                <!-- Text with Truncation -->
                <span
                    v-else
                    class="field-value"
                    v-tooltip="getFieldValue(item[field]).length > 100 ? getFieldValue(item[field]) : null"
                >
            {{ truncateText(getFieldValue(item[field]), 100) }}
          </span>
              </div>
            </div>
          </v-list-item-content>
        </v-list-item>
      </v-list>

      <!-- Empty State -->
      <v-notice v-else :icon="searchQuery ? 'search_off' : 'inbox'">
        <div>{{ searchQuery ? 'No items found matching your search' : 'No items available' }}</div>
        <div v-if="searchQuery" class="empty-state-hint"><br/>Try adjusting your search terms</div>
      </v-notice>
    </div>

    <!-- Footer Actions -->
    <template #actions>
      <v-button
          :disabled="selectedItems.length === 0"
          kind="warning"
          icon
          @click="handleConfirmCopy"
          v-tooltip.top="'Creates an independent copy of the selected item. Changes to the copy will not affect the original.'"
      >
        <v-icon name="content_copy"/>
      </v-button>

      <v-button
          :disabled="selectedItems.length === 0"
          icon
          @click="handleConfirm"
          v-tooltip.left="'Adds a reference to the selected item. Changes to the item will affect all places where it is used.'"
      >
        <v-icon name="link"/>
      </v-button>
    </template>
  </v-drawer>
</template>
<script setup lang="ts">
import {ref, computed, watch} from 'vue';
import {extractItemTitle} from '../utils/helpers';

interface Props {
  open: boolean;
  collection: string | null;
  collectionName?: string;
  collectionIcon?: string;
  items: any[];
  loading?: boolean;
  currentPage?: number;
  itemsPerPage?: number;
  totalItems?: number;
  availableFields?: Array<{
    field: string;
    name?: string;
    type: string;
  }>;
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
const displayFields = ref<string[]>([]);

// Computed
const collectionIcon = computed(() => props.collectionIcon || 'box');
const collectionName = computed(() => props.collectionName || props.collection || 'Items');
const totalPages = computed(() => {
  if (!props.totalItems || !props.itemsPerPage) return 1;
  return Math.ceil(props.totalItems / props.itemsPerPage);
});

const currentPageLocal = computed({
  get: () => props.currentPage || 1,
  set: (value) => emit('update:current-page', value)
});

// Methods
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
  const selectedFullItems = selectedItems.value
      .map(itemId => props.items.find(item => item.id === itemId))
      .filter(item => item !== undefined);

  emit('confirm', selectedFullItems);
}

function handleConfirmCopy() {
  const selectedFullItems = selectedItems.value
      .map(itemId => props.items.find(item => item.id === itemId))
      .filter(item => item !== undefined);

  emit('confirmCopy', selectedFullItems);
}

function toggleFieldDisplay(field: string) {
  const index = displayFields.value.indexOf(field);
  if (index > -1) {
    displayFields.value.splice(index, 1);
  } else {
    displayFields.value.push(field);
  }
  // Optional: Save to localStorage
  localStorage.setItem(`displayFields_${props.collection}`, JSON.stringify(displayFields.value));
}

function getFieldLabel(field: string): string {
  const fieldInfo = props.availableFields?.find(f => f.field === field);
  return fieldInfo?.name || field;
}


function getFieldValue(value: any): string {
  if (value === null || value === undefined) return '';
  if (typeof value === 'object') return JSON.stringify(value);
  return String(value);
}

function truncateText(text: string, maxLength: number): string {
  if (text.length <= maxLength) return text;
  return text.substring(0, maxLength) + '...';
}


// Reset when drawer opens/closes
watch(() => props.open, (isOpen) => {
  if (isOpen) {
    selectedItems.value = [];
    searchQuery.value = '';
  }
});

// Reset when collection changes
watch(() => props.collection, (collection) => {
  selectedItems.value = [];
  searchQuery.value = '';
  if (collection) {
    const saved = localStorage.getItem(`displayFields_${collection}`);
    if (saved) {
      displayFields.value = JSON.parse(saved);
    }
  }
}, {immediate: true});
</script>