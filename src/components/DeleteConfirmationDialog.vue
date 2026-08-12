<template>
  <v-dialog
    :model-value="modelValue"
    @update:model-value="$emit('update:modelValue', $event)"
    @esc="handleCancel"
  >
    <v-card>
      <v-card-title>
        <div style="display: flex; align-items: center; gap: 12px;">
          <v-icon 
            :name="loading ? 'hourglass_empty' : 'delete'" 
            :color="loading ? 'subdued' : 'danger'" 
            :style="{ color: loading ? 'inherit' : 'var(--danger)' }"
          />
          <span :style="{ color: loading ? 'inherit' : 'var(--danger)' }">{{ 
            loading ? 'Checking Usage...' : 
            (usageInfo && usageInfo.totalCount > 1 && !usageInfo.canDelete) ? 'Item is used in multiple locations' : 
            'Confirm Deletion' 
          }}</span>
        </div>
      </v-card-title>

      <v-card-text>
        <!-- Always render content to avoid focus-trap error -->
        <!-- Loading State -->
        <div v-if="loading" class="loading-container">
          <v-progress-circular indeterminate />
          <p>Checking where this item is being used...</p>
        </div>

        <!-- Usage Information -->
        <div v-else-if="usageInfo">
          <!-- Block Display (Custom Implementation) - only show if we have an item -->
          <div v-if="item" class="block-display">
            <div class="block-display-header">
              <!-- Icon -->
              <div class="block-icon-wrapper">
                <v-icon 
                  :name="itemIcon || 'box'" 
                  class="block-icon"
                />
                <div 
                  v-if="item && item.item === null"
                  class="status-indicator deleted"
                />
              </div>
              
              <!-- Title and Info -->
              <div class="block-display-info">
                <div class="block-display-main">
                  <span class="block-display-title" :class="{ deleted: item && item.item === null }">
                    {{ item && item.item === null ? 'Deleted Item' : (itemTitle || 'Untitled') }}
                  </span>
                </div>
                <v-chip x-small class="block-collection-chip">
                  {{ collectionName || 'Unknown' }}
                </v-chip>
                
                <!-- Status Display -->
                <div v-if="item && item.item && typeof item.item === 'object' && 'status' in item.item" class="block-status-display">
                  <div 
                    class="status-dot"
                    :class="`status-${item.item.status || 'draft'}`"
                  />
                  <span class="status-text">
                    {{ getStatusLabel(item.item.status || 'draft') }}
                  </span>
                </div>
              </div>
            </div>
          </div>
          
          <!-- If no item, show simple text -->
          <div v-else class="no-item-display">
            <p>{{ itemTitle || 'Untitled' }}</p>
            <p>{{ collectionName || 'Unknown' }}</p>
          </div>

          <!-- Cannot verify usage warning -->
          <v-notice
            v-if="usageInfo.hasUncheckedUsage"
            type="warning"
            icon="warning"
          >
            <div>
              <strong style="display: block; margin-bottom: 8px;">Cannot verify item usage</strong>
              <p style="margin: 0;">For safe deletion with usage checking, please install the <code>expandable-blocks-api</code> extension.</p>
            </div>
          </v-notice>


          <!-- Deletion Options - Always show if we have usage info -->
          <div v-if="usageInfo" class="deletion-options">
            <v-divider />
            <h4>Choose action:</h4>
            <div class="action-options">
              <label class="action-option" :class="{ selected: !deleteContent }">
                <input
                  type="radio"
                  v-model="deleteContent"
                  :value="false"
                />
                <div class="option-content">
                  <v-icon name="link_off" />
                  <div>
                    <strong>Unassign only</strong>
                    <p>Remove from this page, keep the content</p>
                  </div>
                </div>
              </label>
              
              <label class="action-option" :class="{ selected: deleteContent }">
                <input
                  type="radio"
                  v-model="deleteContent"
                  :value="true"
                />
                <div class="option-content">
                  <v-icon name="delete" color="danger" />
                  <div>
                    <strong>Delete permanently</strong>
                    <p>Remove content from database</p>
                  </div>
                </div>
              </label>
            </div>
            
            <!-- Usage Details - only show when delete is selected and item is used elsewhere -->
            <div v-if="deleteContent && !usageInfo.hasUncheckedUsage && usageInfo.locations && usageInfo.locations.length > 0 && !(usageInfo.totalCount === 1 && usageInfo.currentPageUsage)">
              <!-- Usage Warning -->
              <v-notice
                type="danger"
                icon="warning"
                style="margin-top: 16px;"
              >
                <div>
                  <strong style="display: block;">This item is used in {{ usageInfo.totalCount - (usageInfo.currentPageUsage ? 1 : 0) }} other {{ (usageInfo.totalCount - (usageInfo.currentPageUsage ? 1 : 0)) === 1 ? 'location' : 'locations' }}</strong>
                  <span style="display: block; margin-top: 4px;">To delete this item permanently, you must acknowledge each usage location below.</span>
                </div>
              </v-notice>

              <div class="usage-summary">
                <v-icon name="link" small />
                <strong>Used in {{ usageInfo.totalCount }} {{ usageInfo.totalCount === 1 ? 'location' : 'locations' }}:</strong>
              </div>

              <!-- Usage locations with acknowledgment checkboxes -->
              <div class="location-list-with-checks">
                <div
                  v-for="(location, index) in usageInfo.locations"
                  :key="getLocationKey(location, index)"
                  class="location-item-with-check"
                  :class="{ 
                    'current-page': location.id === currentPageId,
                    'acknowledged': acknowledgedLocations.has(getLocationKey(location, index))
                  }"
                >
                  <!-- Skip checkbox for current page -->
                  <input
                    v-if="location.id !== currentPageId"
                    type="checkbox"
                    :checked="acknowledgedLocations.has(getLocationKey(location, index))"
                    @change="toggleLocationAcknowledgment(getLocationKey(location, index))"
                    class="location-checkbox"
                  />
                  <div v-else class="checkbox-spacer"></div>
                  
                  <v-icon
                    :name="getCollectionIcon(location.collection)"
                    class="location-icon"
                    small
                  />
                  <div class="location-info">
                    <span class="location-title">
                      {{ location.title || `${location.collection} #${location.id}` }}
                    </span>
                    <a
                      :href="`/admin/content/${location.collection}/${location.id}`"
                      target="_blank"
                      rel="noopener noreferrer"
                      class="location-link"
                      @click.stop
                    >
                      <v-icon
                        name="open_in_new"
                        small
                      />
                    </a>
                    <v-chip
                      v-if="location.id === currentPageId"
                      x-small
                      outlined
                    >
                      This Page
                    </v-chip>
                  </div>
                </div>
              </div>
            </div>
            
            <!-- Risk Acknowledgment Checkbox when usage cannot be verified and delete is selected -->
            <div v-if="usageInfo.hasUncheckedUsage && deleteContent" class="risk-acknowledgment-section">
              <label class="risk-checkbox">
                <input
                  type="checkbox"
                  v-model="acknowledgeRisk"
                />
                <span>I understand the risk and want to delete this item anyway</span>
              </label>
            </div>
          </div>
        </div>

        <!-- Error State -->
        <v-notice
          v-else-if="error"
          type="danger"
          icon="error"
        >
          {{ error }}
        </v-notice>
        
        <!-- Default State (prevent focus-trap error) -->
        <div v-else>
          <p>Preparing to check item usage...</p>
        </div>
      </v-card-text>

      <v-card-actions>
        <v-button
          secondary
          @click="handleCancel"
        >
          Cancel
        </v-button>
        
        <v-button
          v-if="canProceed"
          :kind="deleteContent ? 'danger' : 'warning'"
          @click="handleConfirm"
          :loading="loading"
        >
          {{ confirmButtonText }}
        </v-button>
      </v-card-actions>
    </v-card>
  </v-dialog>
</template>

<script setup lang="ts">
import { ref, computed, watch } from 'vue';
import type { ItemUsageInfo } from '../services/RelationChecker';
import type { JunctionRecord } from '../types';

interface Props {
  modelValue: boolean;
  item: JunctionRecord | null;
  itemTitle?: string;
  itemIcon?: string;
  collectionName?: string;
  usageInfo?: ItemUsageInfo | null;
  loading?: boolean;
  error?: string | null;
  currentPageId?: string | number | null;
  allowForceDelete?: boolean;
}

const props = withDefaults(defineProps<Props>(), {
  itemTitle: 'Untitled',
  itemIcon: 'box',
  collectionName: 'Unknown',
  usageInfo: null,
  loading: false,
  error: null,
  currentPageId: null,
  allowForceDelete: false
});

const emit = defineEmits<{
  'update:modelValue': [value: boolean];
  'confirm': [options: { 
    deleteContent: boolean; 
    selectedLocations: string[];
  }];
  'cancel': [];
}>();

// Local state
const deleteContent = ref(false);
const selectedLocations = ref<string[]>([]);
const selectAll = ref(false);
const acknowledgeRisk = ref(false);
const acknowledgedLocations = ref<Set<string>>(new Set());

// Reset state when dialog opens
watch(() => props.modelValue, (isOpen) => {
  if (isOpen) {
    deleteContent.value = false;
    selectedLocations.value = [];
    selectAll.value = false;
    acknowledgeRisk.value = false;
    acknowledgedLocations.value = new Set();
    
    // Auto-select current page
    if (props.currentPageId && props.usageInfo) {
      const currentLocation = props.usageInfo.locations.find(
        loc => loc.id === props.currentPageId
      );
      if (currentLocation) {
        selectedLocations.value.push(`${currentLocation.collection}:${currentLocation.id}`);
      }
    }
  }
});

// Computed properties
const allAcknowledged = computed(() => {
  if (!props.usageInfo?.locations) return false;
  
  const nonCurrentLocations = props.usageInfo.locations.filter(loc => loc.id !== props.currentPageId);
  if (nonCurrentLocations.length === 0) return false;
  
  return nonCurrentLocations.every((location) => {
    const fullIndex = props.usageInfo!.locations.indexOf(location);
    return acknowledgedLocations.value.has(getLocationKey(location, fullIndex));
  });
});

const canProceed = computed(() => {
  if (!props.usageInfo) return false;
  if (props.loading) return false;
  
  // If usage couldn't be verified and user wants to delete permanently,
  // they must acknowledge the risk
  if (props.usageInfo.hasUncheckedUsage && deleteContent.value) {
    return acknowledgeRisk.value;
  }
  
  // If there are external usages and user wants to delete permanently,
  // all locations must be acknowledged
  if (!props.usageInfo.canDelete && deleteContent.value) {
    return allAcknowledged.value;
  }
  
  // Can proceed if no usage or only current page
  if (props.usageInfo.canDelete) return true;
  
  // Can proceed with unassign (not delete)
  if (!deleteContent.value) return true;
  
  return false;
});

const confirmButtonText = computed(() => {
  if (!props.usageInfo) return 'Confirm';
  
  if (deleteContent.value) {
    // Show special text when deleting with unchecked usage
    if (props.usageInfo.hasUncheckedUsage) {
      return 'Delete at Own Risk';
    }
    // Show special text when forced deletion with acknowledged locations
    if (!props.usageInfo.canDelete && allAcknowledged.value) {
      return 'Force Delete';
    }
    return 'Delete Permanently';
  }
  
  return 'Unassign';
});

// Methods
function getLocationKey(location: any, index: number): string {
  // Use junction_id if available for uniqueness, otherwise fall back to index
  if (location.junction_id) {
    return `${location.collection}:${location.id}:${location.junction_id}`;
  }
  // Fallback to index-based key if no junction_id
  return `${location.collection}:${location.id}:${index}`;
}

function toggleLocationAcknowledgment(locationKey: string) {
  const newSet = new Set(acknowledgedLocations.value);
  if (newSet.has(locationKey)) {
    newSet.delete(locationKey);
  } else {
    newSet.add(locationKey);
  }
  acknowledgedLocations.value = newSet;
}

// Removed acknowledgeAll function - users must manually check each item

function getStatusLabel(status: string): string {
  const statusLabels: Record<string, string> = {
    'published': 'Published',
    'draft': 'Draft',
    'archived': 'Archived'
  };
  return statusLabels[status] || status;
}

// Removed unused function toggleSelectAll - was for multi-location selection feature

function getCollectionIcon(collection: string): string {
  // Map collection names to icons
  const iconMap: Record<string, string> = {
    'pages': 'article',
    'posts': 'post_add',
    'products': 'inventory_2',
    'content_text': 'text_fields',
    'content_image': 'image',
    'content_video': 'videocam',
    // Add more mappings as needed
  };
  
  return iconMap[collection] || 'folder';
}

function handleCancel() {
  emit('cancel');
  emit('update:modelValue', false);
}

function handleConfirm() {
  emit('confirm', {
    deleteContent: deleteContent.value,
    selectedLocations: selectedLocations.value
  });
}
</script>

<style scoped lang="scss">
/* Dialog Content Scrolling */
:deep(.v-card) {
  max-height: 90vh;
  display: flex;
  flex-direction: column;
}

:deep(.v-card-title) {
  flex-shrink: 0;
}

:deep(.v-card-text) {
  flex: 1;
  overflow-y: auto;
  max-height: calc(90vh - 200px); /* Account for header and footer */
}

:deep(.v-card-actions) {
  flex-shrink: 0;
  border-top: 1px solid var(--theme--border-color-subdued);
}

.loading-container {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 16px;
  padding: 40px;
  color: var(--theme--foreground-subdued);
}

/* Custom Block Display Styles */
.block-display {
  margin: 20px 0;
  background: var(--background-normal-alt);
  border: 2px solid var(--theme--border-color);
  border-radius: var(--theme--border-radius);
  overflow: hidden;
}

.block-display-header {
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 12px 16px;
  background: var(--theme--background-subdued);
}

.block-icon-wrapper {
  position: relative;
  display: inline-flex;
  align-items: center;
  flex-shrink: 0;
}

.block-icon {
  color: var(--theme--foreground);
  font-size: 20px;
}

.status-indicator {
  position: absolute;
  top: -4px;
  right: -4px;
  width: 8px;
  height: 8px;
  border-radius: 50%;
  border: 2px solid var(--theme--background);
}

.status-indicator.deleted {
  background: var(--danger);
  box-shadow: 0 0 0 1px var(--danger);
}

.block-display-info {
  flex: 1;
  display: flex;
  align-items: center;
  gap: 12px;
  min-width: 0;
}

.block-display-main {
  display: flex;
  align-items: center;
  gap: 12px;
  flex: 1;
  min-width: 0;
}

.block-display-title {
  font-weight: 600;
  font-size: 14px;
  color: var(--theme--foreground);
  line-height: 1.4;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.block-display-title.deleted {
  color: var(--theme--foreground-subdued);
  text-decoration: line-through;
  opacity: 0.7;
}

.block-collection-chip {
  font-size: 11px !important;
  flex-shrink: 0;
}

/* Status Display */
.block-status-display {
  display: flex;
  align-items: center;
  gap: 6px;
  padding: 2px 8px;
  border-radius: var(--theme--border-radius);
  font-size: 12px;
  margin-left: auto;
}

.status-dot {
  width: 8px;
  height: 8px;
  border-radius: 50%;
  background: var(--theme--foreground-subdued);
  flex-shrink: 0;
}

.status-dot.status-published {
  background: var(--primary);
}

.status-dot.status-draft {
  background: var(--theme--foreground);
}

.status-dot.status-archived {
  background: var(--warning);
}

.status-text {
  color: var(--theme--foreground-subdued);
  text-transform: capitalize;
  font-size: 12px;
}

.v-divider {
  margin: 20px 0;
}

.usage-summary {
  display: flex;
  align-items: center;
  gap: 8px;
  margin: 16px 0 8px 0;
}

.usage-summary strong {
  font-size: 13px;
  font-weight: 600;
  color: var(--theme--foreground-subdued);
  text-transform: uppercase;
}

.usage-summary .v-icon {
  color: var(--theme--foreground-subdued);
}


.location-list-with-checks {
  max-height: 400px; /* Increased from 300px for better visibility */
  overflow-y: auto;
  overflow-x: hidden;
  border: 2px solid var(--danger-25);
  border-radius: var(--theme--border-radius);
  background: var(--theme--background-normal);
  scroll-behavior: smooth;
}

/* Custom scrollbar styling for better UX */
.location-list-with-checks::-webkit-scrollbar {
  width: 8px;
}

.location-list-with-checks::-webkit-scrollbar-track {
  background: var(--theme--background-subdued);
  border-radius: var(--theme--border-radius);
}

.location-list-with-checks::-webkit-scrollbar-thumb {
  background: var(--theme--border-color);
  border-radius: var(--theme--border-radius);
}

.location-list-with-checks::-webkit-scrollbar-thumb:hover {
  background: var(--theme--border-color-accent);
}

.location-item-with-check {
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 12px 16px;
  border-bottom: 1px solid var(--theme--border-color-subdued);
  transition: all 0.2s;
}

.location-item-with-check:last-of-type {
  border-bottom: none;
}

.location-item-with-check:hover {
  background: var(--background-highlight);
}

.location-item-with-check.current-page {
  opacity: 0.7;
}

.location-item-with-check.acknowledged .location-title {
  text-decoration: line-through;
  opacity: 0.7;
  color: var(--theme--foreground-subdued);
}

.location-checkbox {
  width: 18px;
  height: 18px;
  cursor: pointer;
  flex-shrink: 0;
}

.checkbox-spacer {
  width: 18px;
  height: 18px;
  flex-shrink: 0;
}

/* Removed .acknowledge-all styles - button was removed */

.location-icon {
  color: var(--theme--foreground-subdued);
}

.location-info {
  display: flex;
  align-items: center;
  gap: 8px;
  flex: 1;
}

.location-title {
  font-size: 13px;
}

.location-link {
  display: inline-flex;
  align-items: center;
  padding: 2px;
  color: var(--primary);
  text-decoration: none;
  transition: opacity 0.2s;
}

.location-link:hover {
  opacity: 0.7;
}

.deletion-options {
  margin-top: 20px;
}

.deletion-options h4 {
  margin: 16px 0 12px 0;
  font-size: 13px;
  font-weight: 600;
  text-transform: uppercase;
  color: var(--theme--foreground-subdued);
}

.action-options {
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.action-option {
  display: flex;
  align-items: flex-start;
  padding: 12px;
  border: 2px solid var(--theme--border-color);
  border-radius: var(--theme--border-radius);
  cursor: pointer;
  transition: all 0.2s;
  background: var(--theme--background);
}

.action-option:hover {
  border-color: var(--primary);
  background: var(--theme--background-normal);
}

.action-option.selected {
  border-color: var(--primary);
  background: var(--primary-10);
}

.action-option input[type="radio"] {
  margin-right: 12px;
  margin-top: 4px;
}

.option-content {
  display: flex;
  align-items: flex-start;
  gap: 12px;
  flex: 1;
}

.option-content .v-icon {
  margin-top: 2px;
}

.option-content strong {
  display: block;
  margin-bottom: 4px;
}

.option-content p {
  margin: 0;
  font-size: 12px;
  color: var(--theme--foreground-subdued);
}

.v-notice {
  margin: 20px 0;
}

.v-notice p {
  margin-top: 8px;
  margin-bottom: 0;
  font-size: 13px;
}

.risk-acknowledgment-section {
  margin-top: 12px;
}

.risk-checkbox {
  display: flex;
  align-items: flex-start;
  gap: 12px;
  padding: 12px;
  margin-top: 12px;
  background: var(--warning-10);
  border: 2px solid var(--warning-25);
  border-radius: var(--theme--border-radius);
  cursor: pointer;
  transition: all 0.2s;
}

.risk-checkbox:hover {
  background: color-mix(in srgb, transparent, var(--theme--warning) 15%);
  border-color: var(--warning);
}

.risk-checkbox input[type="checkbox"] {
  margin-top: 2px;
  cursor: pointer;
}

.risk-checkbox span {
  flex: 1;
  font-size: 14px;
  font-weight: 500;
  color: var(--warning);
}

.acknowledgment-warning {
  margin-top: 12px;
}

.acknowledgment-warning .v-notice {
  margin: 0;
}
</style>