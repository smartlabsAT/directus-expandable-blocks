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

    <!-- Tags Field -->
    <div v-else-if="isTagsField && props.value" class="tags-field">
      <v-chip
          v-for="(tag, index) in tagsArray"
          :key="index"
          x-small
          class="tag-chip"
      >
        {{ tag }}
      </v-chip>
    </div>

    <!-- Color Field -->
    <div v-else-if="isColorField && props.value" class="color-field">
      <div 
          class="color-preview" 
          :style="{ backgroundColor: props.value }"
          v-tooltip.top="props.value"
          @click.stop="showColorCode = !showColorCode"
      ></div>
      <span v-if="showColorCode" class="color-value">{{ props.value }}</span>
    </div>

    <!-- Icon Field -->
    <div v-else-if="isIconField && props.value" class="icon-field">
      <v-icon 
          :name="props.value" 
          small
          class="icon-preview"
          v-tooltip.top="props.value"
      />
    </div>

    <!-- Rating Field -->
    <div v-else-if="isRatingField" class="rating-field">
      <v-icon 
          v-for="star in maxStars"
          :key="star"
          :name="star <= props.value ? 'star' : 'star_outline'"
          small
          class="rating-star"
          :class="{ filled: star <= props.value }"
      />
      <span class="rating-value">{{ props.value }}/{{ maxStars }}</span>
    </div>

    <!-- Slider/Range Field -->
    <div v-else-if="isSliderField" class="slider-field">
      <div class="slider-container">
        <span class="slider-value-label">{{ props.value }}</span>
        <div class="slider-track">
          <div 
              class="slider-fill" 
              :style="{ width: sliderPercentage + '%' }"
          ></div>
        </div>
      </div>
    </div>

    <!-- User Field -->
    <div v-else-if="isUserField && props.value" class="user-field">
      <div class="user-avatar" :style="{ backgroundColor: getUserColor() }">
        {{ getUserInitials() }}
      </div>
      <span class="user-name">{{ getUserDisplayName() }}</span>
    </div>

    <!-- Relation Fields (M2O, O2M, M2M) -->
    <div v-else-if="isRelationField" class="relation-field">
      <!-- Single relation (M2O) -->
      <div v-if="isSingleRelation && relationValue" class="relation-item">
        <v-icon name="link" x-small class="relation-icon" />
        <span class="relation-text">{{ getRelationDisplay(relationValue) }}</span>
      </div>
      
      <!-- Multiple relations (O2M, M2M) -->
      <div v-else-if="isMultipleRelation && relationArray.length > 0" class="relation-list">
        <div 
            v-for="(item, index) in relationArray.slice(0, 3)"
            :key="index"
            class="relation-item"
        >
          <v-icon name="link" x-small class="relation-icon" />
          <span class="relation-text">{{ getRelationDisplay(item) }}</span>
        </div>
        <v-chip v-if="relationArray.length > 3" x-small class="relation-more">
          +{{ relationArray.length - 3 }} more
        </v-chip>
      </div>
      
      <!-- Empty relation -->
      <span v-else class="field-value empty">—</span>
    </div>

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
          @click="showImageModal = true"
      >
        <img 
            :src="imageUrl" 
            :alt="getFilename || 'Image'"
            @error="handleImageError"
        />
      </div>
      
      <!-- Full size image modal -->
      <v-dialog
          v-model="showImageModal"
          @esc="showImageModal = false"
      >
        <template #default>
          <div class="image-modal-wrapper" @click="showImageModal = false">
            <img 
                :src="fullSizeImageUrl" 
                :alt="getFilename || 'Image'"
                class="full-size-image"
                @click.stop
            />
            <v-button 
                class="modal-close-button"
                icon
                rounded
                secondary
                @click="showImageModal = false"
            >
              <v-icon name="close" />
            </v-button>
          </div>
        </template>
      </v-dialog>
    </div>
    
    <!-- File Field (non-image) -->
    <div v-else-if="isFileField" class="file-field">
      <v-button
          small
          secondary
          @click="downloadFile"
          v-tooltip.top="`Download ${getFilename}`"
      >
        <v-icon name="file_download" small />
        <span class="file-name">{{ getFilename }}</span>
      </v-button>
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
        v-tooltip="displayValue"
    >
      {{ displayValue }}
    </span>
  </div>
</template>

<script setup lang="ts">
import { computed, watch, ref } from 'vue';
import { createScopedLogger } from '../utils/logger-wrapper';

const logger = createScopedLogger('FieldDisplay');

// Modal state
const showImageModal = ref(false);
const showColorCode = ref(false);

interface Props {
  value: string | number | boolean | null | Record<string, unknown> | unknown[];
  field: string;
  fieldInfo?: {
    field: string;
    name?: string;
    type: string;
    interface?: string;
    display?: string;
    options?: Record<string, unknown>;
  };
  maxLength?: number;
}

const props = withDefaults(defineProps<Props>(), {
  maxLength: 100
});

// Debug logging
watch(() => props.fieldInfo, (info) => {
  // Log all fields for debugging
  logger.debug('FieldInfo for field', {
    field: props.field,
    fieldInfo: info,
    interface: info?.interface,
    type: info?.type,
    display: info?.display,
    value: props.value
  });
}, { immediate: true });

// Field type detection
const fieldType = computed(() => props.fieldInfo?.type || typeof props.value);
const fieldInterface = computed(() => props.fieldInfo?.interface);
const fieldDisplay = computed(() => props.fieldInfo?.display);

const isSelectDropdown = computed(() => 
  fieldInterface.value === 'select-dropdown'
);

// New field type detections
const isTagsField = computed(() => 
  fieldInterface.value === 'tags' || 
  fieldInterface.value === 'select-multiple'
);

const isColorField = computed(() => 
  fieldInterface.value === 'select-color' ||
  fieldInterface.value === 'interface-color'
);

const isIconField = computed(() => 
  fieldInterface.value === 'select-icon' ||
  fieldInterface.value === 'interface-icon' ||
  fieldInterface.value === 'icon'
);

const isRatingField = computed(() => 
  fieldInterface.value === 'rating' ||
  fieldInterface.value === 'interface-rating'
);

const isSliderField = computed(() => 
  fieldInterface.value === 'slider' ||
  fieldInterface.value === 'interface-slider' ||
  fieldInterface.value === 'input-range'
);

const isUserField = computed(() => 
  fieldInterface.value === 'select-dropdown-m2o' && 
  (props.field === 'user_created' || 
   props.field === 'user_updated' || 
   props.field.includes('user') ||
   props.fieldInfo?.collection === 'directus_users')
);

const isRelationField = computed(() => {
  const relationType = props.fieldInfo?.type;
  return relationType === 'm2o' || 
         relationType === 'o2m' || 
         relationType === 'm2m' ||
         relationType === 'alias' ||
         (fieldInterface.value && fieldInterface.value.includes('m2o'));
});

const isSingleRelation = computed(() => {
  const relationType = props.fieldInfo?.type;
  return relationType === 'm2o' || 
         fieldInterface.value === 'select-dropdown-m2o';
});

const isMultipleRelation = computed(() => {
  const relationType = props.fieldInfo?.type;
  return relationType === 'o2m' || 
         relationType === 'm2m' ||
         relationType === 'alias';
});

// Check if value contains HTML tags
const containsHtml = computed(() => {
  if (!props.value || typeof props.value !== 'string') return false;
  // Simple check for HTML tags
  return /<[^>]+>/.test(props.value);
});

const isWysiwyg = computed(() => {
  const result = fieldInterface.value === 'input-rich-text-html' || 
    fieldInterface.value === 'input-rich-text-md' ||
    fieldDisplay.value === 'formatted-value' ||
    containsHtml.value; // Fallback: treat as WYSIWYG if it contains HTML
  
  if (props.field === 'description') {
    logger.debug('isWysiwyg check for description', {
      fieldInterface: fieldInterface.value,
      fieldDisplay: fieldDisplay.value,
      containsHtml: containsHtml.value,
      result
    });
  }
  
  return result;
});

const isDateField = computed(() => 
  fieldType.value === 'date' || 
  fieldType.value === 'dateTime' || 
  fieldType.value === 'timestamp'
);

const isJsonField = computed(() => 
  fieldType.value === 'json' || 
  (typeof props.value === 'object' && props.value !== null && !Array.isArray(props.value))
);

const isImageField = computed(() => {
  if (fieldInterface.value === 'file-image') return true;
  if (fieldInterface.value === 'file' && isImageExtension(props.value)) return true;
  if (fieldType.value === 'uuid' && props.field.includes('image')) return true;
  if (typeof props.value === 'string' && isImageExtension(props.value)) return true;
  return false;
});

const isFileField = computed(() => {
  if (fieldInterface.value === 'file' && !isImageExtension(props.value)) return true;
  if (fieldInterface.value === 'file-image' && !isImageExtension(props.value)) return true;
  return false;
});

function isImageExtension(value: unknown): boolean {
  // If it's an object, check the filename_download
  if (typeof value === 'object' && value !== null) {
    if (value.filename_download && typeof value.filename_download === 'string') {
      return /\.(jpg|jpeg|png|gif|webp|svg|bmp|ico)$/i.test(value.filename_download);
    }
    // If it has a type field that indicates it's an image
    if (value.type && typeof value.type === 'string') {
      return value.type.startsWith('image/');
    }
  }
  
  // String value check
  if (typeof value === 'string') {
    return /\.(jpg|jpeg|png|gif|webp|svg|bmp|ico)$/i.test(value);
  }
  
  return false;
}

// Value processing
const displayValue = computed(() => {
  if (props.value === null || props.value === undefined) return '';
  if (typeof props.value === 'object') return JSON.stringify(props.value);
  return String(props.value);
});

// Removed truncatedValue - not used

// Tags array processing
const tagsArray = computed(() => {
  if (!props.value) return [];
  if (Array.isArray(props.value)) return props.value;
  if (typeof props.value === 'string') {
    // Try to parse as JSON first
    try {
      const parsed = JSON.parse(props.value);
      if (Array.isArray(parsed)) return parsed;
    } catch {
      // Ignore parsing errors
    }
    // Otherwise split by comma
    return props.value.split(',').map(tag => tag.trim()).filter(Boolean);
  }
  return [];
});

// Rating configuration
const maxStars = computed(() => {
  return props.fieldInfo?.options?.max_stars || 5;
});

// Slider configuration
const sliderMin = computed(() => {
  return props.fieldInfo?.options?.min || 0;
});

const sliderMax = computed(() => {
  return props.fieldInfo?.options?.max || 100;
});

const sliderPercentage = computed(() => {
  const min = sliderMin.value;
  const max = sliderMax.value;
  const value = Number(props.value) || 0;
  return ((value - min) / (max - min)) * 100;
});

// Relation value processing
const relationValue = computed(() => {
  if (!props.value) return null;
  // For M2O, value might be an ID or an object
  if (typeof props.value === 'object' && !Array.isArray(props.value)) {
    return props.value;
  }
  // If it's just an ID, return it wrapped
  if (typeof props.value === 'string' || typeof props.value === 'number') {
    return { id: props.value };
  }
  return null;
});

const relationArray = computed(() => {
  if (!props.value) return [];
  if (Array.isArray(props.value)) return props.value;
  return [];
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
  
  // Simple HTML sanitization without external libraries
  const html = displayValue.value;
  
  // Create a temporary element to parse HTML
  const temp = document.createElement('div');
  temp.innerHTML = html;
  
  // Remove all script tags and event handlers
  const scripts = temp.querySelectorAll('script, link, meta, style');
  scripts.forEach(el => el.remove());
  
  // Remove all on* event attributes
  const allElements = temp.querySelectorAll('*');
  allElements.forEach(el => {
    // Remove event handlers
    for (let i = el.attributes.length - 1; i >= 0; i--) {
      const attr = el.attributes[i];
      if (attr.name.startsWith('on') || attr.name === 'href' && attr.value.startsWith('javascript:')) {
        el.removeAttribute(attr.name);
      }
    }
    
    // Sanitize href attributes for anchors
    if (el.tagName === 'A') {
      const href = el.getAttribute('href');
      if (href && (href.startsWith('javascript:') || href.startsWith('data:'))) {
        el.removeAttribute('href');
      }
    }
  });
  
  return temp.innerHTML;
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
function formatDate(value: string | number | Date | null): string {
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
  
  // Check if value is an object with file information
  if (typeof props.value === 'object' && props.value !== null) {
    // Use the ID if available
    if (props.value.id) {
      return `/assets/${props.value.id}?fit=cover&width=300&height=300&quality=80`;
    }
  }
  
  // If it's a UUID (Directus file), construct the URL
  if (typeof props.value === 'string') {
    if (/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(props.value)) {
      return `/assets/${props.value}?fit=cover&width=300&height=300&quality=80`;
    }
    
    // If it's already a URL
    if (props.value.startsWith('http') || props.value.startsWith('/')) {
      return props.value;
    }
  }
  
  return '';
});

const getFilename = computed(() => {
  if (!props.value) return '';
  
  // Check if value is an object with file information
  if (typeof props.value === 'object' && props.value !== null) {
    // Directus file object structure
    if (props.value.filename_download) {
      return props.value.filename_download;
    }
    if (props.value.title) {
      return props.value.title;
    }
    if (props.value.filename_disk) {
      return props.value.filename_disk;
    }
  }
  
  // Check if we have file metadata in field options
  if (props.fieldInfo?.options?.file) {
    if (props.fieldInfo.options.file.filename_download) {
      return props.fieldInfo.options.file.filename_download;
    }
  }
  
  // If it's a string value
  if (typeof props.value === 'string') {
    // Check if it's a UUID
    if (/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(props.value)) {
      // Return null to indicate no filename available
      return null;
    }
    
    // Remove query parameters
    const cleanUrl = props.value.split('?')[0];
    const parts = cleanUrl.split('/');
    const filename = parts[parts.length - 1] || props.value;
    
    // Decode URL encoded names
    try {
      return decodeURIComponent(filename);
    } catch {
      return filename;
    }
  }
  
  return String(props.value);
});

const imageTooltipContent = computed(() => {
  if (!imageUrl.value) return '';
  
  const filename = getFilename.value;
  
  // If no filename available (UUID), show simple tooltip
  if (!filename) {
    return 'Click to view full size';
  }
  
  // Build informative tooltip
  let tooltipLines = [`Filename: ${filename}`];
  
  // Add more metadata if available
  if (props.fieldInfo?.options?.metadata) {
    const metadata = props.fieldInfo.options.metadata;
    if (metadata.width && metadata.height) {
      tooltipLines.push(`Dimensions: ${metadata.width}×${metadata.height}px`);
    }
    if (metadata.filesize) {
      tooltipLines.push(`Size: ${formatFileSize(metadata.filesize)}`);
    }
  }
  
  return tooltipLines.join('\n');
});

// Helper function to format file size
function formatFileSize(bytes: number): string {
  if (bytes === 0) return '0 Bytes';
  const k = 1024;
  const sizes = ['Bytes', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
}

// Full size image URL for modal
const fullSizeImageUrl = computed(() => {
  if (!props.value) return '';
  
  // Check if value is an object with file information
  if (typeof props.value === 'object' && props.value !== null) {
    if (props.value.id) {
      return `/assets/${props.value.id}`;
    }
  }
  
  // If it's a UUID (Directus file), construct the full size URL
  if (typeof props.value === 'string' && /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(props.value)) {
    return `/assets/${props.value}`;
  }
  
  // For other URLs, remove any size parameters
  if (typeof props.value === 'string' && (props.value.startsWith('http') || props.value.startsWith('/'))) {
    return props.value.split('?')[0];
  }
  
  return imageUrl.value;
});

function handleImageError(event: Event) {
  const img = event.target as HTMLImageElement;
  img.src = 'data:image/svg+xml,%3Csvg xmlns="http://www.w3.org/2000/svg" width="50" height="50" viewBox="0 0 24 24"%3E%3Cpath fill="%23999" d="M21 19V5c0-1.1-.9-2-2-2H5c-1.1 0-2 .9-2 2v14c0 1.1.9 2 2 2h14c1.1 0 2-.9 2-2zM8.5 13.5l2.5 3.01L14.5 12l4.5 6H5l3.5-4.5z"/%3E%3C/svg%3E';
}

// Download file function
function downloadFile() {
  if (!props.value) return;
  
  let downloadUrl: string;

  // If it's a UUID (Directus file), construct the download URL
  if (fieldType.value === 'uuid' || /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(props.value)) {
    downloadUrl = `/assets/${props.value}?download`;
  } else if (typeof props.value === 'string' && (props.value.startsWith('http') || props.value.startsWith('/'))) {
    downloadUrl = props.value;
  } else {
    return;
  }
  
  // Create a temporary link and trigger download
  const link = document.createElement('a');
  link.href = downloadUrl;
  link.download = getFilename.value || 'download';
  link.style.display = 'none';
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
}

// User field helpers
function getUserDisplayName(): string {
  if (!props.value) return '';
  
  // If value is an object with user data
  if (typeof props.value === 'object' && props.value !== null) {
    if (props.value.first_name || props.value.last_name) {
      return `${props.value.first_name || ''} ${props.value.last_name || ''}`.trim();
    }
    if (props.value.email) {
      return props.value.email;
    }
    if (props.value.name) {
      return props.value.name;
    }
  }
  
  // If it's just an ID or email
  return String(props.value);
}

function getUserInitials(): string {
  const name = getUserDisplayName();
  if (!name) return '?';
  
  // If it's an email, use first letter
  if (name.includes('@')) {
    return name.charAt(0).toUpperCase();
  }
  
  // Otherwise get initials from name
  const parts = name.split(' ').filter(Boolean);
  if (parts.length >= 2) {
    return parts[0].charAt(0).toUpperCase() + parts[parts.length - 1].charAt(0).toUpperCase();
  }
  return name.charAt(0).toUpperCase();
}

function getUserColor(): string {
  // Generate a consistent color based on the user value
  const str = getUserDisplayName();
  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    hash = str.charCodeAt(i) + ((hash << 5) - hash);
  }
  
  const hue = Math.abs(hash) % 360;
  return `hsl(${hue}, 65%, 50%)`;
}

// Relation display helper
function getRelationDisplay(item: Record<string, unknown>): string {
  if (!item) return '';
  
  // If it's just an ID
  if (typeof item === 'string' || typeof item === 'number') {
    return `#${item}`;
  }
  
  // If it's an object, try to find a display field
  if (typeof item === 'object') {
    // Common display fields in order of preference
    const displayFields = ['title', 'name', 'label', 'email', 'username', 'id'];
    
    for (const field of displayFields) {
      if (item[field]) {
        return String(item[field]);
      }
    }
    
    // If no common field found, use the first string field
    for (const key in item) {
      if (typeof item[key] === 'string' && key !== 'id') {
        return item[key];
      }
    }
    
    // Fallback to ID
    if (item.id) {
      return `#${item.id}`;
    }
  }
  
  return String(item);
}
</script>

<style scoped>
.field-display {
  display: flex;
  align-items: center;
  gap: 8px;
  width: 100%;
  min-width: 0;
}

.field-value {
  color: var(--foreground-normal);
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  min-width: 0;
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
  display: flex;
  align-items: center;
  gap: 4px;
  width: 100%;
  min-width: 0;
}

.wysiwyg-field .field-value {
  flex: 1;
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
  display: flex;
  align-items: center;
  gap: 4px;
  width: 100%;
  min-width: 0;
}

.json-chip {
  background-color: var(--background-normal);
  color: var(--foreground-subdued);
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
  display: flex;
  align-items: center;
  width: 100%;
  min-width: 0;
}

.image-preview {
  width: 100%;
  max-height: 120px;
  border-radius: 4px;
  overflow: hidden;
  border: 1px solid var(--border-normal);
  cursor: pointer;
  transition: all 0.2s;
  position: relative;
  background: var(--background-subdued);
}

.image-preview:hover {
  border-color: var(--primary);
  box-shadow: 0 0 0 2px var(--primary-25);
}

.image-preview img {
  width: 100%;
  height: auto;
  max-height: 120px;
  object-fit: contain;
  display: block;
}

/* Image modal */
.image-modal-wrapper {
  position: relative;
  width: 100vw;
  height: 100vh;
  display: flex;
  justify-content: center;
  align-items: center;
  background: rgba(0, 0, 0, 0.9);
  cursor: pointer;
}

.full-size-image {
  max-width: 90vw;
  max-height: 90vh;
  width: auto;
  height: auto;
  object-fit: contain; /* Scale to fit while maintaining aspect ratio */
  display: block;
  cursor: default;
  box-shadow: 0 5px 30px 0 rgba(0, 0, 0, 0.3);
}

.modal-close-button {
  position: absolute;
  top: 20px;
  right: 20px;
  background: var(--background-page) !important;
  z-index: 10;
  
  &:hover {
    background: var(--background-normal) !important;
  }
}

/* File field */
.file-field {
  display: flex;
  align-items: center;
  gap: 8px;
  width: 100%;
}

.file-field .v-button {
  flex-shrink: 0;
}

.file-name {
  margin-left: 8px;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  min-width: 0;
}

/* Tags field */
.tags-field {
  display: flex;
  flex-wrap: wrap;
  gap: 4px;
  align-items: center;
  width: 100%;
}

.tag-chip {
  background-color: var(--background-normal);
  color: var(--foreground-normal);
}

/* Color field */
.color-field {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 8px;
  width: 100%;
}

.color-preview {
  width: 20px;
  height: 20px;
  border-radius: 4px;
  border: 1px solid var(--border-normal);
  flex-shrink: 0;
  cursor: pointer;
  transition: all 0.2s;
}

.color-preview:hover {
  transform: scale(1.1);
  box-shadow: 0 2px 4px rgba(0, 0, 0, 0.2);
}

.color-value {
  font-family: monospace;
  font-size: 12px;
  color: var(--foreground-subdued);
  animation: fadeIn 0.2s ease-in-out;
}

@keyframes fadeIn {
  from { opacity: 0; }
  to { opacity: 1; }
}

/* Icon field */
.icon-field {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 100%;
}

.icon-preview {
  color: var(--foreground-normal);
}

/* Rating field */
.rating-field {
  display: flex;
  align-items: center;
  gap: 4px;
}

.rating-star {
  color: var(--border-normal);
}

.rating-star.filled {
  color: var(--warning);
}

.rating-value {
  margin-left: 8px;
  color: var(--foreground-subdued);
  font-size: 12px;
}

/* Slider field */
.slider-field {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 100%;
  min-width: 0;
}

.slider-container {
  flex: 1;
  position: relative;
  padding-top: 20px;
  max-width: 150px;
}

.slider-value-label {
  position: absolute;
  top: 0;
  left: 50%;
  transform: translateX(-50%);
  font-size: 11px;
  color: var(--foreground-normal);
  font-weight: 600;
  background: var(--background-page);
  padding: 0 4px;
}

.slider-track {
  height: 4px;
  background-color: var(--background-normal);
  border-radius: 2px;
  position: relative;
  width: 100%;
}

.slider-fill {
  height: 100%;
  background-color: var(--primary);
  border-radius: 2px;
  transition: width 0.2s ease;
}

/* User field */
.user-field {
  display: flex;
  align-items: center;
  gap: 8px;
}

.user-avatar {
  width: 24px;
  height: 24px;
  border-radius: 50%;
  display: flex;
  align-items: center;
  justify-content: center;
  color: white;
  font-size: 10px;
  font-weight: 600;
  flex-shrink: 0;
}

.user-name {
  color: var(--foreground-normal);
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

/* Relation field */
.relation-field {
  width: 100%;
}

.relation-list {
  display: flex;
  flex-direction: column;
  gap: 4px;
}

.relation-item {
  display: flex;
  align-items: center;
  gap: 4px;
  color: var(--primary);
  cursor: pointer;
  transition: opacity 0.2s;
}

.relation-item:hover {
  opacity: 0.8;
}

.relation-icon {
  color: var(--primary);
  flex-shrink: 0;
}

.relation-text {
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.relation-more {
  background-color: var(--background-normal);
  color: var(--foreground-subdued);
  margin-top: 4px;
}

.field-value.empty {
  color: var(--foreground-subdued);
}
</style>