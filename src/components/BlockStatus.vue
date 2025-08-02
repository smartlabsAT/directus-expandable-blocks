<template>
  <div v-if="!compactMode">
    <!-- Placeholder for no permission blocks -->
    <div
      v-if="!hasStatus"
      class="status-display status-readonly status-placeholder"
    >
      <span class="status-dot status-unknown" />
      <span class="status-text">{{ statusLabel }}</span>
    </div>
    
    <!-- Status display only (no dropdown) when change not allowed -->
    <div
      v-else-if="!allowChange"
      class="status-display status-readonly"
      v-tooltip.top="'You do not have permission to change status'"
    >
      <span class="status-dot" :class="`status-${currentStatus}`" />
      <span class="status-text">{{ statusLabel }}</span>
    </div>
    
    <!-- Status dropdown menu when change is allowed -->
    <v-menu
      v-else
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
  </div>
</template>

<script setup lang="ts">
interface Props {
  hasStatus: boolean;
  compactMode: boolean;
  currentStatus: string;
  statusLabel: string;
  statuses: Array<{ value: string; label: string }>;
  allowChange?: boolean;
}

withDefaults(defineProps<Props>(), {
  allowChange: true
});

defineEmits<{
  'update-status': [status: string];
}>();
</script>

