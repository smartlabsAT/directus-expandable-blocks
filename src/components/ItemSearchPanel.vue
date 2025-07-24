<template>
  <div class="search-container">
    <SearchTagInput
        ref="searchTagInputRef"
        class="search-input"
        :model-value="searchQuery"
        :loading="loading"
        :show-help="showHelp"
        :available-fields="availableFields"
        :total-items="totalItems"
        placeholder="Search items..."
        @update:model-value="handleSearchUpdate"
        @toggle-help="$emit('update:show-help', !showHelp)"
    />

    <!-- Collapsible Search Help -->
    <transition name="expand">
      <div v-if="showHelp" class="search-help-panel">
        <div class="search-help-content">
          <!-- Available Fields Section -->
          <div class="search-help-section" v-if="nonTranslatableFields.length > 0 || translationInfo?.translationFields?.length > 0">
            <h4>Available Fields</h4>
            <div class="field-chips">
              <!-- Non-translatable fields -->
              <v-chip
                  v-for="field in nonTranslatableFields"
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
              
              <!-- Translatable fields (shown with translation icon) -->
              <v-chip
                  v-for="field in translationInfo?.translationFields || []"
                  :key="`translations.${field.field}`"
                  x-small
                  label
                  clickable
                  class="field-chip translation-field-chip"
                  @click="addFieldToSearch(`translations.${field.field}`)"
              >
                <v-icon name="translate" x-small />
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
</template>

<script setup lang="ts">
import { ref, computed, type ComponentPublicInstance } from 'vue';
import SearchTagInput from './SearchTagInput.vue';

interface FieldInfo {
  field: string;
  name?: string;
  type: string;
  interface?: string;
  display?: string;
  options?: any;
}

interface Props {
  searchQuery: string;
  loading?: boolean;
  showHelp?: boolean;
  availableFields?: FieldInfo[];
  translationInfo?: any;
  totalItems?: number | null;
}

const props = withDefaults(defineProps<Props>(), {
  loading: false,
  showHelp: false,
  availableFields: () => []
});

const emit = defineEmits<{
  'update:search-query': [value: string];
  'update:show-help': [value: boolean];
  'search': [query: string];
}>();

// Computed: Filter out fields that are translatable (they should only appear in translation section)
const nonTranslatableFields = computed(() => {
  if (!props.translationInfo?.translationFields) {
    return props.availableFields;
  }
  
  const translatableFieldNames = props.translationInfo.translationFields.map((tf: any) => tf.field);
  return props.availableFields.filter(field => !translatableFieldNames.includes(field.field));
});

// Refs
const searchTagInputRef = ref<ComponentPublicInstance>();

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

// Methods
function handleSearchUpdate(value: string) {
  emit('update:search-query', value);
  emit('search', value);
}

function addFieldToSearch(field: string) {
  (searchTagInputRef.value as any)?.addFieldToSearch(field);
}

function addOperatorToSearch(operator: string) {
  (searchTagInputRef.value as any)?.addOperatorToSearch(operator);
}

function addLogicalOperator(op: 'AND' | 'OR') {
  if (searchTagInputRef.value) {
    (searchTagInputRef.value as any).addLogicalOperator(op);
  }
}
</script>

<style scoped lang="scss">
.search-container {
  padding: 16px;
  border-bottom: 1px solid var(--border-subdued);
}

.search-input {
  width: 100%;
}

/* Search Help Panel */
.expand-enter-active,
.expand-leave-active {
  transition: all 0.3s ease;
  overflow: hidden;
}

.expand-enter-from,
.expand-leave-to {
  max-height: 0;
  opacity: 0;
}

.expand-enter-to,
.expand-leave-from {
  max-height: 600px;
  opacity: 1;
}

.search-help-panel {
  margin-top: 12px;
  padding: 16px;
  background: var(--background-subdued);
  border-radius: var(--border-radius);
  border: 1px solid var(--border-subdued);
}

.search-help-content {
  display: flex;
  flex-direction: column;
  gap: 20px;
}

.search-help-section {
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.search-help-section h4 {
  margin: 0;
  font-size: 14px;
  font-weight: 600;
  color: var(--foreground-subdued);
}

/* Field Chips */
.field-chips {
  display: flex;
  flex-wrap: wrap;
  gap: 4px;
}

.field-chip {
  cursor: pointer;
  transition: all 0.2s;
}

.field-chip:hover {
  transform: translateY(-1px);
  box-shadow: 0 2px 4px rgba(0, 0, 0, 0.1);
}

.field-type {
  margin-left: 4px;
  opacity: 0.7;
  font-size: 10px;
}

.translation-field-chip {
  background-color: var(--primary-10) !important;
  border-color: var(--primary-25) !important;
}

.translation-field-chip:hover {
  background-color: var(--primary-25) !important;
  border-color: var(--primary) !important;
}

/* Operators Grid */
.operators-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(180px, 1fr));
  gap: 8px;
}

.operator-item {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 4px;
  border-radius: var(--border-radius);
  cursor: pointer;
  transition: background-color 0.2s;
}

.operator-item:hover {
  background-color: var(--background-normal);
}

.operator-button {
  min-width: 50px;
  font-family: monospace;
  font-weight: bold;
}

.operator-info {
  flex: 1;
  min-width: 0;
}

.operator-name {
  font-size: 12px;
  font-weight: 500;
  color: var(--foreground);
}

.operator-example {
  font-size: 11px;
  color: var(--foreground-subdued);
  font-family: monospace;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

/* Logical Operators */
.logical-operators-grid {
  display: flex;
  gap: 8px;
}

.logical-operator-button {
  padding: 8px 24px;
  border: 2px solid var(--border-normal);
  border-radius: var(--border-radius);
  background: var(--background);
  font-weight: 600;
  font-size: 14px;
  cursor: pointer;
  transition: all 0.2s;
}

.logical-operator-button:hover {
  background: var(--background-normal);
  border-color: var(--border-normal-alt);
}

.logical-operator-button.active {
  background: var(--primary);
  color: white;
  border-color: var(--primary);
}

.logical-operator-button.and-button.active {
  background: var(--primary);
}

.logical-operator-button.or-button.active {
  background: var(--warning);
  border-color: var(--warning);
}

.logical-examples {
  padding: 12px;
  background: var(--background);
  border-radius: var(--border-radius);
  font-size: 13px;
}

.logical-examples p {
  margin: 0 0 8px 0;
  font-weight: 500;
}

.logical-examples ul {
  margin: 0;
  padding-left: 20px;
}

.logical-examples li {
  margin-bottom: 4px;
}

.logical-examples code {
  background: var(--background-subdued);
  padding: 2px 6px;
  border-radius: 3px;
  font-size: 12px;
}

.info-note {
  display: flex;
  align-items: center;
  gap: 4px;
  color: var(--foreground-subdued);
  font-style: italic;
}

.search-help-tips {
  padding: 8px 12px;
  background: var(--background-normal-alt);
  border-radius: var(--border-radius);
  font-size: 12px;
  color: var(--foreground-subdued);
  text-align: center;
}
</style>