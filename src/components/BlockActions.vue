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
        v-if="allowDuplicate"
        clickable
        @click="$emit('duplicate')"
      >
        <v-list-item-icon>
          <v-icon name="content_copy" />
        </v-list-item-icon>
        <v-list-item-content>Duplicate</v-list-item-content>
      </v-list-item>

      <v-list-item
        clickable
        :disabled="!isDirty"
        @click="$emit('discard-changes')"
      >
        <v-list-item-icon>
          <v-icon name="undo" />
        </v-list-item-icon>
        <v-list-item-content>Discard Changes</v-list-item-content>
      </v-list-item>

      <v-divider v-if="allowDelete" />

      <v-list-item
        v-if="allowDelete"
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
}

defineProps<Props>();

defineEmits<{
  'duplicate': [];
  'discard-changes': [];
  'delete': [];
}>();
</script>

<style lang="scss" scoped>
.danger {
  --v-list-item-color: var(--danger);
  --v-list-item-color-hover: var(--danger);
  --v-list-item-icon-color: var(--danger);
}
</style>