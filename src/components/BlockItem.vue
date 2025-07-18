<template>
  <div
    class="block-item"
    :class="{
      expanded: isExpanded,
      compact: compactMode,
      disabled: disabled
    }"
  >
    <!-- Block Header -->
    <div
      class="block-header"
      @click="!disabled && $emit('toggle-expand')"
    >
      <slot name="header" />
    </div>

    <!-- Inline Form (Expanded Content) -->
    <transition name="expand">
      <div v-if="isExpanded" class="block-content">
        <div v-if="loading" class="loading-state">
          <v-progress-circular indeterminate />
        </div>

        <v-form
          v-else
          :initial-values="itemData"
          :fields="fields"
          :model-value="itemData"
          :primary-key="itemData.id"
          :disabled="disabled"
          :badge="null"
          :autofocus="false"
          :show-validation-errors="false"
          @update:model-value="$emit('update-item', $event)"
        />

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
  fields: any[];
  disabled: boolean;
  compactMode?: boolean;
}

const props = defineProps<Props>();

const itemData = computed(() => props.item.item || props.item);

defineEmits<{
  'toggle-expand': [];
  'update-item': [newData: any];
}>();
</script>

