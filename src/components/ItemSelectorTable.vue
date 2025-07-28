<template>
  <div class="item-selector-table-wrapper">
    <!-- Table Header (Sticky) -->
    <div class="table-header" :class="{ 'is-sticky': displayFields.length > 0 }">
      <div class="table-row header-row">
        <!-- Checkbox Column -->
        <div class="table-cell checkbox-cell">
          <v-checkbox
              :model-value="allSelected"
              :indeterminate="someSelected && !allSelected"
              @update:model-value="toggleAll"
              v-tooltip.top="allSelected ? 'Deselect all' : 'Select all'"
          />
        </div>
        
        <!-- Title Column -->
        <div class="table-cell title-cell">
          <!-- Empty header or you can add an icon -->
        </div>
        
        <!-- Dynamic Field Columns -->
        <div 
            v-for="field in displayFields" 
            :key="field"
            class="table-cell field-cell"
            :class="`field-${field}`"
        >
          <span class="field-header-label">
            {{ getFieldLabel(field) }}
            <v-icon 
                v-if="isFieldTranslatable && isFieldTranslatable(field)" 
                name="translate" 
                x-small
                v-tooltip.top="'Translatable field'"
                class="field-translation-icon"
            />
          </span>
        </div>
        
        <!-- Actions Column -->
        <div class="table-cell actions-cell">
          <!-- Empty header for actions column -->
        </div>
      </div>
    </div>
    
    <!-- Table Body -->
    <div class="table-body">
      <div 
          v-for="item in items" 
          :key="item.id || item"
          class="table-row item-row"
          :class="{ 
            'is-selected': isSelected(item),
            'has-relations': hasRelations(item)
          }"
          @click="toggleSelection(item)"
      >
        <!-- Checkbox Column -->
        <div class="table-cell checkbox-cell">
          <v-checkbox
              :model-value="isSelected(item)"
              @click.stop
              @update:model-value="toggleSelection(item)"
          />
        </div>
        
        <!-- Title Column with Status -->
        <div class="table-cell title-cell">
          <div class="title-content">
            <div class="title-with-status">
              <span
                  v-if="item.status"
                  class="status-dot"
                  :class="`status-${item.status}`"
                  v-tooltip.top="capitalizeField(item.status)"
              />
              <span class="item-title">{{ extractItemTitle(item) }}</span>
            </div>
            <!-- Update Info -->
            <span v-if="showLastUpdate && item.date_updated" class="update-info">
              {{ formatRelativeTime(item.date_updated) }}
              <span v-if="item.user_updated">
                by {{ getUserDisplayName(item.user_updated) }}
              </span>
            </span>
          </div>
        </div>
        
        <!-- Dynamic Field Columns -->
        <div 
            v-for="field in displayFields" 
            :key="field"
            class="table-cell field-cell"
            :class="`field-${field}`"
        >
          <FieldDisplay
              v-if="!hideEmptyFields || !isFieldEmpty(getTranslatedValue(item, field))"
              :value="getTranslatedValue(item, field)"
              :field="field"
              :field-info="getFieldInfo(field)"
              :max-length="getMaxLengthForField(field)"
          />
        </div>
        
        <!-- Actions Column -->
        <div class="table-cell actions-cell">
          <div class="action-buttons">
            <!-- Relations/Usage Indicator -->
            <UsagePopover
              v-if="itemRelations && itemRelations[item.id]"
              :item-relations="itemRelations[item.id]"
              :item-id="item.id"
              @item-click="handleUsageItemClick"
            />
            
            <!-- ID Badge -->
            <v-chip v-if="showIds && item.id" x-small label class="item-id-badge">
              <v-icon name="fingerprint" x-small />
              {{ item.id }}
            </v-chip>
            
            <!-- Edit Button -->
            <v-button
              x-small
              icon
              secondary
              class="item-edit-button"
              @click.stop="openEditDrawer(item)"
              v-tooltip.top="'Edit item'"
            >
              <v-icon name="edit" x-small />
            </v-button>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed } from 'vue';
import FieldDisplay from './FieldDisplay.vue';
import UsagePopover from './UsagePopover.vue';
import { extractItemTitle } from '../utils/helpers';
import { createScopedLogger } from '../utils/logger-wrapper';

// Create scoped logger
const logger = createScopedLogger('ItemSelectorTable');

interface Props {
  items: any[];
  selectedItems: (string | number)[];
  displayFields: string[];
  collectionName?: string;
  availableFields?: Array<{
    field: string;
    name?: string;
    type: string;
    interface?: string;
    display?: string;
    options?: any;
    translatable?: boolean;
  }>;
  itemRelations?: Record<string, any[]>;
  showIds?: boolean;
  hideEmptyFields?: boolean;
  showLastUpdate?: boolean;
  getTranslatedFieldValue?: (item: any, field: string) => string;
  isFieldTranslatable?: (field: string) => boolean;
}

const props = withDefaults(defineProps<Props>(), {
  showIds: false,
  hideEmptyFields: false,
  showLastUpdate: false
});

const emit = defineEmits<{
  'toggle-selection': [item: any];
  'toggle-all': [value: boolean];
  'open-edit': [item: any];
  'usage-item-click': [payload: { collection: string; item: any }];
}>();

// Computed
const allSelected = computed(() => 
  props.items.length > 0 && props.items.every(item => isSelected(item))
);

const someSelected = computed(() => 
  props.selectedItems.length > 0 && props.selectedItems.length < props.items.length
);

// Methods
function isSelected(item: any): boolean {
  const itemId = item.id || item;
  return props.selectedItems.includes(itemId);
}

function toggleSelection(item: any) {
  emit('toggle-selection', item);
}

function toggleAll(value: boolean) {
  emit('toggle-all', value);
}

function hasRelations(item: any): boolean {
  return !!(props.itemRelations && props.itemRelations[item.id]);
}

function getFieldLabel(field: string): string {
  const fieldInfo = props.availableFields?.find(f => f.field === field);
  return fieldInfo?.name || capitalizeField(field);
}

function getFieldInfo(field: string) {
  // First check in available fields
  const fieldFromAvailable = props.availableFields?.find(f => f.field === field);
  
  if (fieldFromAvailable) {
    return fieldFromAvailable;
  }

  return null;
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

function getTranslatedValue(item: any, field: string): string {
  if (props.getTranslatedFieldValue) {
    const value = props.getTranslatedFieldValue(item, field);
    return value;
  }
  return item[field] || '';
}

function isFieldEmpty(value: any): boolean {
  if (value === null || value === undefined) return true;
  if (typeof value === 'string') return value.trim() === '';
  if (Array.isArray(value)) return value.length === 0;
  if (typeof value === 'object') {
    return Object.keys(value).length === 0;
  }
  return false;
}

function getMaxLengthForField(field: string): number {
  // Adjust max length based on field type
  const fieldInfo = getFieldInfo(field);
  if (fieldInfo?.interface === 'input-rich-text-html' || fieldInfo?.interface === 'input-rich-text-md') {
    return 150;
  }
  return 100;
}

function openEditDrawer(item: any) {
  emit('open-edit', item);
}

function handleUsageItemClick(payload: { collection: string; item: any }) {
  emit('usage-item-click', payload);
}

function formatRelativeTime(dateString: string): string {
  if (!dateString) return '';
  
  const date = new Date(dateString);
  const now = new Date();
  const diff = now.getTime() - date.getTime();
  
  const seconds = Math.floor(diff / 1000);
  const minutes = Math.floor(seconds / 60);
  const hours = Math.floor(minutes / 60);
  const days = Math.floor(hours / 24);
  
  if (days > 7) {
    return date.toLocaleDateString();
  } else if (days > 0) {
    return `${days}d ago`;
  } else if (hours > 0) {
    return `${hours}h ago`;
  } else if (minutes > 0) {
    return `${minutes}m ago`;
  } else {
    return 'now';
  }
}

function getUserDisplayName(user: any): string {
  if (!user) return '';
  
  if (user.first_name || user.last_name) {
    return [user.first_name, user.last_name].filter(Boolean).join(' ');
  } else if (user.email) {
    return user.email.split('@')[0];
  }
  
  return 'Unknown';
}
</script>

<style scoped>
.item-selector-table-wrapper {
  display: flex;
  flex-direction: column;
  height: 100%;

  margin-top: 8px;
}

/* Table Header */
.table-header {
  background: var(--background-normal);
  border-bottom: 2px solid var(--border-normal);
  box-shadow: 0 2px 4px -2px rgba(0, 0, 0, 0.1);
}

.table-header.is-sticky {
  position: sticky;
  top: 125px;
  z-index: 2;
}

.header-row {
  font-weight: 600;
  font-size: 12px;
  text-transform: uppercase;
  letter-spacing: 0.05em;
  color: var(--foreground-subdued);
  background: var(--background-normal-alt);
}

/* Table Body */
.table-body {
  flex: 1;
  overflow-y: auto;
  overflow-x: auto;
}

/* Table Rows */
.table-row {
  display: flex;
  align-items: center;
  min-height: 52px;
  border-bottom: 1px solid var(--border-subdued);
  transition: background-color 0.2s;
}

.item-row {
  cursor: pointer;
}

/* Zebra striping - every second row */
.item-row:nth-child(even) {
  background-color: var(--theme--background-normal);
}

.item-row:hover {
  background-color: var(--background-normal-alt);
}

.item-row.is-selected {
  background-color: var(--primary-10);
}

.item-row.is-selected:hover {
  background-color: var(--primary-25);
}

/* Table Cells */
.table-cell {
  padding: 8px 12px;
  display: flex;
  align-items: center;
  overflow: hidden;

  &.title-cell {
    position: relative;
  }
}



/* Column Widths */
.checkbox-cell {
  width: 48px;
  flex-shrink: 0;
  justify-content: center;
}

.title-cell {
  flex: 1 1 auto;
  min-width: 200px;
}

.field-cell {
  flex: 0 1 200px;
  min-width: 100px;
  max-width: 250px;
}

.actions-cell {
  min-width: 150px;
  flex-shrink: 0;
  flex-grow: 0;
  margin-left: auto;
  justify-content: flex-end;
  text-align: right;
  padding-right: 16px;
}

/* Field Header */
.field-header-label {
  display: flex;
  align-items: center;
  gap: 4px;
}

.field-translation-icon {
  color: var(--primary);
  opacity: 0.7;
}

/* Title Content Container */
.title-content {
  display: flex;
  flex-direction: column;
  gap: 2px;
}

/* Title with Status Container */
.title-with-status {
  display: flex;
  align-items: center;
  gap: 8px;
}

/* Item Title */
.item-title {
  font-weight: 600;
  color: var(--foreground-normal);
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
  display: block;
}

/* Update Info */
.update-info {
  font-size: 10px;
  color: var(--theme--foreground);
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
  display: block;
  position: absolute;
  top: 22px;
  left: 27px;
}

/* Status Dot */
.status-dot {
  width: 8px;
  height: 8px;
  border-radius: 50%;
  background: var(--foreground-subdued);
  
  &.status-published {
    background: var(--primary);
  }
  
  &.status-draft {
    background: var(--foreground-normal);
  }
  
  &.status-archived {
    background: var(--warning);
  }
}

/* Action Buttons */
.action-buttons {
  display: flex;
  align-items: center;
  gap: 8px;
}

.item-edit-button {
  opacity: 0.7;
  transition: opacity 0.2s;
}

.item-edit-button:hover {
  opacity: 1;
}

.item-id-badge {
  background-color: var(--background-subdued);
  color: var(--foreground-subdued);
  font-family: var(--family-monospace);
  font-size: 11px;
  
  :deep(.v-icon) {
    margin-right: 4px;
    --v-icon-size: 14px;
  }
}

/* Responsive */
@media (max-width: 960px) {
  .field-cell {
    min-width: 150px;
  }
  
  .title-cell {
    min-width: 150px;
  }
}

/* Scrollbar styling */
.table-body::-webkit-scrollbar {
  height: 8px;
  width: 8px;
}

.table-body::-webkit-scrollbar-track {
  background: var(--background-normal);
}

.table-body::-webkit-scrollbar-thumb {
  background-color: var(--border-normal);
  border-radius: 4px;
}

.table-body::-webkit-scrollbar-thumb:hover {
  background-color: var(--border-normal-alt);
}
</style>