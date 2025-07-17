<template>
  <v-menu
    v-if="hasStatus && !compactMode"
    placement="bottom"
    show-arrow
  >
    <template #activator="{ toggle }">
      <div
        class="status-display"
        @click.stop="toggle"
      >
        <span class="status-dot" :class="`status-${currentStatus}`" />
        <span class="status-text">{{ statusLabel }}</span>
      </div>
    </template>

    <v-list>
      <v-list-item
        v-for="status in statuses"
        :key="status.value"
        :active="currentStatus === status.value"
        clickable
        @click="$emit('update-status', status.value)"
      >
        <v-list-item-icon>
          <span class="status-dot" :class="`status-${status.value}`" />
        </v-list-item-icon>
        <v-list-item-content>{{ status.label }}</v-list-item-content>
      </v-list-item>
    </v-list>
  </v-menu>
</template>

<script setup lang="ts">
interface Props {
  hasStatus: boolean;
  compactMode: boolean;
  currentStatus: string;
  statusLabel: string;
  statuses: Array<{ value: string; label: string }>;
}

defineProps<Props>();

defineEmits<{
  'update-status': [status: string];
}>();
</script>

<style lang="scss" scoped>
/* Styles are defined in interface.scss */
</style>