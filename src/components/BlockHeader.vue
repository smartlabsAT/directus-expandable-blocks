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
      <span class="block-title">{{ title }}</span>
      <v-chip x-small outline class="collection-chip">
        {{ collectionName }}
      </v-chip>
      <span v-if="showItemId && !isNew" class="item-id">
        ID: {{ itemId }}
      </span>
    </div>

    <!-- Status Display -->
    <slot name="status" />
  </div>

  <!-- Right Section -->
  <div class="block-actions">
    <!-- Expand/Collapse Icon or Placeholder -->
    <div class="expand-icon-container">
      <v-icon
        v-if="isExpanded"
        name="unfold_less"
        class="expand-indicator"
        @click.stop="$emit('toggle-expand')"
      />
    </div>

    <!-- More Options Menu -->
    <slot name="actions" />
  </div>
</template>

<script setup lang="ts">
interface Props {
  sortable: boolean;
  disabled: boolean;
  collectionIcon: string | null;
  isNew: boolean;
  isDirty: boolean;
  title: string;
  collectionName: string;
  showItemId: boolean;
  itemId: string | number;
  isExpanded: boolean;
}

defineProps<Props>();

defineEmits<{
  'toggle-expand': [];
}>();
</script>

<style lang="scss" scoped>
/* Styles are defined in interface.scss */
</style>