<template>
  <div class="add-block-wrapper">
    <div v-if="canAdd && !disabled && hasAvailableCollections" class="button-group">
      <!-- Create New Button -->
      <!-- Single Collection -->
      <v-button
        v-if="collections.length === 1"
        class="add-block-button"
        :disabled="disabled"
        @click="$emit('add-item', collections[0].collection)"
      >
        <v-icon name="add" />
        Create New
      </v-button>

      <!-- Multiple Collections -->
      <v-menu
        v-else-if="collections.length > 1"
        placement="bottom"
        show-arrow
      >
        <template #activator="{ toggle }">
          <v-button
            class="add-block-button with-dropdown"
            :disabled="disabled"
            @click="toggle"
          >
            <span>Create New</span>
            <v-icon name="arrow_drop_down" />
          </v-button>
        </template>

        <v-list>
          <v-list-item
            v-for="collection in collections"
            :key="collection.collection"
            clickable
            @click="$emit('add-item', collection.collection)"
          >
            <v-list-item-icon>
              <v-icon :name="collection.icon || 'box'" />
            </v-list-item-icon>
            <v-list-item-content>
              {{ collection.name || collection.collection }}
            </v-list-item-content>
          </v-list-item>
        </v-list>
      </v-menu>

      <!-- Add Existing Button - Single Collection -->
      <v-button
        v-if="showAddExisting && existingCollections.length === 1"
        class="add-block-button add-existing-button"
        :disabled="disabled"
        @click="$emit('add-existing', existingCollections[0].collection)"
      >
        <v-icon name="link" />
        <span>Add Existing</span>
      </v-button>

      <!-- Add Existing Button - Multiple Collections -->
      <v-menu
        v-else-if="showAddExisting && existingCollections.length > 1"
        placement="bottom"
        show-arrow
      >
        <template #activator="{ toggle }">
          <v-button
            class="add-block-button add-existing-button with-dropdown"
            :disabled="disabled"
            @click="toggle"
          >
            <v-icon name="link" />
            <span>Add Existing</span>
            <v-icon name="arrow_drop_down" />
          </v-button>
        </template>

        <v-list>
          <v-list-item
            v-for="collection in existingCollections"
            :key="collection.collection"
            clickable
            @click="$emit('add-existing', collection.collection)"
          >
            <v-list-item-icon>
              <v-icon :name="collection.icon || 'box'" />
            </v-list-item-icon>
            <v-list-item-content>
              {{ collection.name || collection.collection }}
            </v-list-item-content>
          </v-list-item>
        </v-list>
      </v-menu>
    </div>

    <!-- Max blocks reached -->
    <div v-else-if="!canAdd && !disabled" class="max-blocks-message">
      <v-icon name="info" x-small />
      <span>Maximum blocks reached</span>
    </div>
    
    <!-- No permissions for any collection -->
    <div v-else-if="canAdd && !disabled && !hasAvailableCollections" class="max-blocks-message">
      <v-icon name="block" x-small />
      <span>No permissions to create blocks</span>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed } from 'vue';

interface Props {
  disabled: boolean;
  collections: Array<{
    collection: string;
    name?: string;
    icon?: string;
  }>;
  collectionsForExisting?: Array<{
    collection: string;
    name?: string;
    icon?: string;
  }>;
  canAdd: boolean;
  allowLinkExisting?: boolean;
  allowDuplicateExisting?: boolean;
}

const props = defineProps<Props>();

defineEmits<{
  'add-item': [collection: string];
  'add-existing': [collection: string];
}>();

// Use collectionsForExisting if provided, NO fallback
const existingCollections = computed(() => {
  return props.collectionsForExisting || [];
});

// Only show "Add Existing" button if there are collections available AND at least one permission is enabled
const showAddExisting = computed(() => {
  const hasCollections = existingCollections.value && existingCollections.value.length > 0;
  const hasPermission = props.allowLinkExisting !== false || props.allowDuplicateExisting !== false;
  return hasCollections && hasPermission;
});

// Check if any collections are available for create or existing
const hasAvailableCollections = computed(() => {
  return props.collections.length > 0 || existingCollections.value.length > 0;
});
</script>

