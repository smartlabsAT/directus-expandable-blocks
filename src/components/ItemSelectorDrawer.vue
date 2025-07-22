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
        <SearchTagInput
            ref="searchTagInputRef"
            class="search-input"
            v-model="searchQuery"
            :loading="loading"
            :show-help="showSearchHelp"
            :available-fields="availableFields"
            placeholder="Search items..."
            @update:model-value="$emit('search', $event)"
            @toggle-help="showSearchHelp = !showSearchHelp"
        />

        <!-- Collapsible Search Help -->
        <transition name="expand">
          <div v-if="showSearchHelp" class="search-help-panel">
            <div class="search-help-content">
              <!-- Available Fields Section -->
              <div class="search-help-section" v-if="availableFields.length > 0">
                <h4>Available Fields</h4>
                <div class="field-chips">
                  <v-chip
                      v-for="field in availableFields"
                      :key="field.field"
                      x-small
                      label
                      clickable
                      class="field-chip"
                      @click="addFieldToSearch(field.field)"
                  >
                    <v-icon name="text_fields" x-small />
                    {{ field.field }}
                    <span class="field-type">{{ field.type }}</span>
                  </v-chip>
                </div>
              </div>

              <!-- Search Operators Section -->
              <div class="search-help-section">
                <h4>Search Operators</h4>
                <div class="operators-grid">
                  <div 
                      v-for="(op, index) in searchOperators" 
                      :key="index"
                      class="operator-item"
                      @click="addOperatorToSearch(op.symbol)"
                  >
                    <v-button x-small secondary class="operator-button">
                      {{ op.symbol }}
                    </v-button>
                    <div class="operator-info">
                      <div class="operator-name">{{ op.name }}</div>
                      <div class="operator-example">{{ op.example }}</div>
                    </div>
                  </div>
                </div>
              </div>

              <!-- Logical Operators Section -->
              <div class="search-help-section">
                <h4>Logical Operators</h4>
                <div class="logical-operators-grid">
                  <button
                      type="button"
                      class="logical-operator-button and-button"
                      :class="{ active: searchTagInputRef?.defaultLogicalOp?.value === 'AND' }"
                      @click="addLogicalOperator('AND')"
                  >
                    AND
                  </button>
                  <button
                      type="button"
                      class="logical-operator-button or-button"
                      :class="{ active: searchTagInputRef?.defaultLogicalOp?.value === 'OR' }"
                      @click="addLogicalOperator('OR')"
                  >
                    OR
                  </button>
                </div>
                <div class="logical-examples">
                  <p>Combine multiple search criteria:</p>
                  <ul>
                    <li><code>title=Book AND status=published</code></li>
                    <li><code>category=tech OR category=news</code></li>
                    <li>Press <strong>Enter</strong> after a search to create a tag</li>
                    <li>Click AND/OR before adding tags to set default combination</li>
                    <li>Double-click tags to edit them</li>
                    <li v-if="!searchTagInputRef?.defaultLogicalOp?.value" class="info-note">
                      <v-icon name="info" x-small /> Default combination is AND
                    </li>
                  </ul>
                </div>
              </div>

              <div class="search-help-tips">
                <strong>Tips:</strong> Click a field to start searching • Click an operator to add it • Use AND/OR to combine criteria
              </div>
            </div>
          </div>
        </transition>
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
                  secondary
                  @click="toggle"
              >
                <v-icon name="settings"/>
              </v-button>
            </template>

            <v-list>
              <v-list-item disabled>
                <v-list-item-content>
                  <div class="field-selector-header">Select fields to display</div>
                </v-list-item-content>
              </v-list-item>
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
                  <v-list-item-title class="field-selector-title">
                    {{ capitalizeField(field.name || field.field) }}
                  </v-list-item-title>
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
    <span
        v-if="item.status"
        class="status-dot"
        :class="`status-${item.status}`"
        v-tooltip.top="capitalizeField(item.status)"
    />
              <span class="item-title">{{ extractItemTitle(item) }}</span>
              <v-chip v-if="item.id" x-small label class="item-id-badge">
                ID: {{ item.id }}
              </v-chip>

              <!-- Relations/Usage Indicator -->
              <div v-if="itemRelations && itemRelations[item.id]" class="usage-indicator">
                <v-menu placement="bottom" show-arrow>
                  <template #activator="{ toggle }">
                    <v-chip
                        x-small
                        class="usage-chip"
                        @click.stop="toggle"
                    >
                      <v-icon name="link" x-small/>
                      {{ getTotalUsageCount(item.id) }}
                    </v-chip>
                  </template>

                  <div class="usage-details">
                    <div class="usage-header">
                      <v-icon name="info"/>
                      <span>This item is used in:</span>
                    </div>
                    <v-divider/>
                    <div
                        v-for="usage in itemRelations[item.id]"
                        :key="`${usage.collection}-${usage.field}`"
                        class="usage-item"
                    >
                      <div class="usage-collection">
                        <v-icon name="box" x-small/>
                        <strong>{{ capitalizeField(usage.collection) }}</strong>
                        <span class="usage-count">({{ usage.count }})</span>
                      </div>
                      <div class="usage-list">
                        <div
                            v-for="usedIn in usage.items.slice(0, 5)"
                            :key="usedIn.id"
                            class="usage-entry"
                        >
                          • {{ extractItemTitle(usedIn) || `ID: ${usedIn.id}` }}
                        </div>
                        <div v-if="usage.count > 5" class="usage-more">
                          ... and {{ usage.count - 5 }} more
                        </div>
                      </div>
                    </div>
                  </div>
                </v-menu>
              </div>
            </div>

            <!-- Usage Warning -->
            <div v-if="itemRelations && itemRelations[item.id]" class="usage-warning">
              <v-icon name="warning" x-small/>
              <span>Used in {{ getTotalUsageCount(item.id) }} place{{ getTotalUsageCount(item.id) > 1 ? 's' : '' }} - changes will affect all references</span>
            </div>

            <!-- Additional Fields - darunter -->
            <div v-if="displayFields.length > 0" class="item-fields">
              <div
                  v-for="field in displayFields"
                  :key="field"
                  class="field-item"
              >
                <span class="field-label">{{ capitalizeField(getFieldLabel(field)) }}:</span>
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
import SearchTagInput from './SearchTagInput.vue';

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
  itemRelations?: Record<string, any[]>;
  loadingRelations?: boolean;
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
const showSearchHelp = ref(false);
const searchTagInputRef = ref<InstanceType<typeof SearchTagInput>>();

// Search operators configuration
const searchOperators = [
  { symbol: '=', name: 'Exact match', example: 'status=published' },
  { symbol: '~', name: 'Contains', example: 'title~product' },
  { symbol: '!~', name: 'Not contains', example: 'title!~draft' },
  { symbol: '!=', name: 'Not equals', example: 'status!=archived' },
  { symbol: '>', name: 'Greater than', example: 'sort>10' },
  { symbol: '<', name: 'Less than', example: 'price<100' },
  { symbol: '>=', name: 'Greater or equal', example: 'quantity>=5' },
  { symbol: '<=', name: 'Less or equal', example: 'stock<=20' },
  { symbol: '^', name: 'Starts with', example: 'name^John' },
  { symbol: '$', name: 'Ends with', example: 'email$@gmail.com' },
  { symbol: '=%', name: 'Contains (alt)', example: 'name=%john%' },
  { symbol: 'empty', name: 'Is empty', example: 'description=empty' },
  { symbol: '!empty', name: 'Not empty', example: 'image!empty' },
  { symbol: 'null', name: 'Is null', example: 'deleted_at=null' },
  { symbol: '!null', name: 'Not null', example: 'image!null' }
];

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

function addFieldToSearch(field: string) {
  searchTagInputRef.value?.addFieldToSearch(field);
}

function addOperatorToSearch(operator: string) {
  searchTagInputRef.value?.addOperatorToSearch(operator);
}

function addLogicalOperator(op: 'AND' | 'OR') {
  console.log('addLogicalOperator called with:', op);
  console.log('searchTagInputRef.value:', searchTagInputRef.value);
  if (searchTagInputRef.value) {
    searchTagInputRef.value.addLogicalOperator(op);
  } else {
    console.error('searchTagInputRef is not available');
  }
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

function capitalizeField(fieldName: string): string {
  return fieldName
      .replace(/_/g, ' ')
      .replace(/([A-Z])/g, ' $1')
      .trim()
      .split(' ')
      .map(word => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase())
      .join(' ');
}

function getTotalUsageCount(itemId: string | number): number {
  const relations = props.itemRelations?.[itemId];
  if (!relations) return 0;

  return relations.reduce((total, usage) => total + usage.count, 0);
}

// Reset when drawer opens/closes
watch(() => props.open, (isOpen) => {
  if (isOpen) {
    selectedItems.value = [];
    searchQuery.value = '';
    showSearchHelp.value = false;
  }
});

// Reset when collection changes
watch(() => props.collection, (collection) => {
  selectedItems.value = [];
  searchQuery.value = '';
  showSearchHelp.value = false;
  if (collection) {
    const saved = localStorage.getItem(`displayFields_${collection}`);
    if (saved) {
      displayFields.value = JSON.parse(saved);
    }
  }
}, {immediate: true});
</script>