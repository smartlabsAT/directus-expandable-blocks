<template>
  <v-drawer
    :model-value="modelValue"
    :title="drawerTitle"
    :icon="collectionIcon"
    @update:model-value="handleClose"
    @cancel="handleCancel"
  >
    <!-- Subtitle Slot -->
    <template #subtitle>
      <v-breadcrumb 
        v-if="collectionInfo" 
        :items="[{ name: collectionInfo.name || collectionInfo.collection || props.collection, disabled: true }]" 
      />
    </template>

    <!-- Title Icon -->
    <template #title-outer:prepend>
      <v-button class="header-icon" rounded icon secondary disabled>
        <v-icon :name="collectionIcon" />
      </v-button>
    </template>

    <!-- Actions Slot -->
    <template #actions>
      <v-button
        v-tooltip.bottom="'Save'"
        icon
        rounded
        :loading="saving"
        :disabled="!hasEdits || saving"
        @click="handleSave"
      >
        <v-icon name="check" />
      </v-button>
    </template>

    <!-- Main Content -->
    <div class="drawer-content">
      <!-- Loading State -->
      <v-progress-circular v-if="loading" indeterminate />

      <!-- Error State -->
      <v-notice v-else-if="error" type="danger" icon="error">
        {{ error }}
      </v-notice>

      <!-- Form -->
      <v-form
        v-else-if="item && fields"
        v-model="edits"
        :fields="fields"
        :loading="loading"
        :initial-values="item"
        :primary-key="primaryKey"
        :validation-errors="validationErrors"
      />
    </div>
  </v-drawer>

  <!-- Unsaved Changes Dialog -->
  <v-dialog v-model="confirmDialog" @esc="confirmDialog = false">
    <v-sheet>
      <v-notice type="warning" icon="warning">
        You have unsaved changes
      </v-notice>
      
      <div class="dialog-content">
        <p>Are you sure you want to close without saving your changes?</p>
      </div>
      
      <div class="dialog-actions">
        <v-button secondary @click="confirmDialog = false">
          Cancel
        </v-button>
        <v-button kind="danger" @click="forceClose">
          Discard Changes
        </v-button>
      </div>
    </v-sheet>
  </v-dialog>
</template>

<script setup lang="ts">
import { ref, computed, watch } from 'vue';
import { useApi, useStores } from '@directus/extensions-sdk';
import { createScopedLogger } from '../utils/logger-wrapper';
import { notifyError, notifySuccess } from '../utils/notifications';
import { createApiClient } from '../services/api-client';
import type { IDirectusApiClient } from '../services/api-client.types';

const logger = createScopedLogger('ItemEditDrawer');

interface Props {
  modelValue: boolean;
  collection: string;
  primaryKey: string | number;
  circular?: boolean;
}

const props = defineProps<Props>();
const emit = defineEmits<{
  'update:model-value': [value: boolean];
  'refresh': [];
}>();

// Stores
const api = useApi();
const { useFieldsStore, useCollectionsStore } = useStores();
const fieldsStore = useFieldsStore();
const collectionsStore = useCollectionsStore();

// Create API client instance
const apiClient: IDirectusApiClient = createApiClient(api);

// State
const loading = ref(false);
const saving = ref(false);
const error = ref<string | null>(null);
const item = ref<Record<string, any> | null>(null);
const edits = ref<Record<string, any>>({});
const validationErrors = ref<any[]>([]);
const confirmDialog = ref(false);

// Collection info
const collectionInfo = computed(() => {
  if (!props.collection) return null;
  return collectionsStore.getCollection(props.collection);
});
const collectionIcon = computed(() => collectionInfo.value?.icon || 'box');

// Computed
const drawerTitle = computed(() => {
  if (!item.value || !collectionInfo.value) return 'Edit Item';
  
  // Try to get display template
  const displayTemplate = collectionInfo.value.meta?.display_template;
  if (displayTemplate) {
    // Simple template replacement (you might want to use Directus' template renderer)
    return displayTemplate.replace(/{{(\w+)}}/g, (match: string, field: string) => {
      return item.value?.[field] || '';
    });
  }
  
  // Fallback to primary key
  return `Edit Item #${props.primaryKey}`;
});

const hasEdits = computed(() => {
  return Object.keys(edits.value).length > 0;
});

const fields = computed(() => {
  if (!props.collection) return [];
  
  const allFields = fieldsStore.getFieldsForCollection(props.collection);
  
  // Filter fields based on visibility
  return allFields.filter((field: any) => {
    // Skip system fields
    if (field.meta?.system) return false;
    
    // Skip hidden fields
    if (field.meta?.hidden) return false;
    
    return true;
  });
});

// Methods
async function loadItem() {
  if (!props.collection || !props.primaryKey) return;
  
  loading.value = true;
  error.value = null;
  
  try {
    logger.debug('Loading item', { collection: props.collection, primaryKey: props.primaryKey });
    
    item.value = await apiClient.loadItemWithRelations(
      props.collection,
      props.primaryKey,
      ['*']
    );
    logger.debug('Item loaded', { item: item.value });
  } catch (err: any) {
    logger.error('Failed to load item', err);
    error.value = err.message || 'Failed to load item';
  } finally {
    loading.value = false;
  }
}

async function handleSave() {
  if (!props.collection || !props.primaryKey || !hasEdits.value) return;
  
  saving.value = true;
  validationErrors.value = [];
  
  try {
    logger.debug('Saving item', { collection: props.collection, primaryKey: props.primaryKey, edits: edits.value });
    
    await apiClient.updateItem(props.collection, props.primaryKey, edits.value);
    
    notifySuccess('Item updated successfully');
    emit('refresh');
    
    // Reset edits before closing to avoid unsaved changes warning
    edits.value = {};
    emit('update:model-value', false);
  } catch (err: any) {
    logger.error('Failed to save item', err);
    
    if (err.response?.data?.errors) {
      validationErrors.value = err.response.data.errors;
    }
    
    notifyError(err.message || 'Failed to save item');
  } finally {
    saving.value = false;
  }
}

function handleClose() {
  if (hasEdits.value) {
    // Show confirmation dialog
    confirmDialog.value = true;
  } else {
    emit('update:model-value', false);
  }
}

function forceClose() {
  confirmDialog.value = false;
  emit('update:model-value', false);
}

function handleCancel() {
  handleClose();
}

// Reset when drawer closes
watch(() => props.modelValue, (isOpen) => {
  if (!isOpen) {
    item.value = null;
    edits.value = {};
    error.value = null;
    validationErrors.value = [];
  }
});

// Load item when drawer opens or primary key changes
watch(
  () => [props.modelValue, props.primaryKey, props.collection],
  ([isOpen]) => {
    if (isOpen && props.collection && props.primaryKey) {
      loadItem();
    }
  },
  { immediate: true }
);
</script>

<style scoped>
.drawer-content {
  padding: var(--content-padding);
  padding-top: 0;
}

.header-icon {
  --v-button-background-color: var(--primary-10);
  --v-button-color: var(--primary);
  --v-button-background-color-hover: var(--primary-25);
  --v-button-color-hover: var(--primary);
}

.v-progress-circular {
  margin: 48px auto;
  display: block;
}

.dialog-content {
  padding: var(--content-padding);
  text-align: center;
  color: var(--foreground-normal);
}

.dialog-actions {
  display: flex;
  gap: 12px;
  justify-content: center;
  padding: var(--content-padding);
  padding-top: 0;
}
</style>