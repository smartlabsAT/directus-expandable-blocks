<template>
  <v-drawer
    v-model="internalOpen"
    title="AI Assistant"
    persistent
    :sidebar-label="drawerTitle"
    @cancel="closeDrawer"
  >
    <template #default>
      <!-- Main Content Area (Right Side) -->
      <div class="ai-main-content">
        <!-- Input Section -->
        <div class="ai-input-section">
          <div class="input-row">
            <!-- Generate New Content (2/3) -->
            <div class="generate-section">
              <h4>Generate New Content</h4>
              <v-textarea
                v-model="generatePrompt"
                placeholder="Describe what you want to generate..."
                rows="3"
                :disabled="isProcessing"
              />
              <v-button
                :loading="loadingState.generate"
                :disabled="!generatePrompt.trim() || isProcessing"
                @click="generateNewContent"
              >
                <v-icon name="auto_awesome" class="mr-2" />
                Generate Content
              </v-button>
            </div>

            <!-- Translation (1/3) -->
            <div class="translation-section">
              <h4>Translation</h4>
              <v-select
                v-model="selectedLanguage"
                :items="languageOptions"
                placeholder="Select language..."
                :disabled="isProcessing"
              />
              <v-button
                :loading="loadingState.translate"
                :disabled="!selectedLanguage || isProcessing"
                @click="translateContent"
              >
                <v-icon name="translate" class="mr-2" />
                Translate
              </v-button>
            </div>
          </div>
        </div>

        <!-- AI Response Display -->
        <div v-if="aiResponse" class="ai-response">
          <div class="response-header">
            <h3>AI Suggestions</h3>
            <div class="response-actions">
              <v-button
                small
                icon
                secondary
                v-tooltip="'Regenerate'"
                @click="regenerateResponse"
              >
                <v-icon name="refresh" />
              </v-button>
              <v-button
                small
                icon
                secondary
                v-tooltip="'Clear'"
                @click="clearResponse"
              >
                <v-icon name="close" />
              </v-button>
            </div>
          </div>
          
          <div class="response-content">
            <div v-if="aiResponse.error" class="error-message">
              <v-notice type="danger" icon="error">
                {{ aiResponse.error }}
              </v-notice>
            </div>
            <div v-else class="suggestions-list">
              <div 
                v-for="(suggestion, index) in aiSuggestions" 
                :key="index"
                class="suggestion-item"
                :class="{ active: selectedSuggestion === index }"
                @click="selectedSuggestion = index"
              >
                <div class="suggestion-header">
                  <h4>Option {{ index + 1 }}</h4>
                  <v-button
                    x-small
                    secondary
                    @click.stop="applySuggestion(suggestion)"
                  >
                    Apply All
                  </v-button>
                </div>
                <div class="suggestion-content">
                  <!-- Multi-field content display -->
                  <div v-if="suggestion.multiFieldContent && Object.keys(suggestion.multiFieldContent).length > 1" class="multi-field-content">
                    <div 
                      v-for="(content, fieldName) in suggestion.multiFieldContent" 
                      :key="fieldName"
                      class="field-content-item"
                    >
                      <div class="field-content-header">
                        <strong>{{ getFieldLabel(fieldName) }}</strong>
                        <v-button
                          x-small
                          secondary
                          @click.stop="applySingleField(fieldName, content)"
                        >
                          Apply This Field
                        </v-button>
                      </div>
                      <div class="field-content-text">
                        <pre>{{ content }}</pre>
                      </div>
                    </div>
                  </div>
                  <!-- Single field or fallback content -->
                  <div v-else class="single-field-content">
                    <pre>{{ typeof suggestion === 'string' ? suggestion : suggestion.content || suggestion }}</pre>
                  </div>
                </div>
              </div>
            </div>
          </div>

          <div v-if="!aiResponse.error && selectedSuggestion !== null" class="response-actions-bottom">
            <v-button
              secondary
              @click="clearResponse"
            >
              Discard All
            </v-button>
            <v-button
              @click="applySuggestion(aiSuggestions[selectedSuggestion])"
            >
              Apply Selected
            </v-button>
          </div>
        </div>

        <!-- Empty State -->
        <div v-else class="empty-state">
          <div class="empty-content">
            <v-icon name="auto_awesome" size="48" />
            <h3>AI Assistant</h3>
            <p>Select an action from the sidebar to get AI-powered suggestions for your content.</p>
          </div>
        </div>

        <!-- Token Usage Display -->
        <div v-if="tokenUsage" class="token-usage">
          <small class="usage-info">
            Tokens used: {{ tokenUsage.totalTokens }}
            ({{ tokenUsage.promptTokens }} + {{ tokenUsage.completionTokens }})
          </small>
        </div>
      </div>
    </template>

    <template #sidebar>
      <div class="ai-assistant-sidebar">
        <!-- Header with Block Info -->
        <div class="block-info-header">
          <div class="block-icon">
            <v-icon :name="blockIcon" />
          </div>
          <div class="block-details">
            <h3>{{ blockTitle }}</h3>
            <p class="block-type">{{ blockType }}</p>
          </div>
        </div>

        <!-- Block Fields Overview -->
        <div class="block-fields-overview">
          <div class="fields-header">
            <h4>Available Fields</h4>
            <div class="fields-actions">
              <v-button
                x-small
                secondary
                @click="selectAllFields"
                v-tooltip="'Select All'"
              >
                All
              </v-button>
              <v-button
                x-small
                secondary
                @click="clearFieldSelection"
                v-tooltip="'Clear Selection'"
              >
                Clear
              </v-button>
            </div>
          </div>
          <div class="fields-list">
            <div 
              v-for="field in allBlockFields" 
              :key="field.field"
              class="field-item"
              :class="{ 
                'main-content': field.isMainContent,
                'selected': selectedFields.includes(field.field)
              }"
              @click="toggleFieldSelection(field.field)"
            >
              <div class="field-header">
                <div class="field-info">
                  <v-checkbox
                    :model-value="selectedFields.includes(field.field)"
                    @click.stop
                    @update:model-value="(value) => toggleFieldSelection(field.field, value)"
                  />
                  <strong>{{ field.label }}</strong>
                </div>
                <v-icon 
                  v-if="selectedFields.includes(field.field)"
                  name="check_circle"
                  class="selected-icon"
                />
              </div>
              <span class="field-preview">{{ field.value.substring(0, 50) }}{{ field.value.length > 50 ? '...' : '' }}</span>
            </div>
          </div>
          <div v-if="selectedFields.length > 0" class="selected-fields-info">
            <small>
              Selected ({{ selectedFields.length }}): 
              <strong>{{ selectedFields.map(f => getFieldLabel(f)).join(', ') }}</strong>
            </small>
          </div>
        </div>

        <!-- AI Configuration Check -->
        <div v-if="!isAIConfigured" class="ai-not-configured">
          <v-notice type="warning" icon="warning">
            <p>AI Assistant is not configured. Please configure AI settings in the interface options.</p>
          </v-notice>
        </div>

        <!-- AI Features -->
        <div v-else class="ai-features">
          <!-- Content Improvement -->
          <div class="feature-section">
            <h4>Content Improvement</h4>
            <div class="improvement-buttons">
              <v-button
                v-for="improvement in improvementOptions"
                :key="improvement.type"
                :loading="loadingState[improvement.type]"
                :disabled="isProcessing"
                small
                secondary
                block
                @click="improveContent(improvement.type)"
              >
                <v-icon :name="improvement.icon" class="mr-2" />
                {{ improvement.label }}
              </v-button>
            </div>
          </div>

        </div>

      </div>
    </template>

  </v-drawer>
</template>

<script setup lang="ts">
import { ref, computed, watch, onMounted } from 'vue';
import { aiService, type AIResponse } from '../services/ai-service';
import type { JunctionRecord } from '../types';

interface Props {
  modelValue: boolean;
  item: { item: JunctionRecord; index: number } | null;
  allItems?: Array<{ item: JunctionRecord; index: number }>;
  pageContext?: {
    title?: string;
    type?: string;
    description?: string;
    url?: string;
  };
}

interface Emits {
  (e: 'update:modelValue', value: boolean): void;
  (e: 'update-content', content: any): void;
}

const props = defineProps<Props>();
const emit = defineEmits<Emits>();

// Reactive state
const internalOpen = ref(false);
const generatePrompt = ref('');
const selectedLanguage = ref('');
const selectedFields = ref<string[]>([]);
const aiResponse = ref<AIResponse | null>(null);
const tokenUsage = ref<AIResponse['usage'] | null>(null);
const loadingState = ref<Record<string, boolean>>({});
const lastAction = ref<string>('');
const aiSuggestions = ref<string[]>([]);
const selectedSuggestion = ref<number | null>(null);

// Improvement options
const improvementOptions = [
  { type: 'grammar', label: 'Fix Grammar', icon: 'spellcheck' },
  { type: 'style', label: 'Improve Style', icon: 'brush' },
  { type: 'clarity', label: 'Make Clearer', icon: 'lightbulb' },
  { type: 'tone', label: 'Adjust Tone', icon: 'mood' },
  { type: 'seo', label: 'Optimize for SEO', icon: 'search' }
];

// Language options
const languageOptions = [
  { text: 'German', value: 'de' },
  { text: 'English', value: 'en' },
  { text: 'Spanish', value: 'es' },
  { text: 'French', value: 'fr' },
  { text: 'Italian', value: 'it' },
  { text: 'Portuguese', value: 'pt' },
  { text: 'Dutch', value: 'nl' },
  { text: 'Russian', value: 'ru' },
  { text: 'Chinese', value: 'zh' },
  { text: 'Japanese', value: 'ja' }
];

// Computed properties
const isAIConfigured = computed(() => aiService.isConfigured());

const isProcessing = computed(() => 
  Object.values(loadingState.value).some(loading => loading)
);

const drawerTitle = computed(() => {
  if (!props.item) return 'AI Assistant';
  return `AI Assistant - ${blockTitle.value}`;
});

const blockTitle = computed(() => {
  if (!props.item?.item) return 'Block';
  const item = props.item.item.item || props.item.item;
  const title = item.title || item.name || item.headline || item.heading || 'Untitled Block';
  console.log('🔍 Block title:', title);
  return title;
});

const blockType = computed(() => {
  if (!props.item?.item) return 'Unknown';
  return props.item.item.collection || 'content_block';
});

const blockIcon = computed(() => {
  const collection = blockType.value;
  const iconMap: Record<string, string> = {
    content_text: 'article',
    content_hero: 'flag',
    content_image: 'image',
    content_cta: 'call_to_action',
    content_testimonial: 'format_quote',
    content_features: 'featured_play_list',
    content_pricing: 'payments'
  };
  return iconMap[collection] || 'box';
});

const allBlockFields = computed(() => {
  if (!props.item?.item) return [];
  const item = props.item.item.item || props.item.item;
  
  // Filter out system fields and empty values
  const systemFields = ['id', 'status', 'sort', 'user_created', 'date_created', 'user_updated', 'date_updated'];
  const contentFields = [];
  
  for (const [key, value] of Object.entries(item)) {
    if (!systemFields.includes(key) && value && typeof value === 'string' && value.trim()) {
      contentFields.push({
        field: key,
        label: key.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase()),
        value: value,
        isMainContent: ['content', 'text', 'description', 'headline', 'title', 'heading', 'body'].includes(key)
      });
    }
  }
  
  // Sort: main content fields first, then alphabetically
  return contentFields.sort((a, b) => {
    if (a.isMainContent && !b.isMainContent) return -1;
    if (!a.isMainContent && b.isMainContent) return 1;
    return a.label.localeCompare(b.label);
  });
});

const currentContent = computed(() => {
  console.log('🔍 AI Drawer Debug - props.item:', props.item);
  console.log('🔍 All block fields:', allBlockFields.value);
  console.log('🔍 Selected fields:', selectedFields.value);
  
  if (allBlockFields.value.length === 0) return '';
  
  // If multiple fields selected, return combined content for context
  if (selectedFields.value.length > 1) {
    const selectedFieldsContent = selectedFields.value
      .map(fieldName => {
        const field = allBlockFields.value.find(f => f.field === fieldName);
        return field ? `${field.label}: ${field.value}` : '';
      })
      .filter(content => content)
      .join('\n');
    
    return selectedFieldsContent;
  }
  
  // Use single selected field if available
  if (selectedFields.value.length === 1) {
    const targetField = allBlockFields.value.find(f => f.field === selectedFields.value[0]);
    return targetField ? targetField.value : '';
  }
  
  // Fallback to main content field or first field
  const fallbackField = allBlockFields.value.find(f => f.isMainContent) || allBlockFields.value[0];
  console.log('🔍 Using fallback field for content:', fallbackField);
  
  return fallbackField ? fallbackField.value : '';
});

// Methods
const toggleFieldSelection = (fieldName: string, forceValue?: boolean): void => {
  const shouldSelect = forceValue !== undefined ? forceValue : !selectedFields.value.includes(fieldName);
  
  if (shouldSelect) {
    if (!selectedFields.value.includes(fieldName)) {
      selectedFields.value.push(fieldName);
    }
  } else {
    selectedFields.value = selectedFields.value.filter(f => f !== fieldName);
  }
  
  console.log('🔍 Selected fields:', selectedFields.value);
};

const selectAllFields = (): void => {
  selectedFields.value = allBlockFields.value.map(f => f.field);
  console.log('🔍 Selected all fields:', selectedFields.value);
};

const clearFieldSelection = (): void => {
  selectedFields.value = [];
  console.log('🔍 Cleared field selection');
};

const getFieldLabel = (fieldName: string): string => {
  const field = allBlockFields.value.find(f => f.field === fieldName);
  return field ? field.label : fieldName;
};

const buildBlockContext = () => {
  if (!props.item) return undefined;
  
  const item = props.item.item.item || props.item.item;
  const fieldsObject: Record<string, any> = {};
  
  // Convert all fields to object
  allBlockFields.value.forEach(field => {
    fieldsObject[field.field] = field.value;
  });
  
  return {
    type: blockType.value,
    position: props.item.index + 1,
    totalBlocks: props.allItems?.length || 1,
    allFields: fieldsObject,
    targetFields: selectedFields.value.length > 0 ? selectedFields.value : undefined,
    selectedFieldsOnly: selectedFields.value.length > 0
  };
};

const buildNeighborBlocks = () => {
  if (!props.allItems || !props.item) return undefined;
  
  const currentIndex = props.item.index;
  const neighbors = [];
  
  // Get previous and next blocks
  const prevIndex = currentIndex - 1;
  const nextIndex = currentIndex + 1;
  
  if (prevIndex >= 0 && props.allItems[prevIndex]) {
    const prevItem = props.allItems[prevIndex].item.item || props.allItems[prevIndex].item;
    neighbors.push({
      type: props.allItems[prevIndex].item.collection || 'unknown',
      title: prevItem.title || prevItem.headline || prevItem.name || 'Previous Block',
      content: getFirstTextContent(prevItem)
    });
  }
  
  if (nextIndex < props.allItems.length && props.allItems[nextIndex]) {
    const nextItem = props.allItems[nextIndex].item.item || props.allItems[nextIndex].item;
    neighbors.push({
      type: props.allItems[nextIndex].item.collection || 'unknown', 
      title: nextItem.title || nextItem.headline || nextItem.name || 'Next Block',
      content: getFirstTextContent(nextItem)
    });
  }
  
  return neighbors.length > 0 ? neighbors : undefined;
};

const getFirstTextContent = (item: any): string => {
  // Find first text content field
  for (const [key, value] of Object.entries(item)) {
    if (typeof value === 'string' && value.trim() && 
        ['content', 'text', 'description', 'subtitle', 'subheading'].includes(key)) {
      return value.substring(0, 150) + (value.length > 150 ? '...' : '');
    }
  }
  return '';
};

const closeDrawer = (): void => {
  internalOpen.value = false;
  clearResponse();
};

const clearResponse = (): void => {
  aiResponse.value = null;
  tokenUsage.value = null;
  lastAction.value = '';
  aiSuggestions.value = [];
  selectedSuggestion.value = null;
};

const setLoading = (action: string, loading: boolean): void => {
  loadingState.value = { ...loadingState.value, [action]: loading };
};

const improveContent = async (improvementType: string): Promise<void> => {
  if (!currentContent.value.trim()) {
    aiResponse.value = {
      content: '',
      error: 'No content found to improve. Please add some content to this block first.'
    };
    return;
  }

  setLoading(improvementType, true);
  lastAction.value = improvementType;
  
  try {
    // Build context for AI
    const context = {
      pageContext: props.pageContext,
      blockContext: buildBlockContext(),
      neighborBlocks: buildNeighborBlocks()
    };
    
    console.log('🔍 AI Context:', context);
    
    // Generate multiple suggestions
    const suggestions = [];
    
    for (let i = 0; i < 3; i++) {
      const response = await aiService.improveContent(currentContent.value, improvementType, context);
      if (response.content && !response.error) {
        suggestions.push(response.content);
      }
      if (i === 0) {
        // Store usage info from first request
        tokenUsage.value = response.usage || null;
      }
    }
    
    if (suggestions.length > 0) {
      aiSuggestions.value = suggestions;
      aiResponse.value = { content: suggestions[0] }; // For compatibility
      selectedSuggestion.value = 0;
    } else {
      aiResponse.value = {
        content: '',
        error: 'Failed to generate suggestions'
      };
    }
  } catch (error) {
    aiResponse.value = {
      content: '',
      error: error instanceof Error ? error.message : 'Failed to improve content'
    };
  } finally {
    setLoading(improvementType, false);
  }
};

const generateNewContent = async (): Promise<void> => {
  setLoading('generate', true);
  lastAction.value = 'generate';
  
  try {
    // Build context for AI
    const context = {
      pageContext: props.pageContext,
      blockContext: buildBlockContext(),
      neighborBlocks: buildNeighborBlocks()
    };
    
    console.log('🔍 AI Context for generation:', context);
    
    // Generate multiple suggestions with multi-field support
    const suggestions = [];
    
    for (let i = 0; i < 3; i++) {
      const response = await aiService.generateBlockContent(
        blockType.value,
        generatePrompt.value,
        context
      );
      if (response.content && !response.error) {
        // Store full response object with multiFieldContent
        suggestions.push({
          content: response.content,
          multiFieldContent: response.multiFieldContent
        });
      }
      if (i === 0) {
        tokenUsage.value = response.usage || null;
      }
    }
    
    if (suggestions.length > 0) {
      aiSuggestions.value = suggestions;
      aiResponse.value = { content: suggestions[0].content };
      selectedSuggestion.value = 0;
    } else {
      aiResponse.value = {
        content: '',
        error: 'Failed to generate suggestions'
      };
    }
  } catch (error) {
    aiResponse.value = {
      content: '',
      error: error instanceof Error ? error.message : 'Failed to generate content'
    };
  } finally {
    setLoading('generate', false);
  }
};

const translateContent = async (): Promise<void> => {
  if (!currentContent.value.trim()) {
    aiResponse.value = {
      content: '',
      error: 'No content found to translate. Please add some content to this block first.'
    };
    return;
  }

  setLoading('translate', true);
  lastAction.value = 'translate';
  
  try {
    const languageName = languageOptions.find(lang => lang.value === selectedLanguage.value)?.text || selectedLanguage.value;
    const prompt = `Translate the following text to ${languageName}, maintaining the same tone and style:\n\n${currentContent.value}`;
    
    // Build context for AI
    const context = {
      pageContext: props.pageContext,
      blockContext: buildBlockContext(),
      neighborBlocks: buildNeighborBlocks()
    };
    
    // Generate multiple translation suggestions
    const suggestions = [];
    
    for (let i = 0; i < 3; i++) {
      const response = await aiService.generateContent({
        prompt,
        context: 'This is content from a web page content block. Provide only the translated text without additional explanations. Consider the page and block context to ensure the translation fits well with the overall content.',
        pageContext: context.pageContext,
        blockContext: context.blockContext,
        neighborBlocks: context.neighborBlocks
      });
      if (response.content && !response.error) {
        suggestions.push(response.content);
      }
      if (i === 0) {
        tokenUsage.value = response.usage || null;
      }
    }
    
    if (suggestions.length > 0) {
      aiSuggestions.value = suggestions;
      aiResponse.value = { content: suggestions[0] };
      selectedSuggestion.value = 0;
    } else {
      aiResponse.value = {
        content: '',
        error: 'Failed to generate translations'
      };
    }
  } catch (error) {
    aiResponse.value = {
      content: '',
      error: error instanceof Error ? error.message : 'Failed to translate content'
    };
  } finally {
    setLoading('translate', false);
  }
};

const regenerateResponse = async (): Promise<void> => {
  if (!lastAction.value) return;
  
  switch (lastAction.value) {
    case 'generate':
      await generateNewContent();
      break;
    case 'translate':
      await translateContent();
      break;
    default:
      await improveContent(lastAction.value);
      break;
  }
};

const applySuggestion = (suggestion: any): void => {
  if (!suggestion || !props.item) return;
  
  const updatedContent: any = {};
  
  // Handle multi-field content
  if (suggestion.multiFieldContent && Object.keys(suggestion.multiFieldContent).length > 0) {
    // Apply only selected fields or all fields if none selected
    const fieldsToApply = selectedFields.value.length > 0 
      ? selectedFields.value 
      : Object.keys(suggestion.multiFieldContent);
    
    fieldsToApply.forEach(fieldName => {
      const content = suggestion.multiFieldContent[fieldName];
      if (content && typeof content === 'string') {
        updatedContent[fieldName] = content;
      }
    });
    console.log('🔧 Applying multi-field suggestion:', updatedContent);
  } else {
    // Handle single field content (legacy behavior)
    const suggestionText = typeof suggestion === 'string' ? suggestion : suggestion.content || suggestion;
    
    // Use first selected field if available, otherwise fall back to main content field
    let targetField: any = null;
    
    if (selectedFields.value.length > 0) {
      targetField = allBlockFields.value.find(f => f.field === selectedFields.value[0]);
    }
    
    // Fallback to main content field or first field
    if (!targetField) {
      targetField = allBlockFields.value.find(f => f.isMainContent) || allBlockFields.value[0];
    }
    
    if (targetField) {
      updatedContent[targetField.field] = suggestionText;
    }
    
    console.log('🔧 Applying single field suggestion to:', targetField?.field, 'with content:', suggestionText);
  }
  
  emit('update-content', updatedContent);
  clearResponse();
};

const applySingleField = (fieldName: string, content: string): void => {
  if (!content || !props.item) return;
  
  const updatedContent: any = {};
  updatedContent[fieldName] = content;
  
  console.log('🔧 Applying single field:', fieldName, 'with content:', content);
  
  emit('update-content', updatedContent);
  // Don't clear response so user can apply more fields
};

const applyContent = (): void => {
  if (selectedSuggestion.value !== null && aiSuggestions.value[selectedSuggestion.value]) {
    applySuggestion(aiSuggestions.value[selectedSuggestion.value]);
  }
};

const copyToClipboard = async (): Promise<void> => {
  if (!aiResponse.value?.content) return;
  
  try {
    await navigator.clipboard.writeText(aiResponse.value.content);
    // Could add a toast notification here
  } catch (error) {
    console.error('Failed to copy to clipboard:', error);
  }
};

// Watchers
watch(() => props.modelValue, (newValue) => {
  internalOpen.value = newValue;
});

watch(internalOpen, (newValue) => {
  emit('update:modelValue', newValue);
});

watch(() => props.modelValue, (newValue) => {
  internalOpen.value = newValue;
  if (!newValue) {
    clearResponse();
    generatePrompt.value = '';
    selectedLanguage.value = '';
    selectedFields.value = [];
  } else {
    // Auto-select the main content field when opening (if none selected)
    if (allBlockFields.value.length > 0 && selectedFields.value.length === 0) {
      const mainField = allBlockFields.value.find(f => f.isMainContent) || allBlockFields.value[0];
      if (mainField) {
        selectedFields.value = [mainField.field];
      }
    }
  }
});

// Lifecycle
onMounted(() => {
  internalOpen.value = props.modelValue;
});
</script>

<style scoped>
.ai-assistant-sidebar {
  display: flex;
  flex-direction: column;
  height: 100%;
  padding: 24px;
  gap: 24px;
  overflow-y: auto;
  width: 250px;
  min-width: 250px;
}

.block-info-header {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 12px;
  padding: 20px;
  background: var(--theme--background-accent);
  border-radius: 8px;
  text-align: center;
}

.block-icon {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 48px;
  height: 48px;
  background: var(--theme--primary);
  color: white;
  border-radius: 50%;
  margin-bottom: 8px;
}

.block-details h3 {
  margin: 0;
  font-size: 16px;
  font-weight: 600;
  color: var(--theme--foreground);
}

.block-type {
  margin: 4px 0 0 0;
  font-size: 12px;
  color: var(--theme--foreground-subdued);
  text-transform: capitalize;
}

.ai-not-configured {
  padding: 16px;
  text-align: center;
}

.feature-section {
  display: flex;
  flex-direction: column;
  gap: 12px;
}

.feature-section h4 {
  margin: 0;
  font-size: 14px;
  font-weight: 600;
  color: var(--theme--foreground);
  border-bottom: 1px solid var(--theme--border-color);
  padding-bottom: 8px;
}

.improvement-buttons {
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.generate-section,
.translation-section {
  display: flex;
  flex-direction: column;
  gap: 12px;
}

.ai-response {
  border: 1px solid var(--theme--border-color);
  border-radius: 8px;
  overflow: hidden;
}

.response-header {
  display: flex;
  justify-content: between;
  align-items: center;
  padding: 12px 16px;
  background: var(--theme--background-accent);
  border-bottom: 1px solid var(--theme--border-color);
}

.response-header h4 {
  margin: 0;
  font-size: 14px;
  font-weight: 600;
}

.response-actions {
  display: flex;
  gap: 4px;
}

.response-content {
  padding: 16px;
}

.suggested-content pre {
  white-space: pre-wrap;
  word-wrap: break-word;
  margin: 0;
  font-family: inherit;
  font-size: 14px;
  line-height: 1.5;
  color: var(--theme--foreground);
}

.error-message {
  margin: 0;
}

.response-actions-bottom {
  display: flex;
  justify-content: space-between;
  padding: 12px 16px;
  border-top: 1px solid var(--theme--border-color);
  background: var(--theme--background-accent);
}

.token-usage {
  padding: 8px 12px;
  background: var(--theme--background-accent);
  border-radius: 4px;
  text-align: center;
}

.usage-info {
  color: var(--theme--foreground-subdued);
  font-size: 11px;
}

/* AI Button styling in parent component */
:global(.ai-button) {
  color: var(--theme--primary) !important;
}

:global(.ai-button:hover) {
  background: var(--theme--primary-10) !important;
}

/* Force the v-drawer sidebar to be 250px */
:global(.v-drawer .sidebar) {
  width: 250px !important;
  min-width: 250px !important;
  max-width: 250px !important;
}

/* Alternative selector if the above doesn't work */
:global(.v-drawer-sidebar) {
  width: 250px !important;
  min-width: 250px !important;
  max-width: 250px !important;
}

.block-fields-overview {
  margin-top: 16px;
}

.fields-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 12px;
}

.fields-header h4 {
  margin: 0;
  font-size: 14px;
  font-weight: 600;
  color: var(--theme--foreground);
}

.fields-actions {
  display: flex;
  gap: 6px;
}

.field-info {
  display: flex;
  align-items: center;
  gap: 8px;
}

.fields-list {
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.field-item {
  padding: 8px 12px;
  background: var(--theme--background-normal);
  border-radius: 4px;
  font-size: 12px;
  line-height: 1.4;
  cursor: pointer;
  transition: all 0.2s ease;
  border: 2px solid transparent;
}

.field-item:hover {
  background: var(--theme--background-accent);
  border-color: var(--theme--border-color);
}

.field-item.main-content {
  background: var(--theme--primary-10);
  border-left: 3px solid var(--theme--primary);
}

.field-item.main-content:hover {
  background: var(--theme--primary-25);
}

.field-item.selected {
  background: var(--theme--primary-25);
  border-color: var(--theme--primary);
}

.field-item.selected.main-content {
  background: var(--theme--primary-50);
}

.field-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 2px;
}

.field-item strong {
  color: var(--theme--foreground);
}

.field-preview {
  color: var(--theme--foreground-subdued);
  display: block;
}

.selected-icon {
  color: var(--theme--primary);
  font-size: 16px;
}

.selected-fields-info {
  margin-top: 12px;
  padding: 8px 12px;
  background: var(--theme--background-accent);
  border-radius: 4px;
  border-left: 3px solid var(--theme--primary);
}

.selected-fields-info small {
  color: var(--theme--foreground-subdued);
  line-height: 1.4;
}

.selected-fields-info strong {
  color: var(--theme--foreground);
}

.ai-main-content {
  padding: 24px;
  height: 100%;
  overflow-y: auto;
  display: flex;
  flex-direction: column;
  gap: 24px;
}

.ai-input-section {
  border-bottom: 1px solid var(--theme--border-color);
  padding-bottom: 24px;
}

.input-row {
  display: flex;
  gap: 24px;
  align-items: flex-start;
}

.generate-section {
  flex: 2;
  display: flex;
  flex-direction: column;
  gap: 12px;
}

.translation-section {
  flex: 1;
  display: flex;
  flex-direction: column;
  gap: 12px;
}

.generate-section h4,
.translation-section h4 {
  margin: 0;
  font-size: 16px;
  font-weight: 600;
  color: var(--theme--foreground);
}

.empty-state {
  display: flex;
  align-items: center;
  justify-content: center;
  height: 100%;
}

.empty-content {
  text-align: center;
  color: var(--theme--foreground-subdued);
}

.empty-content h3 {
  margin: 16px 0 8px 0;
  color: var(--theme--foreground);
}

.suggestions-list {
  display: flex;
  flex-direction: column;
  gap: 16px;
}

.suggestion-item {
  border: 1px solid var(--theme--border-color);
  border-radius: 8px;
  overflow: hidden;
  cursor: pointer;
  transition: all 0.2s;
}

.suggestion-item:hover {
  border-color: var(--theme--primary);
}

.suggestion-item.active {
  border-color: var(--theme--primary);
  box-shadow: 0 0 0 2px var(--theme--primary-25);
}

.suggestion-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 12px 16px;
  background: var(--theme--background-accent);
  border-bottom: 1px solid var(--theme--border-color);
}

.suggestion-header h4 {
  margin: 0;
  font-size: 14px;
  font-weight: 600;
  color: var(--theme--foreground);
}

.suggestion-content {
  padding: 16px;
}

.suggestion-content pre {
  white-space: pre-wrap;
  word-wrap: break-word;
  margin: 0;
  font-family: inherit;
  font-size: 14px;
  line-height: 1.5;
  color: var(--theme--foreground);
}

.multi-field-content {
  display: flex;
  flex-direction: column;
  gap: 16px;
}

.field-content-item {
  border: 1px solid var(--theme--border-color);
  border-radius: 6px;
  overflow: hidden;
}

.field-content-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 8px 12px;
  background: var(--theme--background-accent);
  border-bottom: 1px solid var(--theme--border-color);
}

.field-content-header strong {
  font-size: 12px;
  color: var(--theme--foreground);
  text-transform: uppercase;
  letter-spacing: 0.5px;
}

.field-content-text {
  padding: 12px;
}

.field-content-text pre {
  white-space: pre-wrap;
  word-wrap: break-word;
  margin: 0;
  font-family: inherit;
  font-size: 14px;
  line-height: 1.5;
  color: var(--theme--foreground);
}

.single-field-content {
  padding: 0;
}
</style>