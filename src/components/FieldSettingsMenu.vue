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

    <div class="settings-menu-content">
      <div class="settings-columns">
        <!-- Left Column: Language & Display Options -->
        <div class="settings-column settings-column-left">
          <v-list class="field-selector-list">
            <!-- Sort Options -->
            <v-list-item disabled>
              <v-list-item-content>
                <div class="field-selector-header">Sort Options</div>
              </v-list-item-content>
            </v-list-item>
            <v-list-item>
              <v-list-item-content>
                <div class="sort-controls">
                  <v-select
                      :model-value="sortField"
                      :items="sortFieldOptions"
                      item-text="text"
                      item-value="value"
                      placeholder="Select field..."
                      @update:model-value="$emit('update:sort-field', $event)"
                  />
                  <v-button
                      icon
                      secondary
                      @click="$emit('toggle-sort-direction')"
                      v-tooltip.top="sortDirection === 'asc' ? 'Ascending' : 'Descending'"
                  >
                    <v-icon :name="sortDirection === 'asc' ? 'arrow_upward' : 'arrow_downward'" />
                  </v-button>
                </div>
              </v-list-item-content>
            </v-list-item>
            <v-divider/>
            
            <!-- Items per Page -->
            <v-list-item disabled>
              <v-list-item-content>
                <div class="field-selector-header">Items per Page</div>
              </v-list-item-content>
            </v-list-item>
            <v-list-item>
              <v-list-item-content>
                <v-select
                    :model-value="itemsPerPage"
                    :items="itemsPerPageOptions"
                    item-text="text"
                    item-value="value"
                    @update:model-value="$emit('update:items-per-page', $event)"
                />
              </v-list-item-content>
            </v-list-item>
            <v-divider/>
            

            
            <v-list-item disabled>
              <v-list-item-content>
                <div class="field-selector-header">Display Options</div>
              </v-list-item-content>
            </v-list-item>

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
            <v-list-item clickable @click="$emit('toggle-hide-empty-fields')">
              <v-list-item-icon>
                <v-checkbox
                    :model-value="hideEmptyFields"
                    @update:model-value="$emit('toggle-hide-empty-fields')"
                    @click.stop
                />
              </v-list-item-icon>
              <v-list-item-content>
                <v-list-item-title>Hide empty fields</v-list-item-title>
              </v-list-item-content>
            </v-list-item>
            <v-list-item clickable @click="$emit('toggle-show-last-update')">
              <v-list-item-icon>
                <v-checkbox
                    :model-value="showLastUpdate"
                    @update:model-value="$emit('toggle-show-last-update')"
                    @click.stop
                />
              </v-list-item-icon>
              <v-list-item-content>
                <v-list-item-title>Show last update</v-list-item-title>
              </v-list-item-content>
            </v-list-item>
          </v-list>
        </div>
        
        <!-- Right Column: Field Selection -->
        <div class="settings-column settings-column-right">




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
                <div class="field-selector-header">
                  Select fields to display
                  <v-progress-circular v-if="loading" indeterminate x-small />
                </div>
              </v-list-item-content>
            </v-list-item>
            <v-divider/>

            <div class="field-list-scrollable">
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
            </div>
          </v-list>
        </div>
      </div>
    </div>
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
  hideEmptyFields?: boolean;
  showLastUpdate?: boolean;
  sortField?: string | null;
  sortDirection?: 'asc' | 'desc';
  itemsPerPage?: number;
}

const props = withDefaults(defineProps<Props>(), {
  availableFields: () => [],
  displayFields: () => [],
  loading: false,
  showIds: false,
  hideEmptyFields: false,
  showLastUpdate: false,
  sortField: null,
  sortDirection: 'asc',
  itemsPerPage: 100
});

defineEmits<{
  'toggle-field': [field: string];
  'change-language': [language: string];
  'toggle-show-ids': [];
  'toggle-hide-empty-fields': [];
  'toggle-show-last-update': [];
  'update:sort-field': [field: string | null];
  'toggle-sort-direction': [];
  'update:items-per-page': [value: number];
}>();

// Computed properties
const sortFieldOptions = computed(() => {
  const options = [
    { text: 'None', value: null },
    { text: 'Date Created', value: 'date_created' },
    { text: 'Date Updated', value: 'date_updated' }
  ];
  
  // Add all available fields
  props.availableFields.forEach(field => {
    options.push({
      text: capitalizeField(field.name || field.field),
      value: field.field
    });
  });
  
  return options;
});

const itemsPerPageOptions = computed(() => [
  { text: '50 items', value: 50 },
  { text: '100 items', value: 100 },
  { text: '200 items', value: 200 }
]);

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
/* Two-column layout */
.settings-menu-content {
  width: 600px;
  max-width: 90vw;
  padding: 0;
}

.settings-columns {
  display: flex;
}

.settings-column {
  flex: 1;
  overflow: hidden;
  display: flex;
  flex-direction: column;
}

.settings-column-left {
  flex: 0 0 250px;
  border-right: 1px solid var(--border-normal);
}

.settings-column-right {
  flex: 1;
  min-width: 300px;
}

.field-selector-header {
  display: flex;
  align-items: center;
  gap: 8px;
  justify-content: space-between;
  font-weight: 600;
  color: var(--foreground-normal);
  cursor: auto;

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

/* Scrollable field list */
.field-list-scrollable {
  flex: 1;
  overflow-y: auto;
  overflow-x: hidden;
}

/* Remove max-height from lists since container handles it */
.field-selector-list {
  height: 100%;
  overflow: visible;
}

/* Custom scrollbar styling */
.field-list-scrollable::-webkit-scrollbar {
  width: 4px;
}

.field-list-scrollable::-webkit-scrollbar-track {
  background: var(--background-subdued);
}

.field-list-scrollable::-webkit-scrollbar-thumb {
  background: var(--border-normal);
  border-radius: 2px;
}

.field-list-scrollable::-webkit-scrollbar-thumb:hover {
  background: var(--border-normal-alt);
}

/* Language selector */
.v-select {
  min-height: 44px;
}

/* Sort controls */
.sort-controls {
  display: flex;
  gap: 8px;
  align-items: center;
}

.sort-controls .v-select {
  flex: 1;
}

/* Select field styling - 44px height */
.v-select :deep(.v-input) {
  min-height: 44px !important;
  height: 44px !important;
}

.v-select :deep(.v-input .input) {
  min-height: 44px !important;
  padding: 0 12px !important;
}
</style>