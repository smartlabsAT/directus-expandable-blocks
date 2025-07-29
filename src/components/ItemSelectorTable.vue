<template>
  <div class="item-selector-table-wrapper">
    <div class="table-scroll-container">
      <!-- Table Header (Sticky) -->
      <div class="table-header">
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
          <span class="field-header-label">Title</span>
        </div>
        
        <!-- Dynamic Field Columns -->
        <div 
            v-for="field in displayFields" 
            :key="field"
            class="table-cell field-cell"
            :class="[
              `field-${field}`,
              { 'is-resizing': activeColumnSettings === field }
            ]"
            @mouseenter="hoveredField = field"
            @mouseleave="hoveredField = null"
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
          <v-button
              v-show="hoveredField === field || activeColumnSettings === field"
              icon
              x-small
              secondary
              class="column-settings-trigger"
              @click="openColumnSettings(field, $event)"
              v-tooltip.top="'Resize column'"
          >
            <v-icon name="swap_horiz" x-small />
          </v-button>
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
            :class="[
              `field-${field}`,
              { 'is-resizing': activeColumnSettings === field }
            ]"
        >
          <div class="cell-content">
            <FieldDisplay
                v-if="!hideEmptyFields || !isFieldEmpty(getTranslatedValue(item, field))"
                :value="getTranslatedValue(item, field)"
                :field="field"
                :field-info="getFieldInfo(field)"
                :max-length="getMaxLengthForField(field)"
            />
          </div>
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
    
    <!-- Column Width Popover -->
    <ColumnWidthPopover
        v-if="activeColumnSettings"
        :model-value="!!activeColumnSettings"
        :field="activeColumnSettings"
        :field-info="getFieldInfo(activeColumnSettings)"
        :current-width="userColumnWidths[activeColumnSettings] || 0"
        :anchor="columnSettingsAnchor"
        @update:model-value="val => !val && closeColumnSettings()"
        @update-width="width => adjustColumnWidth(activeColumnSettings!, width)"
    />
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed, ref } from 'vue';
import FieldDisplay from './FieldDisplay.vue';
import UsagePopover from './UsagePopover.vue';
import ColumnWidthPopover from './ColumnWidthPopover.vue';
import { extractItemTitle } from '../utils/helpers';
import { createScopedLogger } from '../utils/logger-wrapper';
import { calculateColumnWidth, getFieldTypeFromInfo } from '../utils/column-width-helpers';

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
  'adjust-column-width': [field: string, relativeWidth: number];
  'reset-column-widths': [];
}>();

// Local state
const hoveredField = ref<string | null>(null);
const activeColumnSettings = ref<string | null>(null);
const columnSettingsAnchor = ref<HTMLElement | null>(null);

// Debug log for activeColumnSettings changes
import { watch } from 'vue';
watch(activeColumnSettings, (newVal, oldVal) => {
  logger.log('activeColumnSettings changed', { from: oldVal, to: newVal });
});

// User-defined column widths (relative percentages)
const userColumnWidths = ref<Record<string, number>>({});

// Computed
const allSelected = computed(() => 
  props.items.length > 0 && props.items.every(item => isSelected(item))
);

const someSelected = computed(() => 
  props.selectedItems.length > 0 && props.selectedItems.length < props.items.length
);

// Grid Template Columns - dynamically calculate column widths
const gridTemplateColumns = computed(() => {
  // Fixed columns: checkbox (48px) and actions (150px)
  // Title column: flexible with minimum width of 250px
  // Dynamic field columns: calculated based on field type and user preferences
  const fieldColumns = props.displayFields.map(field => {
    const fieldInfo = getFieldInfo(field);
    const userWidth = userColumnWidths.value[field];
    
    if (userWidth !== undefined) {
      // Apply user-defined relative width
      return calculateColumnWidth(fieldInfo, { [getFieldTypeFromInfo(fieldInfo)]: userWidth });
    }
    
    return calculateColumnWidth(fieldInfo);
  }).join(' ');
  
  return `48px minmax(250px, 1fr) ${fieldColumns} 150px`;
});

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

// Column width adjustment methods
function openColumnSettings(field: string, event: MouseEvent) {
  logger.log('openColumnSettings called', { 
    field, 
    currentActive: activeColumnSettings.value,
    eventTarget: event.target 
  });
  
  activeColumnSettings.value = field;
  columnSettingsAnchor.value = event.target as HTMLElement;
  
  logger.log('Settings state after open', {
    activeColumnSettings: activeColumnSettings.value,
    hasAnchor: !!columnSettingsAnchor.value
  });
}

function closeColumnSettings() {
  logger.log('closeColumnSettings called', {
    wasActive: activeColumnSettings.value
  });
  
  activeColumnSettings.value = null;
  columnSettingsAnchor.value = null;
}

function adjustColumnWidth(field: string, relativeWidth: number) {
  logger.log('adjustColumnWidth called', { field, relativeWidth });
  
  if (relativeWidth === 0) {
    // Remove from userColumnWidths if reset to default
    delete userColumnWidths.value[field];
  } else {
    userColumnWidths.value[field] = relativeWidth;
  }
  
  emit('adjust-column-width', field, relativeWidth);
}

// Reset all column widths
function resetAllColumnWidths() {
  logger.log('Resetting all column widths');
  userColumnWidths.value = {};
  emit('reset-column-widths');
}

// Expose reset function for parent component
defineExpose({
  resetAllColumnWidths
});
</script>

<style scoped>
.item-selector-table-wrapper {
  display: flex;
  flex-direction: column;
  height: 100%;
  margin-top: 8px;
}

/* Scroll Container - Now the main grid container */
.table-scroll-container {
  display: grid;
  grid-template-columns: v-bind(gridTemplateColumns);
  height: 100%;
  overflow-x: auto;
  overflow-y: auto;
  position: relative;
  align-items: start; /* Align items to top */
}

/* Table Header */
/* Table sections use display: contents to pass grid to children */
.table-header,
.table-body {
  display: contents;
}

.header-row {
  display: contents;
}

.header-row > .table-cell {
  font-weight: 600;
  font-size: 12px;
  text-transform: uppercase;
  letter-spacing: 0.05em;
  color: var(--foreground-subdued);
  background: var(--background-normal-alt);
}

/* Header cells need sticky positioning */
.header-row > .table-cell {
  position: sticky;
  top: 0;
  z-index: 10;
  background: var(--background-normal);
  border-bottom: 2px solid var(--border-normal);
}

/* Header sticky columns need higher z-index */
.header-row > .checkbox-cell,
.header-row > .title-cell,
.header-row > .actions-cell {
  z-index: 15; /* Higher than regular header cells */
  background: var(--background-normal-alt);
}

/* Table Rows also use display: contents */
.table-row {
  display: contents;
}

/* Style row backgrounds on the cells instead */
.item-row > .table-cell {
  min-height: 52px;
  border-bottom: 1px solid var(--border-subdued);
  transition: background-color 0.2s;
}

/* Row styling via cells since rows use display: contents */
.item-row > .table-cell {
  cursor: pointer;
}

/* Zebra striping - target cells of even rows */
.table-body > .item-row:nth-of-type(even) > .table-cell {
  background-color: var(--theme--background-normal);
}

/* Hover state */
.item-row:hover > .table-cell {
  background-color: var(--background-normal-alt);
}

/* Selected state */
.item-row.is-selected > .table-cell {
  background-color: var(--primary-10);
}

.item-row.is-selected:hover > .table-cell {
  background-color: var(--primary-25);
}

/* Table Cells - Now direct grid items */
.table-cell {
  padding: 8px 12px;
  display: flex;
  align-items: center;
  min-width: 0; /* CRITICAL: Allows cells to shrink below content width */
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  position: relative; /* For pseudo-elements */

  &.title-cell {
    white-space: normal; /* Allow wrapping for title if needed */
  }
}

/* Ensure cells span full height */
.item-row > .table-cell {
  align-self: stretch;
}



/* Column Widths - Now handled by grid */
.checkbox-cell {
  justify-content: center;
  min-width: 0;
  position: sticky;
  left: 0;
  z-index: 3;
  background: var(--background-page);
  
  /* Shadow on right edge */
  &::after {
    content: '';
    position: absolute;
    right: 0;
    top: 0;
    bottom: 0;
    width: 4px;
    background: linear-gradient(to right, rgba(0, 0, 0, 0.1), transparent);
    pointer-events: none;
  }
}

.title-cell {
  /* Min-width handled by grid template */
  min-width: 0; /* Prevent grid blowout */
  position: sticky;
  left: 48px; /* Width of checkbox column */
  z-index: 2;
  background: var(--background-page);
  
  /* Shadow on right edge when scrolling */
  &::after {
    content: '';
    position: absolute;
    right: 0;
    top: 0;
    bottom: 0;
    width: 4px;
    background: linear-gradient(to right, rgba(0, 0, 0, 0.08), transparent);
    pointer-events: none;
  }
}

.field-cell {
  /* Width handled by grid template */
  min-width: 0; /* Allow shrinking */
  max-width: 100%; /* Prevent overflow */
  overflow: hidden;
  text-overflow: ellipsis;
}

.actions-cell {
  justify-content: flex-end;
  text-align: right;
  padding-right: 16px;
  min-width: 0;
  position: sticky;
  right: 0;
  z-index: 3;
  background: var(--background-page);
  
  /* Shadow on left edge */
  &::before {
    content: '';
    position: absolute;
    left: 0;
    top: 0;
    bottom: 0;
    width: 4px;
    background: linear-gradient(to left, rgba(0, 0, 0, 0.1), transparent);
    pointer-events: none;
  }
}

/* Cell content wrapper for overflow control */
.cell-content {
  width: 100%;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

/* Field Header */
.field-header-label {
  display: flex;
  align-items: center;
  gap: 4px;
  flex: 1;
  padding-right: 28px; /* Space for absolute positioned button */
  min-width: 0;
  overflow: hidden;
  text-overflow: ellipsis;
}

.field-translation-icon {
  color: var(--primary);
  opacity: 0.7;
}

/* Column Settings Button */
.column-settings-trigger {
  opacity: 0;
  transition: opacity 0.2s;
  flex-shrink: 0;
  position: absolute;
  right: 4px;
  top: 50%;
  transform: translateY(-50%);
  z-index: 2;
  
  --v-button-background-color: var(--background-normal-alt);
  --v-button-background-color-hover: var(--background-normal);
}

.field-cell:hover .column-settings-trigger {
  opacity: 0.8;
}

.column-settings-trigger:hover {
  opacity: 1 !important;
}

/* Ensure header cells can contain both label and button */
.header-row > .field-cell {
  display: flex;
  align-items: center;
  justify-content: space-between;
  position: relative;
  overflow: visible; /* Allow button to be visible even in small columns */
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

/* Column resizing feedback */
.field-cell.is-resizing {
  background-color: var(--primary-10) !important;
  position: relative;
}

/* Highlight entire column during resize */
.field-cell.is-resizing::before {
  content: '';
  position: absolute;
  top: -1000px;
  bottom: -1000px;
  left: 0;
  right: 0;
  background-color: var(--primary-5);
  pointer-events: none;
  z-index: -1;
}

/* Header cell resizing state */
.header-row > .field-cell.is-resizing {
  background-color: var(--primary-25) !important;
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

/* Horizontal scrollbar for the container */
.table-scroll-container::-webkit-scrollbar {
  height: 8px;
}

.table-scroll-container::-webkit-scrollbar-track {
  background: var(--background-normal);
}

.table-scroll-container::-webkit-scrollbar-thumb {
  background-color: var(--border-normal);
  border-radius: 4px;
}

.table-scroll-container::-webkit-scrollbar-thumb:hover {
  background-color: var(--border-normal-alt);
}
</style>