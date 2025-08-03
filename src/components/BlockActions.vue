<template>
  <v-menu
    placement="bottom-end"
    show-arrow
  >
    <template #activator="{ toggle }">
      <v-button
        v-tooltip="'More options'"
        x-small
        icon
        secondary
        @click.stop="toggle"
      >
        <v-icon name="more_vert" />
      </v-button>
    </template>

    <v-list>
      <v-list-item
        v-if="allowDuplicate && !isDeleted"
        clickable
        @click="$emit('duplicate')"
      >
        <v-list-item-icon>
          <v-icon name="content_copy" />
        </v-list-item-icon>
        <v-list-item-content>Duplicate</v-list-item-content>
      </v-list-item>

      <v-list-item
        v-if="!isDeleted"
        clickable
        :disabled="!isDirty"
        @click="$emit('discard-changes')"
      >
        <v-list-item-icon>
          <v-icon name="undo" />
        </v-list-item-icon>
        <v-list-item-content>Discard Changes</v-list-item-content>
      </v-list-item>

      <v-list-item
        clickable
        @click="$emit('unlink')"
      >
        <v-list-item-icon>
          <v-icon name="link_off" />
        </v-list-item-icon>
        <v-list-item-content>{{ isDeleted ? 'Remove Deleted Item' : 'Unlink' }}</v-list-item-content>
      </v-list-item>

      <v-divider v-if="allowDelete && !isDeleted" />

      <v-list-item
        v-if="allowDelete && !isDeleted"
        clickable
        class="danger"
        @click="$emit('delete')"
      >
        <v-list-item-icon>
          <v-icon name="delete" />
        </v-list-item-icon>
        <v-list-item-content>Delete</v-list-item-content>
      </v-list-item>
    </v-list>
  </v-menu>
</template>

<script setup lang="ts">
interface Props {
  allowDuplicate: boolean;
  allowDelete: boolean;
  isDirty: boolean;
  isDeleted?: boolean;
}

defineProps<Props>();

defineEmits<{
  'duplicate': [];
  'discard-changes': [];
  'unlink': [];
  'delete': [];
}>();
</script>