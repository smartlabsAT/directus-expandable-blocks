<template>
  <v-menu
      v-model="isOpen"
      :show-arrow="false"
      placement="bottom"
      :close-on-content-click="false"
  >
    <template #activator="{ toggle }">
      <span ref="activatorEl" @click="toggle" style="display: none;" />
    </template>
    
    <div class="column-width-popover">
      <v-slider
          v-model="relativeWidth"
          :min="-50"
          :max="100"
          :step="5"
          :thumb-label="true"
          @update:model-value="updateWidth"
          class="width-slider"
      />
    </div>
  </v-menu>
</template>

<script setup lang="ts">
import { ref, watch, onMounted } from 'vue';
import { createScopedLogger } from '../utils/logger-wrapper';
import { getDefaultFieldWidth, getFieldTypeFromInfo } from '../utils/column-width-helpers';

const logger = createScopedLogger('ColumnWidthPopover');

interface Props {
  modelValue: boolean;
  field: string;
  fieldInfo: any;
  currentWidth?: number;
  anchor?: HTMLElement | null;
}

const props = withDefaults(defineProps<Props>(), {
  currentWidth: 0
});

const emit = defineEmits<{
  'update:modelValue': [value: boolean];
  'update-width': [relativeWidth: number];
}>();

// Local state
const isOpen = ref(false);
const relativeWidth = ref(props.currentWidth || 0);
const activatorEl = ref<HTMLElement>();

// Watch for prop changes
watch(() => props.modelValue, (newVal) => {
  logger.log('modelValue changed', { newVal, field: props.field });
  isOpen.value = newVal;
  if (newVal) {
    // Reset to current width when opening
    relativeWidth.value = props.currentWidth || 0;
  }
});

// Watch for currentWidth changes
watch(() => props.currentWidth, (newVal) => {
  logger.log('currentWidth changed', { newVal, field: props.field });
  relativeWidth.value = newVal || 0;
});

watch(isOpen, (newVal) => {
  logger.log('isOpen changed', { newVal, field: props.field });
  emit('update:modelValue', newVal);
});

// Position activator at anchor and trigger click
onMounted(() => {
  logger.log('ColumnWidthPopover mounted', {
    hasAnchor: !!props.anchor,
    field: props.field,
    modelValue: props.modelValue
  });
  
  if (props.anchor && activatorEl.value) {
    // Move activator to anchor position
    const rect = props.anchor.getBoundingClientRect();
    activatorEl.value.style.position = 'fixed';
    activatorEl.value.style.left = `${rect.left + rect.width / 2}px`;
    activatorEl.value.style.top = `${rect.bottom}px`;
    activatorEl.value.style.display = 'block';
    
    // Trigger click to open menu
    setTimeout(() => {
      activatorEl.value?.click();
      logger.log('Triggered activator click');
    }, 50);
  }
});

// Methods
function updateWidth(value: number) {
  emit('update-width', value);
  
  logger.log('Width updated', {
    field: props.field,
    relativeWidth: value,
    fieldType: getFieldTypeFromInfo(props.fieldInfo),
    defaultWidth: getDefaultFieldWidth(getFieldTypeFromInfo(props.fieldInfo))
  });
}
</script>

<style scoped lang="scss">
.column-width-popover {
  padding: 14px 13px 5px;
  min-width: 180px;
  background: var(--theme--background);
  border-radius: var(--theme--border-radius);
  position: relative;
  z-index: 9999;
}

.width-slider {
  margin: 0;
  width: 100%;
}

/* Ensure slider is interactive */
.width-slider :deep(.v-slider) {
  pointer-events: auto !important;
  z-index: 1;
}

/* Center tick mark for default position */
.width-slider :deep(.v-slider-track-container) {
  position: relative;
  
  &::after {
    content: '';
    position: absolute;
    top: 50%;
    left: 50%;
    transform: translate(-50%, -50%);
    width: 2px;
    height: 12px;
    background: var(--theme--border-color);
    z-index: 1;
  }
}
</style>