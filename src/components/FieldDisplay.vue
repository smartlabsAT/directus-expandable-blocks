<template>
  <div class="field-display">
    <!-- Boolean Field -->
    <v-chip
        v-if="fieldType === 'boolean'"
        x-small
        :class="value ? 'boolean-true' : 'boolean-false'"
    >
      {{ value ? 'Yes' : 'No' }}
    </v-chip>

    <!-- Select Dropdown Field -->
    <v-chip
        v-else-if="isSelectDropdown && props.value"
        x-small
        class="select-chip"
    >
      <v-icon 
          v-if="selectedChoice?.icon" 
          :name="selectedChoice.icon" 
          x-small 
          class="choice-icon"
      />
      {{ selectedChoice?.text || props.value }}
    </v-chip>

    <!-- WYSIWYG Field -->
    <div v-else-if="isWysiwyg" class="wysiwyg-field">
      <span class="field-value">{{ strippedHtml }}</span>
      <v-menu 
          v-if="hasLongContent" 
          placement="bottom" 
          show-arrow
          :close-on-content-click="false"
      >
        <template #activator="{ toggle }">
          <v-button 
              x-small 
              icon 
              secondary
              @click="toggle"
              v-tooltip.top="'Show full content'"
              class="expand-button"
          >
            <v-icon name="expand_more" x-small />
          </v-button>
        </template>
        <div class="wysiwyg-popover">
          <div class="wysiwyg-content" v-html="sanitizedHtml"></div>
        </div>
      </v-menu>
    </div>

    <!-- Date/DateTime Field -->
    <span v-else-if="isDateField" class="field-value">
      {{ formatDate(value) }}
    </span>

    <!-- Image Field -->
    <div v-else-if="isImageField" class="image-field">
      <div 
          class="image-preview"
          v-tooltip.top="imageTooltipContent"
      >
        <img 
            :src="imageUrl" 
            :alt="field"
            @error="handleImageError"
        />
      </div>
    </div>

    <!-- JSON Field -->
    <div v-else-if="isJsonField" class="json-field">
      <v-chip x-small class="json-chip">
        JSON
      </v-chip>
      <v-menu 
          placement="bottom" 
          show-arrow
          :close-on-content-click="false"
      >
        <template #activator="{ toggle }">
          <v-button 
              x-small 
              icon 
              secondary
              @click="toggle"
              v-tooltip.top="'Show JSON content'"
              class="json-button"
          >
            <v-icon name="code" x-small />
          </v-button>
        </template>
        <div class="json-popover">
          <pre>{{ formattedJson }}</pre>
        </div>
      </v-menu>
    </div>

    <!-- Default Text Field -->
    <span
        v-else
        class="field-value"
        v-tooltip="displayValue.length > maxLength ? displayValue : null"
    >
      {{ truncatedValue }}
    </span>
  </div>
</template>

<script setup lang="ts">
import { computed } from 'vue';

interface Props {
  value: any;
  field: string;
  fieldInfo?: {
    field: string;
    name?: string;
    type: string;
    interface?: string;
    display?: string;
    options?: any;
  };
  maxLength?: number;
}

const props = withDefaults(defineProps<Props>(), {
  maxLength: 100
});

// Field type detection
const fieldType = computed(() => props.fieldInfo?.type || typeof props.value);
const fieldInterface = computed(() => props.fieldInfo?.interface);
const fieldDisplay = computed(() => props.fieldInfo?.display);

const isSelectDropdown = computed(() => 
  fieldInterface.value === 'select-dropdown'
);

const isWysiwyg = computed(() => 
  fieldInterface.value === 'input-rich-text-html' || 
  fieldInterface.value === 'input-rich-text-md' ||
  fieldDisplay.value === 'formatted-value'
);

const isDateField = computed(() => 
  fieldType.value === 'date' || 
  fieldType.value === 'dateTime' || 
  fieldType.value === 'timestamp'
);

const isJsonField = computed(() => 
  fieldType.value === 'json' || 
  (typeof props.value === 'object' && props.value !== null && !Array.isArray(props.value))
);

const isImageField = computed(() => 
  fieldInterface.value === 'file-image' || 
  fieldInterface.value === 'file' ||
  (fieldType.value === 'uuid' && props.field.includes('image')) ||
  (typeof props.value === 'string' && /\.(jpg|jpeg|png|gif|webp|svg)$/i.test(props.value))
);

// Value processing
const displayValue = computed(() => {
  if (props.value === null || props.value === undefined) return '';
  if (typeof props.value === 'object') return JSON.stringify(props.value);
  return String(props.value);
});

const truncatedValue = computed(() => {
  if (displayValue.value.length <= props.maxLength) return displayValue.value;
  return displayValue.value.substring(0, props.maxLength) + '...';
});

// Select dropdown choice
const selectedChoice = computed(() => {
  if (!isSelectDropdown.value) return null;
  
  // Check different locations for choices
  const choices = props.fieldInfo?.options?.choices;
  
  if (!choices) {
    return null;
  }
  
  if (Array.isArray(choices)) {
    // Handle array format [{ text: 'Label', value: 'value' }]
    const found = choices.find(choice => choice.value === props.value);
    return found || null;
  } else if (typeof choices === 'object') {
    // Handle object format { value: { text, icon } } or { value: 'Label' }
    const choice = choices[props.value];
    if (!choice) {
      return null;
    }
    if (typeof choice === 'string') {
      return { text: choice, value: props.value };
    }
    return choice;
  }
  
  return null;
});

// WYSIWYG processing
const strippedHtml = computed(() => {
  if (!isWysiwyg.value) return displayValue.value;
  
  // Strip HTML tags
  const tmp = document.createElement('div');
  tmp.innerHTML = displayValue.value;
  const text = tmp.textContent || tmp.innerText || '';
  
  // Truncate if needed
  if (text.length > props.maxLength) {
    return text.substring(0, props.maxLength) + '...';
  }
  return text;
});

const sanitizedHtml = computed(() => {
  if (!isWysiwyg.value) return '';
  // Basic HTML sanitization - in production, you might want to use DOMPurify
  return displayValue.value;
});

const hasLongContent = computed(() => {
  if (!isWysiwyg.value) return false;
  const tmp = document.createElement('div');
  tmp.innerHTML = displayValue.value;
  const text = tmp.textContent || tmp.innerText || '';
  return text.length > props.maxLength;
});

// JSON formatting
const formattedJson = computed(() => {
  if (!isJsonField.value) return '';
  try {
    return JSON.stringify(props.value, null, 2);
  } catch {
    return String(props.value);
  }
});

// Date formatting
function formatDate(value: any): string {
  if (!value) return '';
  
  try {
    const date = new Date(value);
    if (isNaN(date.getTime())) return String(value);
    
    // Format based on field type
    if (fieldType.value === 'date') {
      return date.toLocaleDateString();
    } else {
      return date.toLocaleString();
    }
  } catch {
    return String(value);
  }
}

// Image handling
const imageUrl = computed(() => {
  if (!props.value) return '';
  
  // If it's a UUID (Directus file), construct the URL
  if (fieldType.value === 'uuid' || /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(props.value)) {
    return `/assets/${props.value}?fit=cover&width=150&height=150&quality=80`;
  }
  
  // If it's already a URL
  if (typeof props.value === 'string' && (props.value.startsWith('http') || props.value.startsWith('/'))) {
    return props.value;
  }
  
  return '';
});

const getImageFilename = computed(() => {
  if (!props.value) return '';
  
  // Extract filename from URL or return the value
  if (typeof props.value === 'string') {
    const parts = props.value.split('/');
    return parts[parts.length - 1] || props.value;
  }
  
  return String(props.value);
});

const imageTooltipContent = computed(() => {
  if (!imageUrl.value) return '';
  
  return {
    content: `<img src="${imageUrl.value}" style="max-width: 300px; max-height: 300px;" />`,
    html: true,
    delay: 300
  };
});

function handleImageError(event: Event) {
  const img = event.target as HTMLImageElement;
  img.src = 'data:image/svg+xml,%3Csvg xmlns="http://www.w3.org/2000/svg" width="50" height="50" viewBox="0 0 24 24"%3E%3Cpath fill="%23999" d="M21 19V5c0-1.1-.9-2-2-2H5c-1.1 0-2 .9-2 2v14c0 1.1.9 2 2 2h14c1.1 0 2-.9 2-2zM8.5 13.5l2.5 3.01L14.5 12l4.5 6H5l3.5-4.5z"/%3E%3C/svg%3E';
}
</script>

<style scoped>
.field-display {
  display: inline-flex;
  align-items: center;
  gap: 8px;
}

.field-value {
  color: var(--foreground-normal);
}

/* Boolean chips */
.boolean-true {
  background-color: var(--success-25);
  color: var(--success);
}

.boolean-false {
  background-color: var(--danger-25);
  color: var(--danger);
}

/* Select chip */
.select-chip {
  background-color: var(--background-accent);
  display: inline-flex;
  align-items: center;
  gap: 4px;
}

.choice-icon {
  margin-right: 2px;
}

/* WYSIWYG field */
.wysiwyg-field {
  display: inline-flex;
  align-items: center;
  gap: 4px;
}

.expand-button {
  opacity: 0.7;
}

.expand-button:hover {
  opacity: 1;
}

.wysiwyg-popover {
  max-width: 500px;
  max-height: 400px;
  overflow: auto;
  padding: 16px;
  background: var(--background-page);
}

.wysiwyg-content {
  font-size: 14px;
  line-height: 1.6;
}

.wysiwyg-content :deep(p) {
  margin: 0 0 8px 0;
}

.wysiwyg-content :deep(p:last-child) {
  margin-bottom: 0;
}

/* JSON field */
.json-field {
  display: inline-flex;
  align-items: center;
  gap: 4px;
}

.json-chip {
  background-color: var(--primary-25);
  color: var(--primary);
  font-family: monospace;
  font-size: 10px;
}

.json-button {
  opacity: 0.7;
}

.json-button:hover {
  opacity: 1;
}

.json-popover {
  max-width: 600px;
  max-height: 400px;
  overflow: auto;
  padding: 16px;
  background: var(--background-page);
}

.json-popover pre {
  margin: 0;
  font-family: monospace;
  font-size: 12px;
  white-space: pre-wrap;
  word-break: break-word;
}

/* Image field */
.image-field {
  display: inline-flex;
  align-items: center;
}

.image-preview {
  width: 50px;
  height: 50px;
  border-radius: 4px;
  overflow: hidden;
  border: 1px solid var(--border-normal);
  cursor: pointer;
  transition: all 0.2s;
}

.image-preview:hover {
  border-color: var(--primary);
  box-shadow: 0 0 0 2px var(--primary-25);
}

.image-preview img {
  width: 100%;
  height: 100%;
  object-fit: cover;
}
</style>