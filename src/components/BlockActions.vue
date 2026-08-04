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
        <v-list-item-content>
          <div>Duplicate</div>
          <div class="action-description">Create a copy of this block</div>
        </v-list-item-content>
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
        <v-list-item-content>
          <div>Discard Changes</div>
          <div class="action-description">Revert to last saved state</div>
        </v-list-item-content>
      </v-list-item>

      <v-list-item
        clickable
        @click="$emit('unlink')"
      >
        <v-list-item-icon>
          <v-icon name="link_off" />
        </v-list-item-icon>
        <v-list-item-content>
          <div>{{ isDeleted ? 'Remove Reference' : 'Unassign' }}</div>
          <div class="action-description">{{ isDeleted ? 'Remove this deleted reference' : 'Remove from this page only' }}</div>
        </v-list-item-content>
      </v-list-item>

      <v-divider v-if="allowDelete && !isDeleted && !isNew" />

      <v-list-item
        v-if="allowDelete && !isDeleted && !isNew"
        clickable
        class="danger"
        @click="$emit('delete')"
      >
        <v-list-item-icon>
          <v-icon name="delete" />
        </v-list-item-icon>
        <v-list-item-content>
          <div>Delete Everywhere</div>
          <div class="action-description">Delete item and all references</div>
        </v-list-item-content>
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
  isNew?: boolean;
}

defineProps<Props>();

defineEmits<{
  'duplicate': [];
  'discard-changes': [];
  'unlink': [];
  'delete': [];
}>();
</script>

<style scoped lang="scss">
.action-description {
  font-size: 12px;
  color: var(--theme--foreground-subdued);
  margin-top: 2px;
}

.danger .action-description {
  color: var(--danger-75);
}

/* Fix padding for disabled items specifically in this menu */
:deep(.v-list-item[disabled]) {
  .v-list-item-content {
    /* Override the default padding to match enabled items */
    padding: 0 !important;
    opacity: 0.5;
  }
}
</style>