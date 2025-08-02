<template>
  <div class="simple-search-input">
    <input
        ref="inputRef"
        v-model="searchQuery"
        type="text"
        class="search-input-field"
        :placeholder="placeholder"
        @focus="handleFocus"
        @blur="handleBlur"
        @keydown="handleKeydown"
    />
    
    <!-- Icons -->
    <div class="input-icons">
      <!-- Search icon with result count badge -->
      <div class="search-icon-wrapper">
        <v-progress-circular v-if="loading" indeterminate x-small/>
        <v-icon v-else name="search"/>
        
        <!-- Result count badge -->
        <div v-if="showHelp && totalItems !== null && totalItems !== undefined && totalItems > 0" class="result-count-badge">
          {{ totalItems > 999 ? '999+' : totalItems }}
        </div>
      </div>
      
      <v-icon
          v-if="searchQuery"
          name="close"
          clickable
          @click="clearSearch"
      />
      
      <v-icon
          name="help_outline"
          clickable
          @click="emit('toggle-help')"
          :class="{ 'rotated': showHelp }"
      />
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, watch } from 'vue';
import { createScopedLogger } from '../utils/logger-wrapper';

// Create scoped logger for this component
const _logger = createScopedLogger('SimpleSearchInput');

interface Props {
  modelValue: string;
  placeholder?: string;
  loading?: boolean;
  showHelp?: boolean;
  availableFields?: any[];
  totalItems?: number | null;
}

const props = withDefaults(defineProps<Props>(), {
  placeholder: 'Search items...',
  loading: false,
  showHelp: false,
  availableFields: () => [],
});

const emit = defineEmits<{
  'update:modelValue': [value: string];
  'toggle-help': [];
  'focus': [];
  'blur': [];
}>();

// Local state
const inputRef = ref<HTMLInputElement>();
const searchQuery = ref(props.modelValue);

// Watch for external changes
watch(() => props.modelValue, (newValue) => {
  searchQuery.value = newValue;
});

// Watch for internal changes
watch(searchQuery, (newValue) => {
  emit('update:modelValue', newValue);
});

// Methods
function handleFocus() {
  emit('focus');
}

function handleBlur() {
  emit('blur');
}

function handleKeydown(event: KeyboardEvent) {
  if (event.key === 'Escape') {
    clearSearch();
  }
}

function clearSearch() {
  searchQuery.value = '';
  inputRef.value?.focus();
}

function focusInput() {
  inputRef.value?.focus();
}

// Public methods for adding fields/operators at cursor position
function addFieldToSearch(field: string) {
  if (!inputRef.value) return;
  
  const start = inputRef.value.selectionStart || 0;
  const end = inputRef.value.selectionEnd || 0;
  const text = searchQuery.value;
  
  // Insert field with = at cursor position
  const newText = text.slice(0, start) + field + '=' + text.slice(end);
  searchQuery.value = newText;
  
  // Set cursor after the =
  const newPosition = start + field.length + 1;
  inputRef.value.focus();
  inputRef.value.setSelectionRange(newPosition, newPosition);
}

function addOperatorToSearch(operator: string) {
  if (!inputRef.value) return;
  
  const start = inputRef.value.selectionStart || 0;
  const end = inputRef.value.selectionEnd || 0;
  const text = searchQuery.value;
  
  // Insert operator at cursor position
  const newText = text.slice(0, start) + operator + text.slice(end);
  searchQuery.value = newText;
  
  // Set cursor after the operator
  const newPosition = start + operator.length;
  inputRef.value.focus();
  inputRef.value.setSelectionRange(newPosition, newPosition);
}

function addLogicalOperator(op: 'AND' | 'OR') {
  if (!inputRef.value) return;
  
  const start = inputRef.value.selectionStart || 0;
  const end = inputRef.value.selectionEnd || 0;
  const text = searchQuery.value;
  
  // Add spaces around operator if needed
  let prefix = start > 0 && text[start - 1] !== ' ' ? ' ' : '';
  let suffix = end < text.length && text[end] !== ' ' ? ' ' : '';
  
  // Insert logical operator at cursor position
  const newText = text.slice(0, start) + prefix + op + suffix + text.slice(end);
  searchQuery.value = newText;
  
  // Set cursor after the operator
  const newPosition = start + prefix.length + op.length + suffix.length;
  inputRef.value.focus();
  inputRef.value.setSelectionRange(newPosition, newPosition);
}

// Expose methods for parent component
defineExpose({
  addFieldToSearch,
  addOperatorToSearch,
  addLogicalOperator,
  focusInput,
});
</script>

<style lang="scss" scoped>
.simple-search-input {
  position: relative;
  width: 100%;
  display: flex;
  align-items: center;
}

.search-input-field {
  flex: 1;
  padding: 10px 12px;
  padding-right: 100px; /* Space for icons */
  background-color: var(--theme--form--field--input--background);
  border: 1px solid var(--theme--form--field--input--border-color);
  border-radius: var(--theme--border-radius);
  font-size: 14px;
  color: var(--theme--foreground);
  transition: border-color 0.2s;
  
  &:hover {
    border-color: var(--theme--form--field--input--border-color-hover);
  }
  
  &:focus {
    outline: none;
    border-color: var(--theme--primary);
  }
  
  &::placeholder {
    color: var(--theme--foreground-subdued);
  }
}

.input-icons {
  position: absolute;
  right: 8px;
  display: flex;
  align-items: center;
  gap: 8px;
  
  .search-icon-wrapper {
    position: relative;
    display: flex;
    align-items: center;
    
    .result-count-badge {
      position: absolute;
      top: -8px;
      right: -8px;
      background-color: var(--danger);
      color: white;
      font-size: 10px;
      font-weight: 600;
      padding: 2px 4px;
      border-radius: 10px;
      min-width: 16px;
      height: 16px;
      display: flex;
      align-items: center;
      justify-content: center;
      line-height: 1;
      box-shadow: 0 2px 4px rgba(0, 0, 0, 0.2);
      z-index: 1;
    }
  }
  
  .v-icon {
    color: var(--theme--foreground-subdued);
    cursor: pointer;
    transition: transform 0.2s;
    
    &:hover {
      color: var(--theme--foreground);
    }
    
    &.rotated {
      transform: rotate(180deg);
    }
  }
}
</style>