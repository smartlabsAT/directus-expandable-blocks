<template>
  <v-menu placement="bottom-end" show-arrow :close-on-content-click="false" >
    <template #activator="{ toggle }">
      <v-button
          v-tooltip.bottom="'Display Settings'"
          icon
          secondary
          @click="toggle"
      >
        <v-icon name="settings"/>
      </v-button>
    </template>

    <v-list class="field-selector-list">
      <!-- Language Selector (if translations available) -->
      <template v-if="translationInfo?.hasTranslations">
        <v-list-item disabled>
          <v-list-item-content>
            <div class="field-selector-header">Language</div>
          </v-list-item-content>
        </v-list-item>
        <v-list-item>
          <v-list-item-content>
            <v-select
                :model-value="selectedLanguage"
                :items="availableLanguages || []"
                item-text="name"
                item-value="code"
                @update:model-value="$emit('change-language', $event)"
            />
          </v-list-item-content>
        </v-list-item>
        <v-divider/>
      </template>
      
      <v-list-item disabled>
        <v-list-item-content>
          <div class="field-selector-header">Display Options</div>
        </v-list-item-content>
      </v-list-item>
      <v-divider/>
      <v-list-item clickable @click="$emit('toggle-show-ids')">
        <v-list-item-icon>
          <v-checkbox
              :model-value="showIds"
              @update:model-value="$emit('toggle-show-ids')"
              @click.stop
          />
        </v-list-item-icon>
        <v-list-item-content>
          <v-list-item-title>Show IDs</v-list-item-title>
        </v-list-item-content>
      </v-list-item>
      <v-divider/>
      <v-list-item disabled>
        <v-list-item-content>
          <div class="field-selector-header">
            Select fields to display
            <v-progress-circular v-if="loading" indeterminate x-small />
          </div>
        </v-list-item-content>
      </v-list-item>
      <v-divider/>
      <v-list-item
          v-for="field in availableFields"
          :key="field.field"
          clickable
          @click="$emit('toggle-field', field.field)"
      >
        <v-list-item-icon>
          <v-checkbox
              :model-value="displayFields.includes(field.field)"
              @update:model-value="$emit('toggle-field', field.field)"
              @click.stop
          />
        </v-list-item-icon>
        <v-list-item-content>
          <v-list-item-title class="field-selector-title">
            <span class="field-name">
              {{ capitalizeField(field.name || field.field) }}
            </span>
            <v-icon 
                v-if="isTranslatable(field)" 
                name="translate" 
                small
                v-tooltip.top="'This field is translatable'"
                class="translation-icon"
            />
          </v-list-item-title>
        </v-list-item-content>
      </v-list-item>
    </v-list>
  </v-menu>
</template>

<script setup lang="ts">
import { computed } from 'vue';

interface FieldWithTranslation {
  field: string;
  name?: string;
  type: string;
  interface?: string;
  display?: string;
  options?: any;
  translatable?: boolean;
  translation_type?: string;
}

interface Props {
  availableFields: FieldWithTranslation[];
  displayFields: string[];
  selectedLanguage?: string;
  availableLanguages?: Array<{ code: string; name: string; }>;
  translationInfo?: any;
  loading?: boolean;
  isFieldTranslatable?: (field: string) => boolean;
  showIds?: boolean;
}

const props = withDefaults(defineProps<Props>(), {
  availableFields: () => [],
  displayFields: () => [],
  loading: false,
  showIds: false
});

defineEmits<{
  'toggle-field': [field: string];
  'change-language': [language: string];
  'toggle-show-ids': [];
}>();

// Helper function to check if field is translatable
function isTranslatable(field: FieldWithTranslation): boolean {
  if (props.isFieldTranslatable) {
    return props.isFieldTranslatable(field.field);
  }
  return field.translatable || false;
}

// Helper function to capitalize field names
function capitalizeField(fieldName: string): string {
  return fieldName
      .replace(/_/g, ' ')
      .replace(/([A-Z])/g, ' $1')
      .trim()
      .split(' ')
      .map(word => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase())
      .join(' ');
}
</script>

<style scoped>
.field-selector-header {
  display: flex;
  align-items: center;
  gap: 8px;
  justify-content: space-between;
  font-weight: 600;
  color: var(--foreground-subdued);
}

.field-selector-title {
  display: flex;
  align-items: center;
  gap: 8px;
}

.field-name {
  flex: 1;
}

.translation-icon {
  color: var(--primary);
  opacity: 0.7;
}

.translation-icon:hover {
  opacity: 1;
}

/* Dynamic height for field selector menu */
.field-selector-list {
  max-height: 400px;
  overflow-y: auto;
  overflow-x: hidden;
}

/* Custom scrollbar styling */
.field-selector-list::-webkit-scrollbar {
  width: 4px;
}

.field-selector-list::-webkit-scrollbar-track {
  background: var(--background-subdued);
}

.field-selector-list::-webkit-scrollbar-thumb {
  background: var(--border-normal);
  border-radius: 2px;
}

.field-selector-list::-webkit-scrollbar-thumb:hover {
  background: var(--border-normal-alt);
}

/* Language selector */
.v-select {
  min-height: 36px;
}
</style>