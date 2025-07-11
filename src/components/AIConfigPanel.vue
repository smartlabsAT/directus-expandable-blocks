<template>
  <div class="ai-config-panel">
    <v-card>
      <v-card-title>
        <v-icon name="smart_toy" class="mr-2" />
        AI Assistant Configuration
      </v-card-title>
      
      <v-card-text>
        <div class="config-form">
          <!-- Enable AI -->
          <div class="field-group">
            <v-checkbox
              v-model="localConfig.enabled"
              label="Enable AI Assistant"
              :disabled="saving"
            />
            <p class="field-hint">
              Enable AI-powered content generation and improvement suggestions
            </p>
          </div>

          <template v-if="localConfig.enabled">
            <!-- Provider Selection -->
            <div class="field-group">
              <label class="field-label">AI Provider</label>
              <v-select
                v-model="localConfig.provider"
                :items="providerOptions"
                item-text="label"
                item-value="value"
                :disabled="saving"
              />
            </div>

            <!-- API Key -->
            <div class="field-group">
              <label class="field-label">API Key</label>
              <v-input
                v-model="localConfig.apiKey"
                type="password"
                placeholder="Enter your API key"
                :disabled="saving"
              />
              <p class="field-hint">
                Your API key is stored locally in your browser and never sent to our servers
              </p>
            </div>

            <!-- Model Selection -->
            <div class="field-group">
              <label class="field-label">Model</label>
              <v-select
                v-model="localConfig.model"
                :items="modelOptions"
                :disabled="saving"
                clearable
              />
              <p class="field-hint">
                {{ getModelHint() }}
              </p>
            </div>

            <!-- Custom Base URL (for custom provider) -->
            <div v-if="localConfig.provider === 'custom'" class="field-group">
              <label class="field-label">Base URL</label>
              <v-input
                v-model="localConfig.baseUrl"
                placeholder="https://api.example.com"
                :disabled="saving"
              />
              <p class="field-hint">
                Base URL for your custom AI API endpoint
              </p>
            </div>

            <!-- Advanced Settings -->
            <v-divider class="my-4" />
            
            <details class="advanced-settings">
              <summary>Advanced Settings</summary>
              
              <div class="field-group">
                <label class="field-label">Temperature ({{ localConfig.temperature }})</label>
                <v-slider
                  v-model="localConfig.temperature"
                  :min="0"
                  :max="2"
                  :step="0.1"
                  :disabled="saving"
                />
                <p class="field-hint">
                  Controls randomness in AI responses. Lower = more focused, Higher = more creative
                </p>
              </div>

              <div class="field-group">
                <label class="field-label">Max Tokens</label>
                <v-input
                  v-model.number="localConfig.maxTokens"
                  type="number"
                  :min="100"
                  :max="4000"
                  :disabled="saving"
                />
                <p class="field-hint">
                  Maximum length of AI responses (100-4000 tokens)
                </p>
              </div>
            </details>
          </template>
        </div>
      </v-card-text>

      <v-card-actions>
        <v-button
          :loading="testing"
          :disabled="!canTest || saving"
          secondary
          @click="testConnection"
        >
          <v-icon name="wifi_protected_setup" class="mr-1" />
          Test Connection
        </v-button>
        
        <v-spacer />
        
        <v-button
          :loading="saving"
          :disabled="!hasChanges"
          @click="saveConfig"
        >
          <v-icon name="save" class="mr-1" />
          Save Configuration
        </v-button>
      </v-card-actions>

      <!-- Test Result -->
      <v-card-text v-if="testResult">
        <v-notice
          :type="testResult.success ? 'success' : 'danger'"
          class="test-result"
        >
          <template #icon>
            <v-icon :name="testResult.success ? 'check_circle' : 'error'" />
          </template>
          {{ testResult.message }}
        </v-notice>
      </v-card-text>
    </v-card>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, onMounted, watch } from 'vue';
import { aiService, type AIConfig } from '../services/ai-service';

// Reactive state
const localConfig = ref<AIConfig>(aiService.getDefaultConfig());
const originalConfig = ref<AIConfig>(aiService.getDefaultConfig());
const saving = ref(false);
const testing = ref(false);
const testResult = ref<{ success: boolean; message: string } | null>(null);

// Provider options
const providerOptions = [
  { label: 'OpenAI (GPT)', value: 'openai' },
  { label: 'Anthropic (Claude)', value: 'claude' },
  { label: 'Custom API', value: 'custom' }
];

// Model options based on provider
const modelOptions = computed(() => {
  switch (localConfig.value.provider) {
    case 'openai':
      return [
        'gpt-3.5-turbo',
        'gpt-3.5-turbo-16k',
        'gpt-4',
        'gpt-4-turbo-preview',
        'gpt-4o'
      ];
    case 'claude':
      return [
        'claude-3-haiku-20240307',
        'claude-3-sonnet-20240229',
        'claude-3-opus-20240229',
        'claude-3-5-sonnet-20241022'
      ];
    case 'custom':
      return [];
    default:
      return [];
  }
});

// Computed properties
const hasChanges = computed(() => {
  return JSON.stringify(localConfig.value) !== JSON.stringify(originalConfig.value);
});

const canTest = computed(() => {
  return localConfig.value.enabled && 
         localConfig.value.apiKey && 
         localConfig.value.provider &&
         (localConfig.value.provider !== 'custom' || localConfig.value.baseUrl);
});

// Methods
const getModelHint = (): string => {
  switch (localConfig.value.provider) {
    case 'openai':
      return 'Recommended: gpt-3.5-turbo for cost efficiency, gpt-4 for best quality';
    case 'claude':
      return 'Recommended: claude-3-haiku for speed, claude-3-sonnet for balance';
    case 'custom':
      return 'Enter the model name supported by your custom API';
    default:
      return '';
  }
};

const loadConfig = (): void => {
  const config = aiService.getConfig();
  if (config) {
    localConfig.value = { ...config };
    originalConfig.value = { ...config };
  }
};

const saveConfig = async (): Promise<void> => {
  saving.value = true;
  testResult.value = null;

  try {
    // Validate configuration
    if (localConfig.value.enabled) {
      if (!localConfig.value.apiKey) {
        throw new Error('API key is required when AI is enabled');
      }
      if (localConfig.value.provider === 'custom' && !localConfig.value.baseUrl) {
        throw new Error('Base URL is required for custom provider');
      }
    }

    // Save configuration
    aiService.saveConfig(localConfig.value);
    originalConfig.value = { ...localConfig.value };

    // Show success message briefly
    testResult.value = {
      success: true,
      message: 'Configuration saved successfully'
    };

    setTimeout(() => {
      testResult.value = null;
    }, 3000);

  } catch (error) {
    testResult.value = {
      success: false,
      message: error instanceof Error ? error.message : 'Failed to save configuration'
    };
  } finally {
    saving.value = false;
  }
};

const testConnection = async (): Promise<void> => {
  testing.value = true;
  testResult.value = null;

  try {
    // Temporarily save config for testing
    const tempService = new (aiService.constructor as any)();
    tempService.saveConfig(localConfig.value);

    // Test with a simple prompt
    const response = await tempService.generateContent({
      prompt: 'Say "Hello, I am working!" (This is a test message)',
      maxTokens: 50
    });

    if (response.error) {
      throw new Error(response.error);
    }

    testResult.value = {
      success: true,
      message: `Connection successful! Response: ${response.content.substring(0, 100)}${response.content.length > 100 ? '...' : ''}`
    };

  } catch (error) {
    testResult.value = {
      success: false,
      message: error instanceof Error ? error.message : 'Connection test failed'
    };
  } finally {
    testing.value = false;
  }
};

// Watch for provider changes to update model
watch(() => localConfig.value.provider, (newProvider) => {
  if (newProvider && modelOptions.value.length > 0) {
    localConfig.value.model = modelOptions.value[0];
  }
});

// Lifecycle
onMounted(() => {
  loadConfig();
});
</script>

<style scoped>
.ai-config-panel {
  max-width: 600px;
  margin: 0 auto;
}

.config-form {
  display: flex;
  flex-direction: column;
  gap: 24px;
}

.field-group {
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.field-label {
  font-weight: 600;
  color: var(--theme--foreground);
  font-size: 14px;
}

.field-hint {
  font-size: 12px;
  color: var(--theme--foreground-subdued);
  margin: 0;
  line-height: 1.4;
}

.advanced-settings {
  margin-top: 16px;
}

.advanced-settings summary {
  cursor: pointer;
  font-weight: 600;
  color: var(--theme--foreground);
  padding: 8px 0;
}

.advanced-settings[open] summary {
  margin-bottom: 16px;
}

.test-result {
  margin-top: 16px;
}

.v-card-actions {
  padding: 16px 24px;
  border-top: 1px solid var(--theme--border-color);
}
</style>