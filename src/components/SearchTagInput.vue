<template>
  <div class="search-tag-input">
    <div class="tag-input-container" @click="handleContainerClick">
      <!-- Default logical operator indicator -->
      <v-chip
          v-if="defaultLogicalOp && searchTags.length === 0"
          x-small
          label
          class="default-logical-op"
          :class="defaultLogicalOp === 'AND' ? 'and-op' : 'or-op'"
      >
        {{ defaultLogicalOp }}
      </v-chip>
      
      <!-- Search Tags -->
      <v-menu
          v-for="(tag, index) in searchTags"
          :key="index"
          :model-value="editingTagIndex === index"
          @update:model-value="(val) => editingTagIndex = val ? index : null"
          :close-on-content-click="false"
          placement="bottom"
      >
        <template #activator="{ toggle }">
          <v-chip
              x-small
              label
              :close="tag.type === 'search'"
              :class="['search-tag', tag.type === 'logical' ? 'logical-tag' : '']"
              @close="removeTag(index)"
              @dblclick="tag.type === 'search' && startEditTag(index)"
              v-tooltip="tag.type === 'search' ? 'Double-click to edit' : ''"
          >
            <template v-if="tag.type === 'search'">
              <span class="tag-field">{{ tag.field }}</span>
              <span class="tag-operator">{{ tag.operatorDisplay }}</span>
              <span class="tag-value">{{ tag.value }}</span>
            </template>
            <template v-else-if="tag.type === 'logical'">
              <strong>{{ tag.logicalOp }}</strong>
            </template>
          </v-chip>
        </template>
        
        <div v-if="tag.type === 'search'" class="tag-edit-popover" @click.stop>
          <div class="edit-section">
            <label>Field:</label>
            <v-select
                v-model="editField"
                :items="availableFieldItems"
                placeholder="Select field"
            />
          </div>
          <div class="edit-section">
            <label>Operator:</label>
            <v-select
                v-model="editOperator"
                :items="operatorItems"
                placeholder="Select operator"
            />
          </div>
          <div class="edit-section">
            <label>Value:</label>
            <v-input
                v-model="editValue"
                placeholder="Enter value"
            />
          </div>
          <div class="edit-actions">
            <v-button x-small secondary @click="cancelEdit">Cancel</v-button>
            <v-button x-small @click="saveEdit(index)">Save</v-button>
          </div>
        </div>
      </v-menu>

      <!-- Input Field -->
      <input
          ref="inputRef"
          v-model="currentInput"
          type="text"
          class="tag-input"
          :placeholder="getPlaceholder()"
          @keydown="handleKeydown"
          @input="handleInput"
          @focus="emit('focus')"
          @blur="emit('blur')"
      />

      <!-- Icons -->
      <div class="input-icons">
        <v-progress-circular v-if="loading" indeterminate x-small />
        <v-icon v-else name="search" />
        
        <v-icon
            v-if="searchTags.length > 0 || currentInput"
            name="close"
            clickable
            @click="clearAll"
        />
        
        <v-icon
            name="help_outline"
            clickable
            @click="emit('toggle-help')"
            :class="{ 'rotated': showHelp }"
        />
      </div>
    </div>

    <!-- Autocomplete Dropdown -->
    <transition name="fade">
      <div v-if="showAutocomplete && suggestions.length > 0" class="autocomplete-dropdown">
        <div
            v-for="(suggestion, index) in suggestions"
            :key="index"
            class="suggestion-item"
            :class="{ active: selectedSuggestionIndex === index }"
            @click="selectSuggestion(suggestion)"
        >
          <v-icon name="text_fields" x-small />
          <span class="suggestion-field">{{ suggestion.field }}</span>
          <span class="suggestion-hint">{{ suggestion.type }}</span>
        </div>
      </div>
    </transition>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, watch, nextTick } from 'vue';
import { createScopedLogger } from '../utils/logger-wrapper';

// Create scoped logger for this component
const logger = createScopedLogger('SearchTagInput');

interface SearchTag {
  type: 'search' | 'logical';
  field?: string;
  operator?: string;
  operatorDisplay?: string;
  value?: string;
  logicalOp?: 'AND' | 'OR';
  raw: string;
}

interface Suggestion {
  field: string;
  type: string;
}

interface Props {
  modelValue: string;
  placeholder?: string;
  loading?: boolean;
  showHelp?: boolean;
  availableFields?: any[];
}

const props = withDefaults(defineProps<Props>(), {
  placeholder: 'Search items...',
  loading: false,
  showHelp: false,
  availableFields: () => []
});

const emit = defineEmits<{
  'update:modelValue': [value: string];
  'toggle-help': [];
  'focus': [];
  'blur': [];
  'tag-added': [tag: SearchTag];
  'tag-removed': [tag: SearchTag, index: number];
}>();

// State
const inputRef = ref<HTMLInputElement>();
const currentInput = ref('');
const searchTags = ref<SearchTag[]>([]);
const showAutocomplete = ref(false);
const selectedSuggestionIndex = ref(-1);

// Edit popover state
const editingTagIndex = ref<number | null>(null);
const editField = ref('');
const editOperator = ref('');
const editValue = ref('');

// Operator mappings
const operators = {
  '=%': { display: ' contains ', filter: '_contains' },
  '!~': { display: ' not contains ', filter: '_ncontains' },
  '=': { display: ' = ', filter: '_eq' },
  '~': { display: ' ~ ', filter: '_contains' },
  '!=': { display: ' ≠ ', filter: '_neq' },
  '>': { display: ' > ', filter: '_gt' },
  '<': { display: ' < ', filter: '_lt' },
  '>=': { display: ' ≥ ', filter: '_gte' },
  '<=': { display: ' ≤ ', filter: '_lte' },
  '^': { display: ' starts with ', filter: '_starts_with' },
  '$': { display: ' ends with ', filter: '_ends_with' },
  'empty': { display: ' is empty ', filter: '_empty' },
  '!empty': { display: ' not empty ', filter: '_nempty' },
  'null': { display: ' is null ', filter: '_null' },
  '!null': { display: ' not null ', filter: '_nnull' }
};

// Sort operators by length (longest first) to avoid conflicts
const sortedOperators = Object.keys(operators).sort((a, b) => b.length - a.length);

// Computed
const suggestions = computed((): Suggestion[] => {
  if (!currentInput.value || currentInput.value.includes('=') || currentInput.value.includes('~')) {
    return [];
  }

  const input = currentInput.value.toLowerCase();
  return props.availableFields
      .filter(field => field.field.toLowerCase().includes(input))
      .map(field => ({
        field: field.field,
        type: field.type || 'text'
      }))
      .slice(0, 5);
});

const availableFieldItems = computed(() => {
  return props.availableFields.map(field => ({
    text: field.name || field.field,
    value: field.field
  }));
});

const operatorItems = computed(() => {
  return Object.entries(operators).map(([key, config]) => ({
    text: `${key} - ${config.display.trim()}`,
    value: key
  }));
});

const searchQuery = computed(() => {
  const parts: string[] = [];
  
  searchTags.value.forEach(tag => {
    if (tag.type === 'search') {
      parts.push(tag.raw);
    } else if (tag.type === 'logical') {
      parts.push(tag.logicalOp || '');
    }
  });
  
  if (currentInput.value) {
    parts.push(currentInput.value);
  }
  
  return parts.join(' ');
});

// Helper to show hints
const showHint = computed(() => {
  return searchTags.value.length === 0 && currentInput.value.includes('~');
});

// Get dynamic placeholder
function getPlaceholder(): string {
  if (searchTags.value.length === 0) {
    if (defaultLogicalOp.value) {
      return `Next items will be combined with ${defaultLogicalOp.value}`;
    }
    if (showHint.value) {
      return 'Press Enter to create tag';
    }
    return props.placeholder;
  }
  return '';
}

// Watch for external changes
watch(() => props.modelValue, (newValue) => {
  if (newValue !== searchQuery.value) {
    parseExistingQuery(newValue);
  }
});

// Methods
function focusInput() {
  inputRef.value?.focus();
}

function handleContainerClick(event: MouseEvent) {
  // Don't focus input if clicking inside the popover
  if (editingTagIndex.value !== null) {
    return;
  }
  focusInput();
}

function handleKeydown(event: KeyboardEvent) {
  if (event.key === 'Enter') {
    event.preventDefault();
    if (selectedSuggestionIndex.value >= 0) {
      selectSuggestion(suggestions.value[selectedSuggestionIndex.value]);
    } else {
      parseAndAddTag();
    }
  } else if (event.key === 'Backspace' && !currentInput.value && searchTags.value.length > 0) {
    removeTag(searchTags.value.length - 1);
  } else if (event.key === 'ArrowDown') {
    event.preventDefault();
    selectedSuggestionIndex.value = Math.min(
        selectedSuggestionIndex.value + 1,
        suggestions.value.length - 1
    );
  } else if (event.key === 'ArrowUp') {
    event.preventDefault();
    selectedSuggestionIndex.value = Math.max(selectedSuggestionIndex.value - 1, -1);
  } else if (event.key === 'Escape') {
    showAutocomplete.value = false;
    selectedSuggestionIndex.value = -1;
  }
}

function handleInput() {
  showAutocomplete.value = true;
  selectedSuggestionIndex.value = -1;
  updateModelValue();
}

function selectSuggestion(suggestion: Suggestion) {
  currentInput.value = suggestion.field + '=';
  showAutocomplete.value = false;
  selectedSuggestionIndex.value = -1;
  inputRef.value?.focus();
}

function parseAndAddTag() {
  const input = currentInput.value.trim();
  if (!input) return;

  // Check if input is a logical operator
  if (input === 'AND' || input === 'OR') {
    addLogicalOperator(input as 'AND' | 'OR');
    currentInput.value = '';
    return;
  }
  
  // If we have a default logical operator and this is not the first tag,
  // add the logical operator before the new tag
  if (defaultLogicalOp.value && searchTags.value.length > 0) {
    const lastTag = searchTags.value[searchTags.value.length - 1];
    if (lastTag.type !== 'logical') {
      const logicalTag: SearchTag = {
        type: 'logical',
        logicalOp: defaultLogicalOp.value,
        raw: defaultLogicalOp.value
      };
      searchTags.value.push(logicalTag);
    }
  }

  // Check for operator patterns (longest first)
  for (const op of sortedOperators) {
    const config = operators[op];
    const regex = new RegExp(`^([^${op}]+)${op.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}(.+)$`);
    const match = input.match(regex);
    
    if (match) {
      const [, field, value] = match;
      const tag: SearchTag = {
        type: 'search',
        field: field.trim(),
        operator: op,
        operatorDisplay: config.display,
        value: value.trim(),
        raw: input
      };
      
      searchTags.value.push(tag);
      emit('tag-added', tag);
      currentInput.value = '';
      updateModelValue();
      return;
    }
  }

  // If no operator found, treat as general search
  const tag: SearchTag = {
    type: 'search',
    field: '',
    operator: '',
    operatorDisplay: '',
    value: input,
    raw: input
  };
  
  searchTags.value.push(tag);
  emit('tag-added', tag);
  currentInput.value = '';
  updateModelValue();
}

function removeTag(index: number) {
  const removed = searchTags.value.splice(index, 1)[0];
  emit('tag-removed', removed, index);
  updateModelValue();
}

function clearAll() {
  searchTags.value = [];
  currentInput.value = '';
  defaultLogicalOp.value = null;
  updateModelValue();
}

function startEditTag(index: number) {
  const tag = searchTags.value[index];
  if (tag.type === 'search') {
    editField.value = tag.field || '';
    editOperator.value = tag.operator || '';
    editValue.value = tag.value || '';
    editingTagIndex.value = index;
    
    // Blur the main input to allow focus in popover
    if (inputRef.value) {
      inputRef.value.blur();
    }
  }
}

function saveEdit(index: number) {
  const tag = searchTags.value[index];
  if (tag.type === 'search' && editField.value && editOperator.value) {
    tag.field = editField.value;
    tag.operator = editOperator.value;
    tag.operatorDisplay = operators[editOperator.value]?.display || editOperator.value;
    tag.value = editValue.value;
    tag.raw = `${editField.value}${editOperator.value}${editValue.value}`;
    
    updateModelValue();
    editingTagIndex.value = null;
  }
}

function cancelEdit() {
  editingTagIndex.value = null;
  editField.value = '';
  editOperator.value = '';
  editValue.value = '';
}

function updateModelValue() {
  emit('update:modelValue', searchQuery.value);
}

function parseExistingQuery(query: string) {
  // Parse existing query into tags
  searchTags.value = [];
  
  if (!query) {
    currentInput.value = '';
    return;
  }
  
  // Split by spaces but keep AND/OR as separate tokens
  const tokens = query.split(/\s+/);
  let pendingInput = '';
  
  for (const token of tokens) {
    if (token === 'AND' || token === 'OR') {
      // First add any pending input as a search tag
      if (pendingInput.trim()) {
        parseAndAddTag();
      }
      // Then add the logical operator
      if (searchTags.value.length > 0) {
        const lastTag = searchTags.value[searchTags.value.length - 1];
        if (lastTag.type !== 'logical') {
          searchTags.value.push({
            type: 'logical',
            logicalOp: token as 'AND' | 'OR',
            raw: token
          });
        }
      }
      pendingInput = '';
    } else {
      pendingInput += (pendingInput ? ' ' : '') + token;
    }
  }
  
  // Set any remaining input
  currentInput.value = pendingInput;
}

// Helper functions for intelligent replacement
function getFieldAtCursor(): { field: string; start: number; end: number; hasOperator?: boolean } | null {
  if (!inputRef.value) return null;
  
  const cursorPos = inputRef.value.selectionStart || 0;
  const text = currentInput.value;
  
  // Find word boundaries around cursor
  let start = cursorPos;
  let end = cursorPos;
  
  // Find start of field (go back until we hit space or start)
  while (start > 0 && /\w/.test(text[start - 1])) {
    start--;
  }
  
  // Find end of field (go forward until we hit operator or end)
  while (end < text.length && /\w/.test(text[end])) {
    end++;
  }
  
  // Check if we found a field
  if (start < end) {
    // Check if there's an operator after the field
    let hasOperator = false;
    for (const op of sortedOperators) {
      if (text.substring(end, end + op.length) === op) {
        hasOperator = true;
        break;
      }
    }
    
    return {
      field: text.substring(start, end),
      start,
      end,
      hasOperator
    };
  }
  
  return null;
}

function getOperatorAfterPosition(position: number): { operator: string; start: number; end: number } | null {
  const text = currentInput.value;
  
  // Check all operators to see if any starts at this position (longest first)
  for (const op of sortedOperators) {
    if (text.substring(position, position + op.length) === op) {
      return {
        operator: op,
        start: position,
        end: position + op.length
      };
    }
  }
  
  return null;
}

function getOperatorBeforeCursor(): { operator: string; start: number; end: number } | null {
  if (!inputRef.value) return null;
  
  const cursorPos = inputRef.value.selectionStart || 0;
  const text = currentInput.value;
  
  // Check if cursor is right after an operator
  for (const op of sortedOperators) {
    const opLength = op.length;
    if (cursorPos >= opLength) {
      const possibleOp = text.substring(cursorPos - opLength, cursorPos);
      if (possibleOp === op) {
        return {
          operator: op,
          start: cursorPos - opLength,
          end: cursorPos
        };
      }
    }
  }
  
  return null;
}

function getFieldBeforeOperator(operatorStart: number): { field: string; start: number; end: number } | null {
  const text = currentInput.value;
  let end = operatorStart;
  let start = end;
  
  // Skip any whitespace before operator
  while (start > 0 && /\s/.test(text[start - 1])) {
    start--;
  }
  end = start;
  
  // Find start of field
  while (start > 0 && /\w/.test(text[start - 1])) {
    start--;
  }
  
  if (start < end) {
    return {
      field: text.substring(start, end),
      start,
      end
    };
  }
  
  return null;
}

function getOperatorAtCursor(): { operator: string; start: number; end: number } | null {
  if (!inputRef.value) return null;
  
  const cursorPos = inputRef.value.selectionStart || 0;
  const text = currentInput.value;
  
  // Check all operators (longest first)
  for (const op of sortedOperators) {
    // Check if operator is at or just before cursor
    const opLength = op.length;
    
    // Check if cursor is right after operator
    if (cursorPos >= opLength) {
      const possibleOp = text.substring(cursorPos - opLength, cursorPos);
      if (possibleOp === op) {
        return {
          operator: op,
          start: cursorPos - opLength,
          end: cursorPos
        };
      }
    }
    
    // Check if cursor is within operator
    for (let i = 0; i < opLength; i++) {
      const start = cursorPos - i;
      if (start >= 0 && start + opLength <= text.length) {
        const possibleOp = text.substring(start, start + opLength);
        if (possibleOp === op) {
          return {
            operator: op,
            start,
            end: start + opLength
          };
        }
      }
    }
  }
  
  return null;
}

// Public methods
function addFieldToSearch(field: string) {
  // First check if cursor is right after an operator
  const operatorBeforeCursor = getOperatorBeforeCursor();
  if (operatorBeforeCursor) {
    // Find and replace the field before this operator
    const fieldBeforeOp = getFieldBeforeOperator(operatorBeforeCursor.start);
    if (fieldBeforeOp) {
      // Replace the field before the operator
      const before = currentInput.value.substring(0, fieldBeforeOp.start);
      const after = currentInput.value.substring(operatorBeforeCursor.end);
      currentInput.value = before + field + operatorBeforeCursor.operator + after;
      
      // Set cursor after the operator
      nextTick(() => {
        if (inputRef.value) {
          const newPos = fieldBeforeOp.start + field.length + operatorBeforeCursor.operator.length;
          inputRef.value.setSelectionRange(newPos, newPos);
        }
      });
      focusInput();
      return;
    }
  }
  
  // Original logic for other cases
  const fieldInfo = getFieldAtCursor();
  
  if (fieldInfo) {
    // Replace existing field
    const before = currentInput.value.substring(0, fieldInfo.start);
    const after = currentInput.value.substring(fieldInfo.end);
    
    // Only add = if there's no operator already
    const needsOperator = !fieldInfo.hasOperator;
    currentInput.value = before + field + (needsOperator ? '=' : '') + after;
    
    // Set cursor after the field (and = if added)
    nextTick(() => {
      if (inputRef.value) {
        const newPos = fieldInfo.start + field.length + (needsOperator ? 1 : 0);
        inputRef.value.setSelectionRange(newPos, newPos);
      }
    });
  } else {
    // Add new field at cursor or end
    if (inputRef.value) {
      const cursorPos = inputRef.value.selectionStart || currentInput.value.length;
      const before = currentInput.value.substring(0, cursorPos);
      const after = currentInput.value.substring(cursorPos);
      
      // Add space if needed
      const prefix = before.length > 0 && !before.endsWith(' ') ? ' ' : '';
      currentInput.value = before + prefix + field + '=' + after;
      
      // Set cursor after the =
      nextTick(() => {
        if (inputRef.value) {
          const newPos = cursorPos + prefix.length + field.length + 1;
          inputRef.value.setSelectionRange(newPos, newPos);
        }
      });
    } else {
      currentInput.value = field + '=';
    }
  }
  
  focusInput();
}

// Track default logical operator
const defaultLogicalOp = ref<'AND' | 'OR' | null>(null);

function addLogicalOperator(op: 'AND' | 'OR') {
  logger.debug('addLogicalOperator called', { op, currentTags: searchTags.value });
  
  // If no tags yet, set as default for next operation
  if (searchTags.value.length === 0) {
    if (defaultLogicalOp.value === op) {
      // Toggle off if clicking the same operator
      defaultLogicalOp.value = null;
    } else {
      defaultLogicalOp.value = op;
    }
    logger.debug('Set default logical operator', { defaultLogicalOp: defaultLogicalOp.value });
    
    // Clear input and focus
    currentInput.value = '';
    focusInput();
    updateModelValue();
    return;
  }
  
  const lastTag = searchTags.value[searchTags.value.length - 1];
  if (lastTag.type === 'logical') {
    // Replace existing logical operator
    lastTag.logicalOp = op;
    lastTag.raw = op;
    updateModelValue();
    return;
  }
  
  // Add logical operator tag
  const tag: SearchTag = {
    type: 'logical',
    logicalOp: op,
    raw: op
  };
  
  logger.debug('Adding logical tag', { tag });
  searchTags.value.push(tag);
  updateModelValue();
  focusInput();
}

function addOperatorToSearch(operator: string) {
  // First check if cursor is within a field
  const fieldInfo = getFieldAtCursor();
  if (fieldInfo) {
    // Cursor is in a field, so we want to add/replace operator after the field
    const operatorAfterField = getOperatorAfterPosition(fieldInfo.end);
    
    if (operatorAfterField) {
      // Replace existing operator after field
      const before = currentInput.value.substring(0, operatorAfterField.start);
      const after = currentInput.value.substring(operatorAfterField.end);
      currentInput.value = before + operator + after;
      
      // Set cursor after the operator
      nextTick(() => {
        if (inputRef.value) {
          const newPos = operatorAfterField.start + operator.length;
          inputRef.value.setSelectionRange(newPos, newPos);
        }
      });
    } else {
      // Add operator after field
      const before = currentInput.value.substring(0, fieldInfo.end);
      const after = currentInput.value.substring(fieldInfo.end);
      currentInput.value = before + operator + after;
      
      // Set cursor after the operator
      nextTick(() => {
        if (inputRef.value) {
          const newPos = fieldInfo.end + operator.length;
          inputRef.value.setSelectionRange(newPos, newPos);
        }
      });
    }
  } else {
    // Not in a field, check if cursor is at an operator
    const operatorInfo = getOperatorAtCursor();
    
    if (operatorInfo) {
      // Replace existing operator
      const before = currentInput.value.substring(0, operatorInfo.start);
      const after = currentInput.value.substring(operatorInfo.end);
      currentInput.value = before + operator + after;
      
      // Set cursor after the operator
      nextTick(() => {
        if (inputRef.value) {
          const newPos = operatorInfo.start + operator.length;
          inputRef.value.setSelectionRange(newPos, newPos);
        }
      });
    } else {
      // Add operator at cursor position
      if (inputRef.value) {
        const cursorPos = inputRef.value.selectionStart || currentInput.value.length;
        const before = currentInput.value.substring(0, cursorPos);
        const after = currentInput.value.substring(cursorPos);
        currentInput.value = before + operator + after;
        
        // Set cursor after the operator
        nextTick(() => {
          if (inputRef.value) {
            const newPos = cursorPos + operator.length;
            inputRef.value.setSelectionRange(newPos, newPos);
          }
        });
      } else {
        currentInput.value += operator;
      }
    }
  }
  
  focusInput();
}

defineExpose({
  addFieldToSearch,
  addOperatorToSearch,
  addLogicalOperator,
  focusInput,
  defaultLogicalOp
});
</script>

<style lang="scss" scoped>
.search-tag-input {
  position: relative;
  width: 100%;
}

.tag-input-container {
  display: flex;
  align-items: center;
  flex-wrap: wrap;
  gap: 4px;
  padding: 4px 8px;
  min-height: 44px;
  background-color: var(--theme--form--field--input--background);
  border: 1px solid var(--theme--form--field--input--border-color);
  border-radius: var(--theme--border-radius);
  cursor: text;
  transition: border-color 0.2s;

  &:hover {
    border-color: var(--theme--form--field--input--border-color-hover);
  }

  &:focus-within {
    border-color: var(--theme--primary);
  }
}

.search-tag {
  max-width: 200px;
  height: 24px;
  background-color: var(--theme--primary-background);
  border: 1px solid var(--theme--primary-subdued);
  
  .tag-field {
    font-weight: 600;
    color: var(--theme--primary);
  }
  
  .tag-operator {
    color: var(--theme--foreground-subdued);
    margin: 0 2px;
  }
  
  .tag-value {
    color: var(--theme--foreground);
  }

  :deep(.v-icon) {
    margin-left: 4px;
    color: var(--theme--foreground-subdued);
    
    &:hover {
      color: var(--theme--danger);
    }
  }
}

.logical-tag {
  background-color: var(--theme--form--field--input--background-subdued);
  border: 1px solid var(--theme--border-color);
  font-weight: 600;
  
  strong {
    color: var(--theme--primary);
    text-transform: uppercase;
    font-size: 11px;
    letter-spacing: 0.05em;
  }
}

.default-logical-op {
  margin-right: 4px;
  font-weight: 600;
  font-size: 11px;
  letter-spacing: 0.05em;
  text-transform: uppercase;
  
  &.and-op {
    background-color: var(--theme--success-background);
    color: var(--theme--success);
    border: 1px solid var(--theme--success);
  }
  
  &.or-op {
    background-color: var(--theme--info-background);
    color: var(--theme--info);
    border: 1px solid var(--theme--info);
  }
}

.tag-input {
  flex: 1;
  min-width: 120px;
  border: none;
  background: none;
  outline: none;
  font-size: 14px;
  color: var(--theme--foreground);
  
  &::placeholder {
    color: var(--theme--foreground-subdued);
  }
}

.input-icons {
  display: flex;
  align-items: center;
  gap: 8px;
  margin-left: auto;
  flex-shrink: 0;
  
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

.autocomplete-dropdown {
  position: absolute;
  top: 100%;
  left: 0;
  right: 0;
  margin-top: 4px;
  background-color: var(--theme--background);
  border: 1px solid var(--theme--form--field--input--border-color);
  border-radius: var(--theme--border-radius);
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.1);
  z-index: 10;
  max-height: 200px;
  overflow-y: auto;
}

.suggestion-item {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 8px 12px;
  cursor: pointer;
  transition: background-color 0.2s;
  
  &:hover,
  &.active {
    background-color: var(--theme--form--field--input--background-subdued);
  }
  
  .v-icon {
    color: var(--theme--foreground-subdued);
  }
  
  .suggestion-field {
    flex: 1;
    font-weight: 500;
  }
  
  .suggestion-hint {
    font-size: 12px;
    color: var(--theme--foreground-subdued);
  }
}

.fade-enter-active,
.fade-leave-active {
  transition: opacity 0.2s;
}

.fade-enter-from,
.fade-leave-to {
  opacity: 0;
}

/* Tag edit popover styles */
.tag-edit-popover {
  padding: 16px;
  min-width: 280px;
  background: var(--theme--background);
  border-radius: var(--theme--border-radius);
  
  .edit-section {
    margin-bottom: 12px;
    
    &:last-child {
      margin-bottom: 16px;
    }
    
    label {
      display: block;
      margin-bottom: 4px;
      font-size: 12px;
      font-weight: 600;
      color: var(--theme--foreground-subdued);
      text-transform: uppercase;
      letter-spacing: 0.05em;
    }
  }
  
  .edit-actions {
    display: flex;
    gap: 8px;
    justify-content: flex-end;
    padding-top: 12px;
    border-top: 1px solid var(--theme--border-subdued);
  }
}
</style>