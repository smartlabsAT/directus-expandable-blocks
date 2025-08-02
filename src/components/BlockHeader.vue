<template>
  <!-- Drag Handle -->
  <v-icon
    v-if="sortable && !disabled"
    name="drag_indicator"
    class="drag-handle"
    @click.stop
  />

  <!-- Collection Icon with Dirty/New Indicator -->
  <div class="icon-wrapper">
    <v-icon
      :name="collectionIcon || 'box'"
      class="collection-icon"
    />
    <div
      v-if="isNew"
      class="new-indicator"
      v-tooltip="'New block'"
    />
    <div
      v-else-if="isDirty"
      class="dirty-indicator"
      v-tooltip="'Unsaved changes'"
    />
  </div>

  <!-- Main Info Section -->
  <div class="block-info">
    <div class="block-main">
      <span class="block-title">
        <template v-if="canRead === false">
          <v-icon name="block" x-small /> No permission
        </template>
        <template v-else>{{ title }}</template>
      </span>

      <span v-if="showItemId && !isNew && canRead !== false" class="item-id">
        ID: {{ itemId }}
      </span>
    </div>

    <v-chip v-if="showCollectionName" x-small outline class="collection-chip">
      {{ collectionName }}
    </v-chip>
    <!-- Usage Indicator or Placeholder -->
    <v-chip
      v-if="canRead === false"
      x-small
      class="usage-indicator usage-placeholder-chip"
      disabled
    >
      <v-icon name="link" x-small />
      —
    </v-chip>
    <v-chip
      v-else-if="usageCount && usageCount > 0"
      x-small
      class="usage-indicator"
      v-tooltip="usageTooltip"
    >
      <v-icon name="link" x-small />
      {{ usageCount }}
    </v-chip>
    <div
      v-else-if="hasAnyUsageIndicator"
      class="usage-placeholder"
    />

    <!-- Status Display -->
    <slot name="status" />
  </div>

  <!-- Expand/Collapse Icon or Placeholder -->

  <!-- Right Section -->
  <div class="block-actions">



    <!-- More Options Menu -->
    <slot name="actions" />
    <div class="expand-icon-container">
      <v-icon
          v-if="isExpanded"
          name="unfold_less"
          class="expand-indicator"
          @click.stop="$emit('toggle-expand')"
      />
    </div>
  </div>


</template>

<script setup lang="ts">
import { computed } from 'vue';

interface Props {
  sortable: boolean;
  disabled: boolean;
  collectionIcon: string | null;
  isNew: boolean;
  isDirty: boolean;
  title: string;
  collectionName: string;
  showItemId: boolean;
  showCollectionName: boolean;
  itemId: string | number;
  isExpanded: boolean;
  usageCount?: number;
  usageData?: {
    usageCount: number;
    externalCount: number;
    internalCount: number;
  };
  hasAnyUsageIndicator?: boolean;
  canRead?: boolean;
}

const props = defineProps<Props>();

defineEmits<{
  'toggle-expand': [];
}>();

const usageTooltip = computed(() => {
  if (!props.usageData || typeof props.usageData !== 'object') {
    return props.usageCount ? `This item is used in ${props.usageCount} ${props.usageCount === 1 ? 'place' : 'places'}` : '';
  }
  
  const externalCount = props.usageData?.externalCount || 0;
  const internalCount = props.usageData?.internalCount || 0;
  
  if (externalCount > 0 && internalCount > 0) {
    return `Used in ${externalCount} other ${externalCount === 1 ? 'place' : 'places'} and ${internalCount} more ${internalCount === 1 ? 'time' : 'times'} in this page`;
  } else if (externalCount > 0) {
    return `Used in ${externalCount} other ${externalCount === 1 ? 'place' : 'places'}`;
  } else {
    return `Used ${internalCount} more ${internalCount === 1 ? 'time' : 'times'} in this page`;
  }
});
</script>

<style scoped>
.usage-indicator {
  background-color: var(--warning-10);
  color: var(--warning);
  border-color: var(--warning-25);
  margin-left: 8px;
  
  :deep(.v-icon) {
    margin-right: 4px;
    color: var(--warning);
  }
}

.usage-placeholder {
  display: inline-block;
  width: 45px; /* Adjust based on typical usage indicator width */
  height: 24px; /* Same height as v-chip x-small */
  margin-left: 0px;
}

.usage-placeholder-chip {
  opacity: 0.5;
  
  :deep(.v-icon) {
    opacity: 0.7;
  }
}
</style>