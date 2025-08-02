<template>
  <div class="search-tag-input" @click.self="focusedTagIndex = null">
    <div 
        ref="editableContainer"
        class="tag-input-container"
        contenteditable="true"
        @input="handleContentEditableInput"
        @keydown="handleContentEditableKeydown"
        @paste="handlePaste"
        @focus="handleContentEditableFocus"
        @blur="handleContentEditableBlur"
        @click="handleContentEditableClick"
        :data-placeholder="getPlaceholder()"
    >
      <!-- Content will be rendered programmatically -->
    </div>

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
          <v-icon name="text_fields" x-small/>
          <span class="suggestion-field">{{ suggestion.field }}</span>
          <span class="suggestion-hint">{{ suggestion.type }}</span>
        </div>
      </div>
    </transition>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, watch, nextTick, onMounted } from 'vue';
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
  totalItems?: number | null;
}


const props = withDefaults(defineProps<Props>(), {
  placeholder: 'Search items...', loading: false, showHelp: false, availableFields: () => [],
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

// Edit state
const editingValueIndex = ref<number | null>(null);
const editValue = ref('');
// Removed editValueInputs - not used

// Focus state
const focusedTagIndex = ref<number | null>(null);

// Visual cursor state
const cursorPosition = ref<number | null>(null);
const _hoveredPosition = ref<number | null>(null);

// Removed position input refs - not used

// Contenteditable refs
const editableContainer = ref<HTMLDivElement>();
const isComposing = ref(false);
const savedSelection = ref<{ node: Node | null; offset: number } | null>(null);
const insertPosition = ref<number | null>(null); // Position between tags where to insert
// Removed textInputs - not used

// Operator mappings
const operators = {
  '=%': {display: ' contains ', filter: '_contains'},
  '!~': {display: ' not contains ', filter: '_ncontains'},
  '=': {display: ' = ', filter: '_eq'},
  '~': {display: ' ~ ', filter: '_contains'},
  '!=': {display: ' ≠ ', filter: '_neq'},
  '>': {display: ' > ', filter: '_gt'},
  '<': {display: ' < ', filter: '_lt'},
  '>=': {display: ' ≥ ', filter: '_gte'},
  '<=': {display: ' ≤ ', filter: '_lte'},
  '^': {display: ' starts with ', filter: '_starts_with'},
  '$': {display: ' ends with ', filter: '_ends_with'},
  'empty': {display: ' is empty ', filter: '_empty'},
  '!empty': {display: ' not empty ', filter: '_nempty'},
  'null': {display: ' is null ', filter: '_null'},
  '!null': {display: ' not null ', filter: '_nnull'},
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
        field: field.field, type: field.type || 'text',
      }))
      .slice(0, 5);
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

// Removed getInputWidth - not used

// Watch for external changes
watch(() => props.modelValue, (newValue) => {
  if (newValue !== searchQuery.value) {
    parseExistingQuery(newValue);
  }
});

// Methods
function focusInput() {
  // Focus contenteditable container
  nextTick(() => {
    editableContainer.value?.focus();
    setCursorToEnd();
  });
}

function _calculateClosestPosition(event: MouseEvent): number {
  const container = event.currentTarget as HTMLElement;
  const rect = container.getBoundingClientRect();
  const mouseX = event.clientX - rect.left;
  
  // Find all tag positions
  const tagElements = container.querySelectorAll('.tag-with-cursor');
  const positions: { x: number; index: number }[] = [];
  
  // Add position 0 (before all tags)
  positions.push({ x: 0, index: 0 });
  
  // Add positions after each tag
  tagElements.forEach((tag, i) => {
    const tagRect = tag.getBoundingClientRect();
    const tagEndX = tagRect.right - rect.left;
    positions.push({ x: tagEndX, index: i + 1 });
  });
  
  // Find closest position to mouse
  let closestIndex = 0;
  let closestDistance = Infinity;
  
  positions.forEach(pos => {
    const distance = Math.abs(mouseX - pos.x);
    if (distance < closestDistance) {
      closestDistance = distance;
      closestIndex = pos.index;
    }
  });
  
  return closestIndex;
}

// Removed handleContainerClick - not used
// // function handleContainerClick(event: MouseEvent) {
//   // Don't focus input if editing value inline
//   if (editingValueIndex.value !== null) {
//     return;
//   }
//   
//   // Calculate and set cursor position
//   const closestIndex = calculateClosestPosition(event);
//   cursorPosition.value = closestIndex;
//   logger.debug('Cursor position set', { closestIndex, totalTags: searchTags.value.length });
//   
//   focusInput();
// }

// Removed handleMouseMove - not used
// function handleMouseMove(event: MouseEvent) {
//   // Don't update hover while editing
//   if (editingValueIndex.value !== null) {
//     return;
//   }
//   
//   // Calculate hover position
//   const closestIndex = calculateClosestPosition(event);
//   hoveredPosition.value = closestIndex;
// }

// Removed handlePositionInputBlur - not used
// function handlePositionInputBlur(position: number) {
//   // Only emit blur if we're not switching to another position input
//   setTimeout(() => {
//     const activeElement = document.activeElement;
//     const isPositionInput = activeElement?.classList.contains('position-input') || 
//                            activeElement?.classList.contains('tag-input');
//     if (!isPositionInput) {
//       emit('blur');
//     }
//   }, 100);
// }

function _handleKeydown(event: KeyboardEvent) {
  if (event.key === 'Enter') {
    event.preventDefault();
    if (focusedTagIndex.value !== null) {
      // Enter on focused tag starts inline value editing
      startEditValue(focusedTagIndex.value);
    } else if (selectedSuggestionIndex.value >= 0) {
      selectSuggestion(suggestions.value[selectedSuggestionIndex.value]);
    } else {
      parseAndAddTag();
    }
  } else if (event.key === 'Backspace' && !currentInput.value && searchTags.value.length > 0) {
    if (focusedTagIndex.value !== null) {
      // Delete focused tag
      removeTag(focusedTagIndex.value);
    } else {
      removeTag(searchTags.value.length - 1);
    }
  } else if (event.key === 'Delete' && focusedTagIndex.value !== null) {
    // Delete key removes focused tag
    removeTag(focusedTagIndex.value);
  } else if (event.key === 'Tab') {
    // Tab navigation through tags
    if (searchTags.value.length > 0) {
      event.preventDefault();
      if (event.shiftKey) {
        // Shift+Tab - go backwards
        if (focusedTagIndex.value === null || focusedTagIndex.value === 0) {
          focusedTagIndex.value = searchTags.value.length - 1;
        } else {
          focusedTagIndex.value--;
        }
      } else {
        // Tab - go forwards
        if (focusedTagIndex.value === null || focusedTagIndex.value === searchTags.value.length - 1) {
          focusedTagIndex.value = 0;
        } else {
          focusedTagIndex.value++;
        }
      }
    }
  } else if (event.key === 'ArrowDown') {
    event.preventDefault();
    selectedSuggestionIndex.value = Math.min(selectedSuggestionIndex.value + 1, suggestions.value.length - 1);
  } else if (event.key === 'ArrowUp') {
    event.preventDefault();
    selectedSuggestionIndex.value = Math.max(selectedSuggestionIndex.value - 1, -1);
  } else if (event.key === 'Escape') {
    showAutocomplete.value = false;
    selectedSuggestionIndex.value = -1;
    focusedTagIndex.value = null;
    cursorPosition.value = null;
  } else if (event.key === 'ArrowLeft' && currentInput.value === '') {
    // Move cursor left through tag positions
    event.preventDefault();
    if (cursorPosition.value === null) {
      // Start from the end
      cursorPosition.value = searchTags.value.length;
    } else if (cursorPosition.value > 0) {
      cursorPosition.value--;
    }
    focusedTagIndex.value = null; // Clear tag focus when using cursor
  } else if (event.key === 'ArrowRight' && currentInput.value === '') {
    // Move cursor right through tag positions
    event.preventDefault();
    if (cursorPosition.value === null) {
      // Start from the beginning
      cursorPosition.value = 0;
    } else if (cursorPosition.value < searchTags.value.length) {
      cursorPosition.value++;
    } else {
      // At the end, clear cursor
      cursorPosition.value = null;
    }
    focusedTagIndex.value = null; // Clear tag focus when using cursor
  } else if (event.key === 'Home' && currentInput.value === '') {
    // Jump to beginning
    event.preventDefault();
    cursorPosition.value = 0;
    focusedTagIndex.value = null;
  } else if (event.key === 'End' && currentInput.value === '') {
    // Jump to end
    event.preventDefault();
    cursorPosition.value = null;
    focusedTagIndex.value = null;
  }
}

function _handleInput() {
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

  // Determine insert position
  const insertPositionValue = insertPosition.value !== null ? insertPosition.value : searchTags.value.length;
  
  // If we have a default logical operator and need to add one
  if (defaultLogicalOp.value && insertPositionValue > 0) {
    // Check if there's already a logical operator at the position
    const prevTag = searchTags.value[insertPositionValue - 1];
    if (prevTag && prevTag.type !== 'logical') {
      const logicalTag: SearchTag = {
        type: 'logical', logicalOp: defaultLogicalOp.value, raw: defaultLogicalOp.value,
      };
      searchTags.value.splice(insertPositionValue, 0, logicalTag);
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
        type: 'search', field: field.trim(), operator: op, operatorDisplay: config.display, value: value.trim(), raw: input,
      };

      // Insert at saved position or at end
      const position = insertPositionValue;
      searchTags.value.splice(position, 0, tag);
      
      emit('tag-added', tag);
      currentInput.value = '';
      insertPosition.value = null; // Reset insert position
      updateModelValue();
      
      // Re-render and focus
      nextTick(() => {
        renderContentEditable();
        focusInput();
      });
      return;
    }
  }

  // If no operator found, treat as general search
  const tag: SearchTag = {
    type: 'search', field: '', operator: '', operatorDisplay: '', value: input, raw: input,
  };

  // Insert at saved position or at end
  const position = insertPositionValue;
  searchTags.value.splice(position, 0, tag);
  
  emit('tag-added', tag);
  currentInput.value = '';
  insertPosition.value = null; // Reset insert position
  updateModelValue();
  
  // Re-render and focus
  nextTick(() => {
    renderContentEditable();
    focusInput();
  });
}

function removeTag(index: number) {
  const removed = searchTags.value.splice(index, 1)[0];
  emit('tag-removed', removed, index);

  // Adjust focused index if needed
  if (focusedTagIndex.value !== null) {
    if (focusedTagIndex.value === index) {
      focusedTagIndex.value = null;
    } else if (focusedTagIndex.value > index) {
      focusedTagIndex.value--;
    }
  }

  // Adjust cursor position if needed
  if (cursorPosition.value !== null) {
    if (cursorPosition.value > index) {
      cursorPosition.value--;
    } else if (cursorPosition.value === searchTags.value.length + 1) {
      // If cursor was at the very end, keep it there
      cursorPosition.value = searchTags.value.length;
    }
  }

  updateModelValue();
}

function clearAll() {
  searchTags.value = [];
  currentInput.value = '';
  defaultLogicalOp.value = null;
  cursorPosition.value = null;
  focusedTagIndex.value = null;
  updateModelValue();
}

function startEditValue(index: number) {
  const tag = searchTags.value[index];
  if (tag.type === 'search') {
    editValue.value = tag.value || '';
    editingValueIndex.value = index;

    // Re-render to show input field
    renderContentEditable();
    
    // Focus the inline input after render
    nextTick(() => {
      const tagElement = editableContainer.value?.querySelector(`[data-tag-index="${index}"]`) as HTMLElement;
      if (tagElement) {
        const input = tagElement.querySelector('.inline-edit-input') as HTMLInputElement;
        if (input) {
          input.focus();
          input.select();
        }
      }
    });
  }
}

function saveEditValue(index: number) {
  const tag = searchTags.value[index];
  if (tag.type === 'search') {
    tag.value = editValue.value;
    tag.raw = `${tag.field}${tag.operator}${editValue.value}`;

    editingValueIndex.value = null;
    updateModelValue();
  }
}

function cancelEditValue() {
  editingValueIndex.value = null;
  editValue.value = '';
}

function _handleDragChange() {
  // Update model value after drag reorder
  updateModelValue();
  // Reset focused tag index as positions have changed
  focusedTagIndex.value = null;
  // Reset cursor position as tag positions have changed
  cursorPosition.value = null;
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
            type: 'logical', logicalOp: token as 'AND' | 'OR', raw: token,
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
function _getFieldAtCursor(): { field: string; start: number; end: number; hasOperator?: boolean } | null {
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
      field: text.substring(start, end), start, end, hasOperator,
    };
  }

  return null;
}

function _getOperatorAfterPosition(position: number): { operator: string; start: number; end: number } | null {
  const text = currentInput.value;

  // Check all operators to see if any starts at this position (longest first)
  for (const op of sortedOperators) {
    if (text.substring(position, position + op.length) === op) {
      return {
        operator: op, start: position, end: position + op.length,
      };
    }
  }

  return null;
}

function _getOperatorBeforeCursor(): { operator: string; start: number; end: number } | null {
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
          operator: op, start: cursorPos - opLength, end: cursorPos,
        };
      }
    }
  }

  return null;
}

function _getFieldBeforeOperator(operatorStart: number): { field: string; start: number; end: number } | null {
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
      field: text.substring(start, end), start, end,
    };
  }

  return null;
}

// Handle tag click for focusing
function handleTagClick(index: number) {
  if (searchTags.value[index].type === 'search') {
    focusedTagIndex.value = focusedTagIndex.value === index ? null : index;
    
    // Re-render to show focus state
    nextTick(() => {
      renderContentEditable();
    });
  }
}

// Handle field replacement when a tag is focused
function replaceFieldInFocusedTag(newField: string) {
  if (focusedTagIndex.value !== null && searchTags.value[focusedTagIndex.value]) {
    const tag = searchTags.value[focusedTagIndex.value];
    if (tag.type === 'search') {
      // Update the tag with new field
      tag.field = newField;
      tag.raw = `${newField}${tag.operator}${tag.value}`;
      
      // Update model and re-render
      updateModelValue();
      nextTick(() => {
        renderContentEditable();
      });
    }
  }
}

// Handle operator replacement when a tag is focused
function replaceOperatorInFocusedTag(newOperator: string) {
  if (focusedTagIndex.value !== null && searchTags.value[focusedTagIndex.value]) {
    const tag = searchTags.value[focusedTagIndex.value];
    if (tag.type === 'search') {
      // Update the tag with new operator
      tag.operator = newOperator;
      tag.operatorDisplay = operators[newOperator]?.display || newOperator;
      tag.raw = `${tag.field}${newOperator}${tag.value}`;
      
      // Update model and re-render
      updateModelValue();
      nextTick(() => {
        renderContentEditable();
      });
    }
  }
}

function _getOperatorAtCursor(): { operator: string; start: number; end: number } | null {
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
          operator: op, start: cursorPos - opLength, end: cursorPos,
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
            operator: op, start, end: start + opLength,
          };
        }
      }
    }
  }

  return null;
}

// Public methods
function addFieldToSearch(field: string) {
  // If a tag is focused, replace its field
  if (focusedTagIndex.value !== null) {
    replaceFieldInFocusedTag(field);
    updateModelValue();
    return;
  }

  // Check if we should replace existing field in current input
  const currentText = getCurrentTextAtCursor();
  
  if (currentText && currentText.includes('=')) {
    // Replace the field part before =
    const parts = currentText.split('=');
    const newText = field + '=' + parts.slice(1).join('=');
    replaceCurrentText(newText);
  } else if (currentText && sortedOperators.some(op => currentText.includes(op))) {
    // Replace field before operator
    for (const op of sortedOperators) {
      if (currentText.includes(op)) {
        const parts = currentText.split(op);
        const newText = field + op + parts.slice(1).join(op);
        replaceCurrentText(newText);
        return;
      }
    }
  } else {
    // Normal insert
    if (editableContainer.value) {
      editableContainer.value.focus();
      if (savedSelection.value) {
        restoreSelection();
      }
    }
    
    // Insert text at cursor
    document.execCommand('insertText', false, field + '=');
  }
  
  // Update current input
  extractCurrentInput();
}

// Track default logical operator
const defaultLogicalOp = ref<'AND' | 'OR' | null>(null);

function addLogicalOperator(op: 'AND' | 'OR') {
  logger.debug('addLogicalOperator called', {op, currentTags: searchTags.value});

  // If no tags yet, set as default for next operation
  if (searchTags.value.length === 0) {
    if (defaultLogicalOp.value === op) {
      // Toggle off if clicking the same operator
      defaultLogicalOp.value = null;
    } else {
      defaultLogicalOp.value = op;
    }
    logger.debug('Set default logical operator', {defaultLogicalOp: defaultLogicalOp.value});

    // Clear input and focus
    currentInput.value = '';
    renderContentEditable();
    focusInput();
    updateModelValue();
    return;
  }

  // First check if current input has content that should be converted to a tag
  if (currentInput.value.trim()) {
    parseAndAddTag();
  }

  // Add logical operator as the last tag
  const tag: SearchTag = {
    type: 'logical', logicalOp: op, raw: op,
  };

  searchTags.value.push(tag);
  updateModelValue();
  
  // Re-render and focus
  nextTick(() => {
    renderContentEditable();
    focusInput();
  });
}

function addOperatorToSearch(operator: string) {
  // If a tag is focused, replace its operator
  if (focusedTagIndex.value !== null) {
    replaceOperatorInFocusedTag(operator);
    updateModelValue();
    return;
  }

  // Check if we should replace existing operator in current input
  const currentText = getCurrentTextAtCursor();
  
  // Check if there's already an operator to replace
  let replaced = false;
  for (const existingOp of sortedOperators) {
    if (currentText.includes(existingOp)) {
      const parts = currentText.split(existingOp);
      const newText = parts[0] + operator + parts.slice(1).join(existingOp);
      replaceCurrentText(newText);
      replaced = true;
      break;
    }
  }
  
  if (!replaced) {
    // Normal insert
    if (editableContainer.value) {
      editableContainer.value.focus();
      if (savedSelection.value) {
        restoreSelection();
      }
    }
    
    // Insert text at cursor
    document.execCommand('insertText', false, operator);
  }
  
  // Update current input
  extractCurrentInput();
}

// Contenteditable functions
function renderContentEditable() {
  if (!editableContainer.value) return;
  
  // Only render tags, preserve existing text nodes
  const existingTextNodes: { [key: string]: string } = {};
  let textNodeIndex = 0;
  
  // Extract existing text before clearing
  editableContainer.value.childNodes.forEach(node => {
    if (node.nodeType === Node.TEXT_NODE && node.textContent?.trim()) {
      existingTextNodes[`text-${textNodeIndex++}`] = node.textContent;
    }
  });
  
  // Clear container
  editableContainer.value.innerHTML = '';
  
  // Add default logical op if needed
  if (defaultLogicalOp.value && searchTags.value.length === 0) {
    const defaultOpSpan = document.createElement('span');
    defaultOpSpan.className = 'default-logical-op-inline';
    defaultOpSpan.textContent = defaultLogicalOp.value;
    defaultOpSpan.contentEditable = 'false';
    editableContainer.value.appendChild(defaultOpSpan);
    editableContainer.value.appendChild(document.createTextNode(' '));
  }
  
  // Render tags only
  searchTags.value.forEach((tag, index) => {
    // Create tag element
    const tagSpan = document.createElement('span');
    tagSpan.className = tag.type === 'search' ? 'editable-tag' : 'editable-logical-tag';
    tagSpan.contentEditable = 'false';
    tagSpan.dataset.tagIndex = index.toString();
    
    if (tag.type === 'search') {
      // Add focused class if needed
      if (focusedTagIndex.value === index) {
        tagSpan.classList.add('focused');
      }
      
      if (editingValueIndex.value === index) {
        // Show inline edit input
        tagSpan.innerHTML = `
          <span class="tag-content">
            <span class="tag-field">${tag.field}</span>
            <span class="tag-operator">${tag.operatorDisplay}</span>
            <input class="inline-edit-input" value="${editValue.value}" />
          </span>
          <span class="tag-close" data-index="${index}">×</span>
        `;
        
        // Add event listeners after DOM update
        nextTick(() => {
          const input = tagSpan.querySelector('.inline-edit-input') as HTMLInputElement;
          if (input) {
            input.addEventListener('input', (e) => {
              editValue.value = (e.target as HTMLInputElement).value;
            });
            input.addEventListener('keyup', (e) => {
              if (e.key === 'Enter') {
                saveEditValue(index);
              } else if (e.key === 'Escape') {
                cancelEditValue();
              }
            });
            input.addEventListener('blur', () => {
              saveEditValue(index);
            });
          }
        });
      } else {
        tagSpan.innerHTML = `
          <span class="tag-content">
            <span class="tag-field">${tag.field}</span>
            <span class="tag-operator">${tag.operatorDisplay}</span>
            <span class="tag-value">${tag.value}</span>
          </span>
          <span class="tag-close" data-index="${index}">×</span>
        `;
      }
    } else {
      tagSpan.innerHTML = `<strong>${tag.logicalOp}</strong>`;
    }
    
    editableContainer.value.appendChild(tagSpan);
    editableContainer.value.appendChild(document.createTextNode(' '));
  });
}

function setCursorToEnd() {
  if (!editableContainer.value) return;
  
  const range = document.createRange();
  const selection = window.getSelection();
  range.selectNodeContents(editableContainer.value);
  range.collapse(false);
  selection?.removeAllRanges();
  selection?.addRange(range);
}

function saveSelection() {
  const selection = window.getSelection();
  if (selection && selection.rangeCount > 0) {
    const range = selection.getRangeAt(0);
    savedSelection.value = {
      node: range.startContainer,
      offset: range.startOffset
    };
    
    // Also determine insert position between tags
    determineInsertPosition();
  }
}

function extractCurrentInput() {
  if (!editableContainer.value) return;
  
  // Find all text nodes and combine them
  let textContent = '';
  editableContainer.value.childNodes.forEach(node => {
    if (node.nodeType === Node.TEXT_NODE) {
      textContent += node.textContent || '';
    }
  });
  
  currentInput.value = textContent.trim();
}

function getCurrentTextAtCursor(): string {
  if (!editableContainer.value) return '';
  
  const selection = window.getSelection();
  if (!selection || selection.rangeCount === 0) return currentInput.value;
  
  const range = selection.getRangeAt(0);
  const node = range.startContainer;
  
  // If we're in a text node, return its content
  if (node.nodeType === Node.TEXT_NODE) {
    return node.textContent || '';
  }
  
  return currentInput.value;
}

function replaceCurrentText(newText: string) {
  if (!editableContainer.value) return;
  
  // Clear current text and insert new
  editableContainer.value.childNodes.forEach(node => {
    if (node.nodeType === Node.TEXT_NODE) {
      node.textContent = '';
    }
  });
  
  // Insert new text
  editableContainer.value.focus();
  document.execCommand('insertText', false, newText);
}

function determineInsertPosition() {
  if (!editableContainer.value) return;
  
  const selection = window.getSelection();
  if (!selection || selection.rangeCount === 0) {
    insertPosition.value = null;
    return;
  }
  
  const range = selection.getRangeAt(0);
  const cursorNode = range.startContainer;
  
  // Find which position we're at by checking nodes before cursor
  let position = 0;
  let foundPosition = false;
  
  editableContainer.value.childNodes.forEach((node, _index) => {
    if (foundPosition) return;
    
    // Check if node is an element node (nodeType === 1)
    if (node.nodeType === Node.ELEMENT_NODE) {
      const element = node as HTMLElement;
      
      // If we found the cursor node
      if (element === cursorNode || element.contains(cursorNode)) {
        insertPosition.value = position;
        foundPosition = true;
      } else if (element.classList && (element.classList.contains('editable-tag') || element.classList.contains('editable-logical-tag'))) {
        // Count tags before cursor
        position++;
      }
    } else if (node === cursorNode) {
      // Cursor is in a text node
      insertPosition.value = position;
      foundPosition = true;
    }
  });
  
  if (!foundPosition) {
    // Cursor is at the end
    insertPosition.value = searchTags.value.length;
  }
  
  logger.debug('Determined insert position', { insertPosition: insertPosition.value, totalTags: searchTags.value.length });
}

function restoreSelection() {
  if (!savedSelection.value || !editableContainer.value) return;
  
  try {
    const range = document.createRange();
    range.setStart(savedSelection.value.node!, savedSelection.value.offset);
    range.collapse(true);
    
    const selection = window.getSelection();
    selection?.removeAllRanges();
    selection?.addRange(range);
  } catch {
    // If restore fails, set cursor to end
    setCursorToEnd();
  }
}

function _insertTextAtCursor(text: string) {
  editableContainer.value?.focus();
  
  const selection = window.getSelection();
  if (!selection || selection.rangeCount === 0) {
    // No selection, append to end
    currentInput.value += text;
    renderContentEditable();
    setCursorToEnd();
    return;
  }
  
  const range = selection.getRangeAt(0);
  range.deleteContents();
  
  // Insert text node
  const textNode = document.createTextNode(text);
  range.insertNode(textNode);
  
  // Move cursor after inserted text
  range.setStartAfter(textNode);
  range.setEndAfter(textNode);
  selection.removeAllRanges();
  selection.addRange(range);
  
  // Update currentInput
  let textContent = '';
  editableContainer.value?.childNodes.forEach(node => {
    if (node.nodeType === Node.TEXT_NODE) {
      textContent += node.textContent || '';
    }
  });
  currentInput.value = textContent.trim();
}

function handleContentEditableInput(_event: Event) {
  if (isComposing.value) return;
  
  
  // Always update position while typing
  saveSelection();
  
  // Extract text content from all positions
  extractCurrentInput();
}

function handleContentEditableKeydown(event: KeyboardEvent) {
  if (event.key === 'Enter') {
    event.preventDefault();
    if (currentInput.value.trim()) {
      parseAndAddTag();
    }
  } else if (event.key === 'Backspace') {
    const selection = window.getSelection();
    if (selection && selection.isCollapsed && selection.anchorOffset === 0) {
      // At beginning of text, remove last tag
      if (searchTags.value.length > 0) {
        event.preventDefault();
        removeTag(searchTags.value.length - 1);
      }
    }
  }
}

function handlePaste(event: ClipboardEvent) {
  event.preventDefault();
  const text = event.clipboardData?.getData('text/plain') || '';
  
  // Insert plain text at cursor
  const selection = window.getSelection();
  if (selection && selection.rangeCount > 0) {
    const range = selection.getRangeAt(0);
    range.deleteContents();
    range.insertNode(document.createTextNode(text));
    range.collapse(false);
  }
  
  currentInput.value = text;
  handleContentEditableInput(event);
}

function handleContentEditableFocus() {
  emit('focus');
  renderContentEditable();
}

function handleContentEditableBlur() {
  saveSelection();
  emit('blur');
}

function handleContentEditableClick(event: MouseEvent) {
  const target = event.target as HTMLElement;
  
  // Handle tag close button
  if (target.classList.contains('tag-close')) {
    const index = parseInt(target.dataset.index || '0');
    removeTag(index);
    return;
  }
  
  // Handle double click on tag value
  if (event.detail === 2) { // Double click
    const valueElement = target.closest('.tag-value') as HTMLElement;
    if (valueElement) {
      const tagElement = valueElement.closest('.editable-tag') as HTMLElement;
      if (tagElement) {
        const index = parseInt(tagElement.dataset.tagIndex || '0');
        startEditValue(index);
        return;
      }
    }
  }
  
  // Handle tag click
  const tagElement = target.closest('.editable-tag, .editable-logical-tag') as HTMLElement;
  if (tagElement) {
    const index = parseInt(tagElement.dataset.tagIndex || '0');
    handleTagClick(index);
  }
}

// Watch for changes and re-render (only tags, not currentInput)
watch(searchTags, () => {
  nextTick(() => {
    renderContentEditable();
  });
}, { deep: true });

// Initial render
onMounted(() => {
  renderContentEditable();
  // Set initial focus
  if (editableContainer.value) {
    editableContainer.value.focus();
    setCursorToEnd();
  }
});

defineExpose({
  addFieldToSearch, addOperatorToSearch, addLogicalOperator, focusInput, defaultLogicalOp,
});
</script>

<style lang="scss" scoped>
.search-tag-input {
  position: relative;
  width: 100%;
  display: flex;
  align-items: center;
}

.tag-input-container {
  flex: 1;
  display: block;
  padding: 6px 8px;
  min-height: 44px;
  background-color: var(--theme--form--field--input--background);
  border: 1px solid var(--theme--form--field--input--border-color);
  border-radius: var(--theme--border-radius);
  cursor: text;
  transition: border-color 0.2s;
  font-size: 14px;
  line-height: 1.6;
  color: var(--theme--foreground);
  outline: none;

  &:hover {
    border-color: var(--theme--form--field--input--border-color-hover);
  }

  &:focus {
    border-color: var(--theme--primary);
    outline: none;
  }
  
  &:empty::before {
    content: attr(data-placeholder);
    color: var(--theme--foreground-subdued);
    pointer-events: none;
    position: absolute;
  }
}

.tags-draggable {
  display: inline-flex;
  align-items: center;
  gap: 0; /* No gap, margins handled by individual elements */
  flex-wrap: wrap;
}

.tag-with-cursor {
  display: inline-flex;
  align-items: center;
}

.tag-input-container :deep(.search-tag) {
  max-width: 200px;
  height: 24px;
  background-color: var(--theme--primary-background);
  border: 1px solid var(--theme--primary-subdued);
  cursor: pointer;
  transition: all 0.2s ease;
  display: inline-flex;
  align-items: center;
  padding: 15px 10px;
  margin: 0 4px;



  &.sortable-ghost {
    opacity: 0.4;
  }

  &.sortable-drag {
    box-shadow: 0 5px 15px rgba(0, 0, 0, 0.3);
  }

  .drag-handle {
    margin-right: 4px;
    cursor: grab;
    color: var(--theme--foreground-subdued);
    opacity: 0.5;
    transition: opacity 0.2s;

    &:hover {
      opacity: 1;
    }

    &:active {
      cursor: grabbing;
    }


  }


  &.focused {
    border-color: var(--theme--primary);
    box-shadow: 0 0 0 2px var(--theme--primary-background), 0 0 0 4px var(--theme--primary);
    background-color: var(--theme--primary-subdued);
  }

  &:hover:not(.focused) {
    border-color: var(--theme--primary-alt);
    background-color: var(--theme--primary-subdued);

    .drag-handle {
      opacity: 0.8;
    }
  }

  &:hover {
    .close-outline {
      display: block;
      background: none !important;
      position: absolute;
      right: 0;
      top: -10px;
      cursor: pointer;
    }


  }


  .chip-content {
    position: relative;
  }

  .tag-field {
    font-weight: 600;
    color: var(--theme--primary);
  }

  .tag-operator {
    color: var(--theme--foreground-subdued);
    margin: 0 2px;
  }


  .close-outline {
    background-color: green !important;
    display: none;
  }



  .tag-value {
    color: var(--theme--foreground);
  }


  .tag-value-edit {
    display: inline-block;
    margin: 0;
    padding: 0;
    max-width: 100px;
    overflow: hidden;
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
  margin: 0 4px;

  strong {
    color: var(--theme--primary);
    text-transform: uppercase;
    font-size: 11px;
    letter-spacing: 0.05em;
  }
}

.default-logical-op {
  margin: 0 4px;
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

.position-input {
  border: none !important;
  background: none !important;
  outline: none !important;
  font-size: 14px;
  color: var(--theme--foreground);
  padding: 0;
  margin: 0 4px;
  box-shadow: none !important;
  transition: width 0.15s ease;
  
  &::placeholder {
    color: var(--theme--foreground-subdued);
    opacity: 0.7;
  }
  
  &:focus {
    border: none !important;
    outline: none !important;
    box-shadow: none !important;
  }
}

/* Contenteditable tag styles */
.tag-input-container {
  :deep(.editable-tag),
  :deep(.editable-logical-tag) {
    display: inline-flex;
    align-items: center;
    padding: 2px 8px;
    margin: 2px 6px;
    border-radius: var(--theme--border-radius);
    font-size: 13px;
    line-height: 20px;
    vertical-align: middle;
    user-select: none;
    white-space: nowrap;
  }
}

  :deep(.editable-tag) {
    background-color: var(--theme--primary-background);
    border: 1px solid var(--theme--primary-subdued);
    color: var(--theme--foreground);
    cursor: pointer;
    transition: all 0.2s ease;
    
    &:hover {
      border-color: var(--theme--primary);
      background-color: var(--theme--primary-subdued);
    }
    
    &.focused {
      border-color: var(--theme--primary);
      box-shadow: 0 0 0 2px var(--theme--primary-background), 0 0 0 4px var(--theme--primary);
      background-color: var(--theme--primary-subdued);
    }
    
    .tag-content {
      display: inline-flex;
      align-items: center;
    }
    
    .tag-field {
      font-weight: 600;
      color: var(--theme--primary);
    }
    
    .tag-operator {
      color: var(--theme--foreground-subdued);
      margin: 0 4px;
    }
    
    .tag-value {
      color: var(--theme--foreground);
    }
    
    .tag-close {
      margin-left: 8px;
      padding: 0 4px;
      cursor: pointer;
      color: var(--theme--foreground-subdued);
      font-weight: bold;
      font-size: 16px;
      line-height: 1;
      opacity: 0.6;
      transition: all 0.2s ease;
      
      &:hover {
        color: var(--theme--danger);
        opacity: 1;
      }
    }
  }

  :deep(.editable-logical-tag) {
    background-color: var(--theme--form--field--input--background-subdued);
    border: 1px solid var(--theme--border-color);
    
    strong {
      color: var(--theme--primary);
      text-transform: uppercase;
      font-size: 11px;
      letter-spacing: 0.05em;
    }
  }

  :deep(.default-logical-op-inline) {
    display: inline-block;
    padding: 2px 6px;
    margin: 2px 6px 2px 0;
    background-color: var(--theme--info-background);
    color: var(--theme--info);
    border: 1px solid var(--theme--info);
    border-radius: var(--theme--border-radius);
    font-size: 11px;
    font-weight: 600;
    text-transform: uppercase;
    letter-spacing: 0.05em;
    vertical-align: middle;
  }

.input-icons {
  display: flex;
  align-items: center;
  gap: 8px;
  margin-left: 8px;
  flex-shrink: 0;

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

.inline-edit-input {
  background: transparent;
  border: none;
  outline: none;
  color: var(--theme--foreground);
  font-size: inherit;
  font-family: inherit;
  padding: 0;
  margin: 0;
  min-width: 20px;
  max-width: 100px;
  width: auto;

  &:focus {
    outline: none;
    border: none;
    box-shadow: none;
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

/* Visual cursor styles */
.cursor-indicator {
  display: inline-block;
  width: 2px;
  height: 20px;
  background-color: var(--theme--primary);
  margin: 0 4px;
  border-radius: 1px;
  animation: cursor-blink 1s infinite;
  transition: all 0.2s ease;

  &.cursor-hovering {
    opacity: 0.3;
    animation: none;
    background-color: var(--theme--primary-subdued);
    transform: scaleY(0.8);
  }

  @keyframes cursor-blink {
    0%, 100% { 
      opacity: 1;
      transform: scaleY(1);
    }
    50% { 
      opacity: 0.3;
      transform: scaleY(0.95);
    }
  }
}

/* Adjust tag container for better cursor visibility */
.tag-input-container {
  cursor: text;
  
  &:hover .cursor-indicator {
    animation-duration: 0.8s;
  }
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