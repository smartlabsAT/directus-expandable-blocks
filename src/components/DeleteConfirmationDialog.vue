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
            <strong>Cannot verify item usage</strong>
            <p>This item might be used in other locations. Deleting it could break references elsewhere in your content.</p>
            <p style="margin-top: 8px;">For safe deletion with usage checking, please install the <code>expandable-blocks-api</code> extension.</p>
          </v-notice>

          <!-- Multiple Usage Warning -->
          <v-notice
            v-else-if="!(usageInfo.totalCount === 0 || (usageInfo.totalCount === 1 && usageInfo.currentPageUsage))"
            type="warning"
            icon="warning"
          >
            This item cannot be permanently deleted because it is used in {{ usageInfo.totalCount - (usageInfo.currentPageUsage ? 1 : 0) }} other {{ (usageInfo.totalCount - (usageInfo.currentPageUsage ? 1 : 0)) === 1 ? 'location' : 'locations' }}. You can only unassign it from this page.
          </v-notice>

          <!-- Usage Details - only show when item is used in multiple places or other locations -->
          <div v-if="usageInfo.locations && usageInfo.locations.length > 0 && !(usageInfo.totalCount === 1 && usageInfo.currentPageUsage)">
            <div class="usage-summary">
              <v-icon name="link" small />
              <strong>Used in {{ usageInfo.totalCount }} {{ usageInfo.totalCount === 1 ? 'location' : 'locations' }}:</strong>
            </div>

            <!-- Usage locations always visible with links -->
            <div class="location-list">
              <div
                v-for="location in usageInfo.locations"
                :key="`${location.collection}-${location.id}`"
                class="location-item"
                :class="{ 'current-page': location.id === currentPageId }"
              >
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

          <!-- Deletion Options -->
          <div v-if="usageInfo.canDelete || usageInfo.hasUncheckedUsage" class="deletion-options">
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

// Reset state when dialog opens
watch(() => props.modelValue, (isOpen) => {
  if (isOpen) {
    deleteContent.value = false;
    selectedLocations.value = [];
    selectAll.value = false;
    acknowledgeRisk.value = false;
    
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
const canProceed = computed(() => {
  if (!props.usageInfo) return false;
  if (props.loading) return false;
  
  // If usage couldn't be verified and user wants to delete permanently,
  // they must acknowledge the risk
  if (props.usageInfo.hasUncheckedUsage && deleteContent.value) {
    return acknowledgeRisk.value;
  }
  
  // Can proceed if no usage or only current page
  if (props.usageInfo.canDelete) return true;
  
  // Can proceed if force delete is allowed and locations are selected
  if (props.allowForceDelete && selectedLocations.value.length > 0) {
    return true;
  }
  
  return false;
});

const confirmButtonText = computed(() => {
  if (!props.usageInfo) return 'Confirm';
  
  if (deleteContent.value) {
    // Show special text when deleting with unchecked usage
    if (props.usageInfo.hasUncheckedUsage) {
      return 'Delete at Own Risk';
    }
    return 'Delete Permanently';
  }
  
  return 'Unassign';
});

// Methods
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

<style scoped>
.loading-container {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 16px;
  padding: 40px;
  color: var(--foreground-subdued);
}

/* Custom Block Display Styles */
.block-display {
  margin: 20px 0;
  background: var(--background-normal-alt);
  border: 2px solid var(--border-normal);
  border-radius: var(--border-radius);
  overflow: hidden;
}

.block-display-header {
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 12px 16px;
  background: var(--background-subdued);
}

.block-icon-wrapper {
  position: relative;
  display: inline-flex;
  align-items: center;
  flex-shrink: 0;
}

.block-icon {
  color: var(--foreground-normal);
  font-size: 20px;
}

.status-indicator {
  position: absolute;
  top: -4px;
  right: -4px;
  width: 8px;
  height: 8px;
  border-radius: 50%;
  border: 2px solid var(--background-page);
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
  color: var(--foreground-normal);
  line-height: 1.4;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.block-display-title.deleted {
  color: var(--foreground-subdued);
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
  border-radius: var(--border-radius);
  font-size: 12px;
  margin-left: auto;
}

.status-dot {
  width: 8px;
  height: 8px;
  border-radius: 50%;
  background: var(--foreground-subdued);
  flex-shrink: 0;
}

.status-dot.status-published {
  background: var(--primary);
}

.status-dot.status-draft {
  background: var(--foreground-normal);
}

.status-dot.status-archived {
  background: var(--warning);
}

.status-text {
  color: var(--foreground-subdued);
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
  color: var(--foreground-subdued);
  text-transform: uppercase;
}

.usage-summary .v-icon {
  color: var(--foreground-subdued);
}


.location-list {
  max-height: 200px;
  overflow-y: auto;
  overflow-x: hidden;
  border: 1px solid var(--border-subdued);
  border-radius: var(--border-radius);
  background: var(--background-normal);
  scroll-behavior: smooth;
}

/* Custom scrollbar styling for better UX */
.location-list::-webkit-scrollbar {
  width: 8px;
}

.location-list::-webkit-scrollbar-track {
  background: var(--background-subdued);
  border-radius: var(--border-radius);
}

.location-list::-webkit-scrollbar-thumb {
  background: var(--border-normal);
  border-radius: var(--border-radius);
}

.location-list::-webkit-scrollbar-thumb:hover {
  background: var(--border-normal-alt);
}

.location-item {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 10px 12px;
  border-bottom: 1px solid var(--border-subdued);
  transition: background-color 0.2s;
}

.location-item:last-child {
  border-bottom: none;
}

.location-item:hover {
  background: var(--background-highlight);
}

.location-item.current-page {
  background: var(--primary-10);
}

.location-icon {
  color: var(--foreground-subdued);
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
  color: var(--foreground-subdued);
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
  border: 2px solid var(--border-normal);
  border-radius: var(--border-radius);
  cursor: pointer;
  transition: all 0.2s;
  background: var(--background-page);
}

.action-option:hover {
  border-color: var(--primary);
  background: var(--background-normal);
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
  color: var(--foreground-subdued);
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
  border-radius: var(--border-radius);
  cursor: pointer;
  transition: all 0.2s;
}

.risk-checkbox:hover {
  background: var(--warning-15);
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
</style>