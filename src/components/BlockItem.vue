<template>
  <div
    class="block-item"
    :class="{
      expanded: isExpanded,
      compact: compactMode,
      disabled: disabled,
      'read-only': canUpdate === false,
      'no-permission': canRead === false,
      'deleted-item': isDeleted
    }"
  >
    <!-- Block Header -->
    <div
      class="block-header"
      :class="{ 'no-permission': canRead === false }"
      @click="!disabled && canRead !== false && $emit('toggle-expand')"
    >
      <slot name="header" />
    </div>

    <!-- Inline Form (Expanded Content) -->
    <transition name="expand">
      <div v-if="isExpanded" class="block-content">
        <div v-if="loading" class="loading-state">
          <v-progress-circular indeterminate />
        </div>

        <template v-else>
          <!-- No Read Permission Notice -->
          <v-notice
            v-if="canRead === false"
            type="danger"
            icon="block"
            class="no-permission-notice"
          >
            No permission: You don't have access to view this collection
          </v-notice>

          <template v-else>
            <!-- Deleted Item Notice -->
            <v-notice
              v-if="isDeleted"
              type="danger"
              icon="delete"
              class="deleted-notice"
            >
              This item has been deleted. You can only unlink it from this list.
            </v-notice>

            <!-- Usage Warning -->
            <v-notice
              v-else-if="usageData && usageData.usageCount > 0"
              type="warning"
              icon="warning"
              class="usage-warning"
            >
              <div>
                <template v-if="usageData.externalCount > 0 && usageData.internalCount > 0">
                  Used in {{ usageData.externalCount }} other {{ usageData.externalCount === 1 ? 'place' : 'places' }}
                  and {{ usageData.internalCount }} more {{ usageData.internalCount === 1 ? 'time' : 'times' }} in this page
                </template>
                <template v-else-if="usageData.externalCount > 0">
                  Used in {{ usageData.externalCount }} other {{ usageData.externalCount === 1 ? 'place' : 'places' }}
                </template>
                <template v-else>
                  Used {{ usageData.internalCount }} more {{ usageData.internalCount === 1 ? 'time' : 'times' }} in this page
                </template>
                - changes will affect all references
              </div>
            </v-notice>

            <!-- Read-only Notice -->
            <v-notice
              v-if="canUpdate === false"
              type="info"
              icon="visibility"
              class="read-only-notice"
            >
              Read-only: You don't have permission to update this collection
            </v-notice>

            <v-form
              v-if="!isDeleted"
              :initial-values="itemData"
              :fields="fields"
              :model-value="itemData"
              :primary-key="itemData.id"
              :disabled="disabled || canUpdate === false"
              :badge="null"
              :autofocus="false"
              :show-validation-errors="false"
              @update:model-value="$emit('update-item', $event)"
            />
          </template>
        </template>

        <!-- Show nested M2A blocks if present -->
        <slot name="nested-blocks" />
      </div>
    </transition>
  </div>
</template>

<script setup lang="ts">
import { computed } from 'vue';
import type { JunctionRecord } from '../types';

interface Props {
  item: JunctionRecord;
  isExpanded: boolean;
  loading: boolean;
  fields: Array<{
    field: string;
    name?: string;
    type?: string;
    meta?: Record<string, unknown>;
    schema?: Record<string, unknown>;
  }>;
  disabled: boolean;
  compactMode?: boolean;
  canRead?: boolean;
  canUpdate?: boolean;
  isDeleted?: boolean;
  usageData?: {
    usageCount: number;
    externalCount: number;
    internalCount: number;
    usageLocations?: Array<{
      collection: string;
      id: string | number;
      field?: string;
      title?: string;
    }>;
    usageSummary?: Record<string, unknown>;
  } | null;
}

const props = defineProps<Props>();

const itemData = computed(() => props.item.item || props.item);

defineEmits<{
  'toggle-expand': [];
  'update-item': [newData: Record<string, unknown>];
}>();
</script>

<style scoped>
.usage-warning {
  margin-bottom: 20px;
}

.read-only-notice {
  margin-bottom: 20px;
}

.no-permission-notice {
  margin-bottom: 20px;
}

.deleted-notice {
  margin-bottom: 20px;
}

.block-header.no-permission {
  cursor: not-allowed;
  opacity: 0.7;
}

.deleted-item {
  opacity: 0.6;
  
  .block-header {
    background: var(--background-normal-alt) !important;
  }
}
</style>

