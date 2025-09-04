<template>
  <!-- STICKY HEADER FIX: Restructured to separate header and body containers for proper sticky behavior -->
  <div class="item-selector-table-wrapper">
    <!-- Fixed Header Container -->
    <div class="table-header-container" ref="headerContainer">
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
        <div v-if="showTitleColumn"
             class="table-cell title-cell header-title-cell"
             :class="{ 
               'is-sortable': isTitleColumnSortable,
               'is-sorted': isTitleFieldSorted 
             }"
             @click="isTitleColumnSortable && handleTitleClick()">
          <span class="field-header-label title-header-label">
            <!-- Invisible spacer to align with status dot in body -->
            <span class="header-status-spacer"></span>
            <!-- Spacer when not sorted -->
            <span v-if="!isTitleFieldSorted" class="sort-icon-spacer"></span>
            <v-icon 
                v-if="isTitleFieldSorted"
                :name="props.sortDirection === 'asc' ? 'arrow_upward' : 'arrow_downward'" 
                small
                class="sort-icon"
            />
            <span class="field-label-text">Title</span>
          </span>
        </div>
        
        <!-- Dynamic Field Columns -->
        <div 
            v-for="field in displayFields" 
            :key="field"
            class="table-cell field-cell header-field-cell"
            :class="[
              `field-${field}`,
              { 'is-resizing': activeColumnSettings === field },
              { 'is-sortable': isFieldSortable(field) },
              { 'is-sorted': props.sortField === field }
            ]"
            @mouseenter="hoveredField = field"
            @mouseleave="hoveredField = null"
            @click="isFieldSortable(field) && handleHeaderClick(field)"
        >
          <span class="field-header-label">
            <!-- Spacer when not sorted to maintain alignment -->
            <span v-if="props.sortField !== field" class="sort-icon-spacer"></span>
            <v-icon 
                v-if="props.sortField === field"
                :name="props.sortDirection === 'asc' ? 'arrow_upward' : 'arrow_downward'" 
                small
                class="sort-icon"
            />
            <span class="field-label-text">
              {{ getFieldLabel(field) }}
              <v-icon 
                  v-if="isFieldTranslatable && isFieldTranslatable(field)" 
                  name="translate" 
                  x-small
                  v-tooltip.top="'Translatable field'"
                  class="field-translation-icon"
              />
            </span>
          </span>
          <v-button
              v-show="hoveredField === field || activeColumnSettings === field"
              icon
              x-small
              secondary
              class="column-settings-trigger"
              @click.stop="openColumnSettings(field, $event)"
              v-tooltip.top="'Resize column'"
          >
            <v-icon name="swap_horiz" x-small />
          </v-button>
        </div>
        
        <!-- Spacer Column -->
        <div class="table-cell spacer-cell"></div>
        
        <!-- Actions Column -->
        <div class="table-cell actions-cell header-actions-cell"
             :class="{ 
               'is-sortable': props.showIds,
               'is-sorted': props.sortField === 'id' 
             }"
             @click="props.showIds && handleHeaderClick('id')">
          <span class="actions-header-content">
            <v-icon 
                v-if="props.showIds && props.sortField === 'id'"
                :name="props.sortDirection === 'asc' ? 'arrow_upward' : 'arrow_downward'" 
                small
                class="sort-icon"
            />
            <v-icon name="more_horiz" small />
          </span>
        </div>
      </div>
    </div>
    </div>
    
    <!-- Scrollable Body Container -->
    <div class="table-body-container" ref="bodyContainer" @scroll="onBodyScroll">
    <div class="table-body">
      <div 
          v-for="item in items" 
          :key="item.id || item"
          class="table-row item-row"
          :class="{ 
            'is-selected': isSelected(item),
            'has-relations': hasRelations(item)
          }"
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
        <div v-if="showTitleColumn" class="table-cell title-cell">
          <div class="title-content">
            <div class="title-with-status">
              <span
                  v-if="item.status"
                  class="status-dot"
                  :class="`status-${item.status}`"
                  v-tooltip.top="capitalizeField(item.status)"
              />
              <span 
                  class="item-title"
                  v-tooltip.top="extractItemTitle(item)"
              >{{ extractItemTitle(item) }}</span>
            </div>
            <!-- Update Info -->
            <span v-if="showLastUpdate && item?.date_updated" class="update-info">
              {{ formatRelativeTime(item.date_updated) }}
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
        
        <!-- Spacer Column -->
        <div class="table-cell spacer-cell"></div>
        
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
</template>

<script setup lang="ts">
import { computed, ref } from 'vue';
import FieldDisplay from './FieldDisplay.vue';
import UsagePopover from './UsagePopover.vue';
import ColumnWidthPopover from './ColumnWidthPopover.vue';
import { extractItemTitle, detectTitleField } from '../utils/helpers';
import { createScopedLogger } from '../utils/logger-wrapper';
import { calculateColumnWidth, getFieldTypeFromInfo } from '../utils/column-width-helpers';

// Create scoped logger
const logger = createScopedLogger('ItemSelectorTable');

// Field interfaces that should not be sortable
const NON_SORTABLE_INTERFACES = [
  'file',
  'file-image',
  'files',
  'alias',
  'presentation-divider',
  'presentation-notice',
  'group-detail',
  'group-accordion',
  'group-tabs'
];

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
  userPresets?: any;
  sortField?: string | null;
  sortDirection?: 'asc' | 'desc';
}

const props = withDefaults(defineProps<Props>(), {
  showIds: false,
  hideEmptyFields: false,
  showLastUpdate: false,
  sortField: null,
  sortDirection: 'asc'
});

const emit = defineEmits<{
  'toggle-selection': [item: any];
  'toggle-all': [value: boolean];
  'open-edit': [item: any];
  'usage-item-click': [payload: { collection: string; item: any }];
  'adjust-column-width': [field: string, relativeWidth: number];
  'reset-column-widths': [];
  'update-sort': [field: string | null, direction: 'asc' | 'desc'];
}>();

// Local state
const hoveredField = ref<string | null>(null);
const activeColumnSettings = ref<string | null>(null);
const columnSettingsAnchor = ref<HTMLElement | null>(null);

// Refs for scroll sync
const headerContainer = ref<HTMLElement | null>(null);
const bodyContainer = ref<HTMLElement | null>(null);

// Debug log for activeColumnSettings changes
import { watch, onMounted } from 'vue';
watch(activeColumnSettings, (newVal, oldVal) => {
  logger.log('activeColumnSettings changed', { from: oldVal, to: newVal });
});

// User-defined column widths (relative percentages)
const userColumnWidths = ref<Record<string, number>>({});

// Load saved column widths on mount and setup scroll sync
onMounted(() => {
  // Ensure header starts with same scroll position as body
  if (headerContainer.value && bodyContainer.value) {
    headerContainer.value.scrollLeft = bodyContainer.value.scrollLeft;
  }
  
  logger.log('ItemSelectorTable mounted', {
    hasUserPresets: !!props.userPresets,
    collectionName: props.collectionName,
    userPresetsType: typeof props.userPresets
  });
  
  if (props.userPresets && props.collectionName) {
    const savedWidths = props.userPresets.loadColumnWidths(props.collectionName);
    logger.log('Attempting to load column widths', {
      collection: props.collectionName,
      savedWidths,
      hasSavedWidths: savedWidths && Object.keys(savedWidths).length > 0
    });
    
    if (savedWidths && Object.keys(savedWidths).length > 0) {
      userColumnWidths.value = savedWidths;
      logger.log('Applied saved column widths', { collection: props.collectionName, widths: savedWidths });
    } else {
      logger.log('No saved column widths found', { collection: props.collectionName });
    }
  } else {
    logger.log('Cannot load column widths - missing userPresets or collectionName', {
      hasUserPresets: !!props.userPresets,
      collectionName: props.collectionName
    });
  }
});

// Save column widths when they change
const saveColumnWidths = () => {
  logger.log('saveColumnWidths called', {
    hasUserPresets: !!props.userPresets,
    collectionName: props.collectionName,
    widthsToSave: userColumnWidths.value
  });
  
  if (props.userPresets && props.collectionName) {
    props.userPresets.saveColumnWidths(props.collectionName, userColumnWidths.value);
    logger.log('Called saveColumnWidths on userPresets', { 
      collection: props.collectionName, 
      widths: userColumnWidths.value 
    });
  } else {
    logger.log('Cannot save column widths - missing userPresets or collectionName');
  }
};

// Computed
const allSelected = computed(() => 
  props.items.length > 0 && props.items.every(item => isSelected(item))
);

const someSelected = computed(() => 
  props.selectedItems.length > 0 && props.selectedItems.length < props.items.length
);

// Computed: Detect which title field is actually used in this collection
const actualTitleField = computed(() => {
  if (!props.items || props.items.length === 0) return null;
  
  // Check first item to detect which title field is used
  const firstItem = props.items[0];
  const detectedField = detectTitleField(firstItem);
  
  // Verify that the detected field is actually available in the collection
  if (detectedField && props.availableFields) {
    const fieldExists = props.availableFields.some(f => f.field === detectedField);
    if (!fieldExists) {
      // The detected field doesn't exist in availableFields, don't use it
      return null;
    }
  }
  
  return detectedField;
});

// Computed: Check if the title field is sorted
const isTitleFieldSorted = computed(() => {
  return actualTitleField.value && props.sortField === actualTitleField.value;
});

// Computed: Check if we should show the title column
const showTitleColumn = computed(() => {
  return actualTitleField.value !== null;
});

// Computed: Check if the title column is sortable
const isTitleColumnSortable = computed(() => {
  if (!actualTitleField.value) return false;
  
  // Check if the actual title field is sortable
  return isFieldSortable(actualTitleField.value);
});

// Grid Template Columns - dynamically calculate column widths
const gridTemplateColumns = computed(() => {
  // Fixed columns: checkbox (48px) and actions (dynamic based on showIds)
  // Title column: flexible with minimum width of 250px (only if title field exists)
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
  
  // Actions column: 150px when showing IDs, 100px when not
  const actionsWidth = props.showIds ? '150px' : '100px';
  
  // Build template with or without title column
  const titleColumn = showTitleColumn.value ? ' minmax(250px, 1fr)' : '';
  
  // Add spacer column to fill remaining space
  const spacerColumn = ' 1fr';
  
  return `48px${titleColumn} ${fieldColumns}${spacerColumn} ${actionsWidth}`;
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

function isFieldSortable(field: string): boolean {
  const fieldInfo = getFieldInfo(field);
  if (!fieldInfo) return true; // Default to sortable if no info
  
  // Check if the interface is in the non-sortable list
  if (fieldInfo.interface && NON_SORTABLE_INTERFACES.includes(fieldInfo.interface)) {
    return false;
  }
  
  // JSON fields are also not sortable
  if (fieldInfo.type === 'json') {
    return false;
  }
  
  // Translation fields ARE sortable - we use nested path (translations.fieldname)
  return true;
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

// Column width adjustment methods
function openColumnSettings(field: string, event: MouseEvent) {
  logger.log('openColumnSettings called', { 
    field, 
    currentActive: activeColumnSettings.value,
    eventTarget: event.target,
    currentWidth: userColumnWidths.value[field],
    allWidths: userColumnWidths.value
  });
  
  activeColumnSettings.value = field;
  columnSettingsAnchor.value = event.target as HTMLElement;
  
  logger.log('Settings state after open', {
    activeColumnSettings: activeColumnSettings.value,
    hasAnchor: !!columnSettingsAnchor.value,
    widthForField: userColumnWidths.value[field] || 0
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
  
  // Save the changes
  saveColumnWidths();
  
  emit('adjust-column-width', field, relativeWidth);
}

// Reset all column widths
function resetAllColumnWidths() {
  logger.log('Resetting all column widths');
  userColumnWidths.value = {};
  
  // Clear saved widths
  if (props.userPresets && props.collectionName) {
    props.userPresets.clearColumnWidths(props.collectionName);
  }
  
  emit('reset-column-widths');
}

// Handle header click for sorting
function handleHeaderClick(field: string) {
  logger.log('Header clicked', { field, currentSortField: props.sortField, currentDirection: props.sortDirection });
  
  if (props.sortField !== field) {
    // New field: sort ascending
    emit('update-sort', field, 'asc');
  } else if (props.sortDirection === 'asc') {
    // Same field, ascending: switch to descending
    emit('update-sort', field, 'desc');
  } else {
    // Same field, descending: disable sorting
    emit('update-sort', null, 'asc');
  }
}

// Handle title column click
function handleTitleClick() {
  const titleField = actualTitleField.value;
  if (!titleField) {
    logger.log('Title header clicked but no title field found');
    return; // No title field found
  }
  
  logger.log('Title header clicked', { 
    titleField,
    currentSortField: props.sortField, 
    currentDirection: props.sortDirection 
  });
  
  if (props.sortField !== titleField) {
    // New field: sort ascending
    emit('update-sort', titleField, 'asc');
  } else if (props.sortDirection === 'asc') {
    // Same field: switch to descending
    emit('update-sort', titleField, 'desc');
  } else {
    // Disable sorting
    emit('update-sort', null, 'asc');
  }
}

// Scroll synchronization function
function onBodyScroll() {
  if (headerContainer.value && bodyContainer.value) {
    // Sync horizontal scroll from body to header
    headerContainer.value.scrollLeft = bodyContainer.value.scrollLeft;
  }
}

// Expose reset function for parent component
({
  resetAllColumnWidths
});
</script>

<style scoped>
.item-selector-table-wrapper {
  display: flex;
  flex-direction: column;
  height: 100%;
  margin-top: 8px;
  position: relative;
}

/* Fixed Header Container */
.table-header-container {
  position: sticky;
  top: 125px;
  z-index: 20;
  background: var(--background-page);
  overflow-x: hidden; /* Will be synced with body scroll */
  border-bottom: 2px solid var(--border-normal);
}

/* Scrollable Body Container */
.table-body-container {
  flex: 1;
  overflow-x: auto;
  overflow-y: auto;
  position: relative;
}

/* Table Header - Grid container for header */
.table-header {
  display: grid;
  grid-template-columns: v-bind(gridTemplateColumns);
  min-width: fit-content;
}

/* Table Body - Grid container for body */
.table-body {
  display: grid;
  grid-template-columns: v-bind(gridTemplateColumns);
  min-width: fit-content;
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
  min-height: 48px; /* Ensure consistent height */
}

/* Header cells - no longer need sticky since container is sticky */
.header-row > .table-cell {
  position: relative;
  z-index: 1;
  background: var(--background-normal-alt) !important; /* Always grey background */
}

/* Header sticky columns need proper background */
.header-row > .checkbox-cell,
.header-row > .title-cell,
.header-row > .actions-cell {
  background: var(--background-normal-alt) !important;
}

/* In header container, sticky columns should not be sticky horizontally */
.table-header-container .checkbox-cell,
.table-header-container .title-cell,
.table-header-container .actions-cell {
  position: relative !important;
  left: 0 !important;
  right: 0 !important;
}

/* Table Rows - Header row uses contents, body rows are grid */
.header-row {
  display: contents;
}

.item-row {
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
  background-color: var(--theme--background); /* Explicit white background */
}

/* Ensure sticky columns in body have proper background */
.item-row > .checkbox-cell,
.item-row > .title-cell,
.item-row > .actions-cell {
  background-color: var(--theme--background);
}

/* Zebra striping - target cells of even rows */
.table-body > .item-row:nth-of-type(even) > .table-cell {
  background-color: var(--theme--background-normal);
}

/* Ensure sticky columns follow zebra striping */
.table-body > .item-row:nth-of-type(even) > .checkbox-cell,
.table-body > .item-row:nth-of-type(even) > .title-cell,
.table-body > .item-row:nth-of-type(even) > .actions-cell {
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
    right: -3px;
    top: 0;
    bottom: 0;
    width: 4px;
    background: linear-gradient(to right, rgba(0, 0, 0, 0.1), transparent);
    pointer-events: none;
    z-index: 4;
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
    right: -3px;
    top: 0;
    bottom: 0;
    width: 4px;
    background: linear-gradient(to right, rgba(0, 0, 0, 0.08), transparent);
    pointer-events: none;
    z-index: 3;
  }
}

.field-cell {
  /* Width handled by grid template */
  min-width: 0; /* Allow shrinking */
  max-width: 100%; /* Prevent overflow */
  overflow: hidden;
}

/* Spacer Cell */
.spacer-cell {
  /* No content, just fills space */
  min-width: 0;
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
    left: -3px;
    top: 0;
    bottom: 0;
    width: 4px;
    background: linear-gradient(to left, rgba(0, 0, 0, 0.1), transparent);
    pointer-events: none;
    z-index: 4;
  }
}

/* Header actions cell - centered icon */
.header-actions-cell {
  justify-content: center;
  text-align: center;
  color: var(--foreground-subdued);
  
  &.is-sortable {
    cursor: pointer;
    user-select: none;
  }
}

/* Actions header content wrapper */
.actions-header-content {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 0; /* No gap to control spacing manually */
  position: relative;
  min-width: 40px; /* Fixed width to prevent shifting */
  
  .sort-icon {
    position: static; /* Not absolute, keep in flow */
    transform: none;
    margin-right: 2px; /* Small gap to more_horiz icon */
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
  padding-right: 3px; /* Space for absolute positioned button */
  padding-left: 0; /* No fixed padding - will be handled by sort icon */
  min-width: 0;
  position: relative;
}

/* Field label text with ellipsis */
.field-label-text {
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  min-width: 0;
  flex: 1;
  display: inline-flex;
  align-items: center;
  gap: 4px;
}

.field-translation-icon {
  color: var(--primary);
  opacity: 0.7;
  flex-shrink: 0;
  display: inline-flex;
  margin-left: 2px;
}

/* Special handling for title header label */
.title-header-label {
  padding-left: 0; /* No padding - icon will be inline */
  
  .sort-icon {
    position: relative !important; /* Override absolute positioning */
    left: auto !important;
    top: auto !important;
    transform: none !important;
    margin-right: 4px;
  }
}

/* Spacer to align header with body that has status dots */
.header-status-spacer {
  display: inline-block;
  width: 8px; /* Same width as status dot */
  height: 8px;
  margin-right: 8px; /* Same gap as status dot */
  flex-shrink: 0;
}

/* Sortable Headers */
.header-field-cell.is-sortable,
.header-title-cell.is-sortable {
  cursor: pointer;
  user-select: none;
  
  &.is-sorted {
    .field-header-label {
      font-weight: 700;
    }
  }
}

/* Non-sortable headers */
.header-field-cell:not(.is-sortable) {
  cursor: default;
  
  .field-label-text {
    opacity: 0.8;
  }
}

/* Sort Icon */
.sort-icon {
  color: var(--primary);
  position: relative;
  flex-shrink: 0;
  margin-right: 4px;
}

/* Spacer for alignment when no sort icon is shown */
.sort-icon-spacer {
  display: inline-block;
  width: 18px; /* Same width as sort icon */
  margin-right: 4px; /* Same margin as sort icon */
  flex-shrink: 0;
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
  padding: 8px 1px;
}

/* Title Content Container */
.title-content {
  display: flex;
  flex-direction: column;
  gap: 2px;
  max-width: 100%;
}

/* Title with Status Container */
.title-with-status {
  display: flex;
  align-items: center;
  gap: 8px;
  min-width: 0; /* Allow flex children to shrink for ellipsis */
  width: 100%;
}

/* Item Title */
.item-title {
  font-weight: 600;
  color: var(--foreground-normal);
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
  display: block;
  flex: 1; /* Take available space */
  min-width: 0; /* Critical for ellipsis in flex containers */
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
  top: 29px;
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

/* Scrollbar styling for body container */
.table-body-container::-webkit-scrollbar {
  height: 8px;
  width: 8px;
}

.table-body-container::-webkit-scrollbar-track {
  background: var(--background-normal);
}

.table-body-container::-webkit-scrollbar-thumb {
  background-color: var(--border-normal);
  border-radius: 4px;
}

.table-body-container::-webkit-scrollbar-thumb:hover {
  background-color: var(--border-normal-alt);
}
</style>