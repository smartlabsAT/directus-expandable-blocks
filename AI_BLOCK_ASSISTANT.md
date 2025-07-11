# 🤖 AI Block Assistant - Implementation Guide

## 📋 Table of Contents
1. [Feature Overview](#feature-overview)
2. [User Stories](#user-stories)
3. [Technical Architecture](#technical-architecture)
4. [UI/UX Design](#uiux-design)
5. [Implementation Roadmap](#implementation-roadmap)
6. [Component Specifications](#component-specifications)
7. [AI Service Integration](#ai-service-integration)
8. [Configuration System](#configuration-system)
9. [Testing Strategy](#testing-strategy)
10. [Deployment & Distribution](#deployment--distribution)

---

## 🎯 Feature Overview

The AI Block Assistant enhances the expandable-blocks extension with intelligent content generation and optimization capabilities. This feature integrates seamlessly into the existing block system without requiring additional server infrastructure.

### Core Features:
- **🤖 AI Template Generator**: Generate complete blocks from natural language descriptions
- **✨ Smart Block Assistant**: Real-time content improvement suggestions
- **📝 Content Optimization**: Grammar, style, and readability improvements
- **🌍 Multi-language Support**: Translation and localization assistance
- **🎨 Context-Aware Suggestions**: Industry and page-specific recommendations

---

## 👤 User Stories

### Story 1: Content Creator
> "As a content creator, I want to quickly generate a hero section for my SaaS landing page without writing everything from scratch."

**Acceptance Criteria:**
- User can click "Generate with AI" when adding a new block
- User can describe their needs in natural language
- System generates appropriate content and structure
- User can preview and edit before adding to page

### Story 2: Content Editor
> "As a content editor, I want to improve existing block content for grammar, tone, and engagement."

**Acceptance Criteria:**
- AI button (✨) appears in every block header
- Clicking opens assistant drawer with suggestions
- User can apply improvements with one click
- Original content is preserved until explicitly replaced

### Story 3: Marketing Manager
> "As a marketing manager, I want context-aware suggestions for what blocks to add next to improve conversion."

**Acceptance Criteria:**
- AI analyzes existing page content
- Suggests complementary blocks (testimonials, pricing, FAQ)
- Recommendations are industry-specific
- Integration with existing "Add Block" workflow

---

## 🛠 Technical Architecture

### High-Level Architecture
```
┌─ Expandable Blocks Extension ─────────────────────┐
│                                                   │
│ ┌─ AI Layer ─────────────────────────────────────┐ │
│ │                                                │ │
│ │  ┌─ AI Service ──┐  ┌─ Template Engine ──┐     │ │
│ │  │ • OpenAI      │  │ • Block Generator   │     │ │
│ │  │ • Claude      │  │ • Content Parser    │     │ │
│ │  │ • Custom API  │  │ • Context Analyzer  │     │ │
│ │  └───────────────┘  └─────────────────────┘     │ │
│ │                                                │ │
│ │  ┌─ UI Components ─────────────────────────────┐ │ │
│ │  │ • AITemplateGenerator.vue                  │ │ │
│ │  │ • AIAssistantDrawer.vue                    │ │ │
│ │  │ • AIConfigPanel.vue                        │ │ │
│ │  └────────────────────────────────────────────┘ │ │
│ └────────────────────────────────────────────────┘ │
│                                                   │
│ ┌─ Existing Block System ──────────────────────────┐ │
│ │ • Block Management                               │ │
│ │ • Drag & Drop                                    │ │
│ │ • Save/Discard Logic                             │ │
│ └──────────────────────────────────────────────────┘ │
└───────────────────────────────────────────────────┘
```

### Key Design Principles:
1. **No Server Dependency**: All AI calls made from client-side
2. **Provider Agnostic**: Support multiple AI service providers
3. **Progressive Enhancement**: Works without AI configuration
4. **Privacy First**: User owns their API keys and data
5. **NPM Compatible**: Deployable as standard Directus extension

---

## 💡 UI/UX Design

### AI Template Generator Flow

```
Step 1: Add Block Trigger
┌─ Add New Block ─────────────────┐
│ [Quick Add] [Templates] [🤖 AI] │
└─────────────────────────────────┘
                  ↓ Click AI
Step 2: AI Generation Dialog
┌─ Generate Block with AI ────────┐
│ What would you like to create?  │
│ ┌─────────────────────────────────┐
│ │ "Hero section for a tech      │
│ │ startup about AI tools"       │
│ └─────────────────────────────────┘
│                                 │
│ Block Type: [Auto-detect ▼]     │
│ Industry: [Technology ▼]        │
│ Tone: [Professional ▼]         │
│ Language: [English ▼]          │
│                                 │
│ [✨ Generate] [Cancel]          │
└─────────────────────────────────┘
                  ↓
Step 3: Preview & Edit
┌─ Generated Block Preview ───────┐
│ 🎯 Hero Section               │
│ ┌─────────────────────────────────┐
│ │ Revolutionize Your Workflow   │
│ │ with AI-Powered Tools         │
│ │                               │
│ │ Transform your business...    │
│ │ [Get Started →]               │
│ └─────────────────────────────────┘
│                                 │
│ [✓ Add Block] [↻ Regenerate]   │
│ [✏️ Edit First] [✕ Cancel]      │
└─────────────────────────────────┘
```

### AI Assistant Drawer

```
Block Header Integration:
┌─ Block: Hero Section ─────────────────────┐
│ [📝 Title] [✨ AI] [⚙️ Settings] [⋮ More] │
└───────────────────────────────────────────┘
              ↓ Click AI ✨
                         
AI Assistant Drawer (Right Side):
┌─ ✨ AI Assistant ───────────────────────┐
│ 🔍 Analyzing "Hero Section"...          │
│                                         │
│ 📊 Content Analysis                     │
│ ├─ ✓ Grammar: Excellent                 │
│ ├─ ⚠️ Engagement: Could be improved     │
│ └─ ✓ Length: Optimal for hero section   │
│                                         │
│ 💡 Improvement Suggestions              │
│ ┌─────────────────────────────────────┐   │
│ │ 🎯 Make more action-oriented         │   │
│ │ "Transform" → "Revolutionize"        │   │
│ │ [Preview] [Apply]                   │   │
│ └─────────────────────────────────────┘   │
│                                         │
│ ┌─────────────────────────────────────┐   │
│ │ ✍️ Add urgency indicator             │   │
│ │ Add "Join 10,000+ satisfied users"  │   │
│ │ [Preview] [Apply]                   │   │
│ └─────────────────────────────────────┘   │
│                                         │
│ 🔧 Quick Actions                        │
│ ├─ 📝 Fix grammar & spelling            │
│ ├─ 🎨 Adjust tone (formal/casual)       │
│ ├─ 📏 Make shorter/longer               │
│ ├─ 🌍 Translate to German               │
│ └─ 🔄 Completely rewrite                │
│                                         │
│ [Close] [Settings]                      │
└─────────────────────────────────────────┘
```

### AI Configuration Panel

```
┌─ AI Configuration ─────────────────────┐
│                                        │
│ 🤖 AI Provider                         │
│ ○ OpenAI (Recommended)                 │
│ ○ Anthropic Claude                     │
│ ○ Directus Cloud AI (Coming Soon)      │
│ ○ Custom Endpoint                      │
│                                        │
│ 🔑 API Configuration                   │
│ API Key: [••••••••••••••••] [Test]     │
│                                        │
│ ⚙️ Default Settings                    │
│ ☑️ Enable auto-suggestions             │
│ ☑️ Grammar check on save               │
│ ☐ Auto-translate content               │
│                                        │
│ 🎯 Content Preferences                 │
│ Default Industry: [Technology ▼]       │
│ Default Tone: [Professional ▼]        │
│ Default Language: [English ▼]         │
│                                        │
│ 💰 Usage & Limits                      │
│ This month: 47/1000 requests          │
│ [View Detailed Usage]                  │
│                                        │
│ [Save Settings] [Reset to Defaults]    │
└────────────────────────────────────────┘
```

---

## 🚀 Implementation Roadmap

### Phase 1: Foundation (Week 1-2)
**Goal**: Basic AI integration and template generation

#### 1.1 Core AI Service
```typescript
// src/ai/ai-service.ts
interface AIProvider {
  generateContent(prompt: string, options: GenerationOptions): Promise<string>
  improveText(text: string, instructions: string): Promise<string>
  analyzeContent(text: string): Promise<ContentAnalysis>
}

class OpenAIProvider implements AIProvider {
  // Implementation
}

class AIService {
  private provider: AIProvider
  
  async generateBlock(description: string, context: BlockContext): Promise<BlockData>
  async suggestImprovements(content: string): Promise<Suggestion[]>
}
```

#### 1.2 Template Generator Component
```vue
<!-- src/components/AITemplateGenerator.vue -->
<template>
  <v-dialog v-model="isOpen" max-width="600">
    <v-card>
      <v-card-title>Generate Block with AI</v-card-title>
      <v-card-text>
        <!-- Input form for description, settings -->
      </v-card-text>
      <v-card-actions>
        <!-- Generate, Cancel buttons -->
      </v-card-actions>
    </v-card>
  </v-dialog>
</template>
```

#### 1.3 AI Button Integration
```vue
<!-- Modify existing interface.vue -->
<div class="block-header">
  <span class="block-title">{{ getItemTitle(item) }}</span>
  
  <!-- New AI Button -->
  <v-button 
    v-if="hasAIConfig"
    @click="openAIAssistant(item)"
    icon="auto_awesome"
    x-small
    outlined
    class="ai-assistant-btn"
    v-tooltip="'AI Assistant'"
  />
</div>
```

### Phase 2: Advanced Features (Week 3-4)
**Goal**: Smart suggestions and content analysis

#### 2.1 AI Assistant Drawer
```vue
<!-- src/components/AIAssistantDrawer.vue -->
<template>
  <v-navigation-drawer
    v-model="isOpen"
    location="right"
    width="400"
    temporary
  >
    <div class="ai-assistant">
      <!-- Content analysis -->
      <!-- Improvement suggestions -->
      <!-- Quick actions -->
    </div>
  </v-navigation-drawer>
</template>
```

#### 2.2 Context-Aware Suggestions
```typescript
// src/ai/context-analyzer.ts
class ContextAnalyzer {
  analyzePageContext(blocks: BlockData[]): PageContext {
    // Analyze existing blocks to understand page purpose
    // Detect industry, tone, target audience
    // Identify missing content types
  }
  
  suggestNextBlocks(context: PageContext): BlockSuggestion[] {
    // AI-powered suggestions for complementary blocks
  }
}
```

#### 2.3 Real-time Content Analysis
```typescript
// src/ai/content-analyzer.ts
interface ContentAnalysis {
  grammar: {
    score: number
    issues: GrammarIssue[]
  }
  readability: {
    score: number
    level: string
    suggestions: string[]
  }
  engagement: {
    score: number
    improvements: string[]
  }
  seo: {
    score: number
    recommendations: string[]
  }
}
```

### Phase 3: Advanced Intelligence (Week 5-6)
**Goal**: Multi-language, industry templates, and automation

#### 3.1 Industry-Specific Templates
```typescript
// src/ai/industry-templates.ts
interface IndustryTemplate {
  industry: string
  blockType: string
  prompts: {
    generate: string
    improve: string
    tone: string[]
  }
  examples: BlockExample[]
}

const INDUSTRY_TEMPLATES: Record<string, IndustryTemplate[]> = {
  'saas': [...],
  'ecommerce': [...],
  'restaurant': [...],
  'healthcare': [...],
  // etc.
}
```

#### 3.2 Multi-language Support
```typescript
// src/ai/translation-service.ts
class TranslationService {
  async translateBlock(block: BlockData, targetLanguage: string): Promise<BlockData>
  async detectLanguage(text: string): Promise<string>
  async suggestLocalizations(content: string, market: string): Promise<string[]>
}
```

#### 3.3 Automation Features
- Auto-suggestions while typing (debounced)
- Batch content optimization
- SEO optimization hints
- A/B testing content variants

---

## 🔧 Component Specifications

### AIService Core Class

```typescript
// src/ai/ai-service.ts
interface AIConfig {
  provider: 'openai' | 'claude' | 'custom'
  apiKey?: string
  baseUrl?: string
  model?: string
  maxTokens?: number
  temperature?: number
}

interface GenerationOptions {
  blockType?: string
  industry?: string
  tone?: 'professional' | 'casual' | 'friendly' | 'authoritative'
  language?: string
  maxLength?: number
  includeCallToAction?: boolean
}

interface BlockContext {
  pageType?: string
  existingBlocks?: BlockData[]
  targetAudience?: string
  businessGoals?: string[]
}

interface Suggestion {
  id: string
  type: 'grammar' | 'style' | 'engagement' | 'seo'
  description: string
  originalText: string
  suggestedText: string
  confidence: number
  rationale: string
}

class AIService {
  private config: AIConfig
  private provider: AIProvider
  
  constructor(config: AIConfig) {
    this.config = config
    this.provider = this.createProvider(config.provider)
  }
  
  // Template Generation
  async generateBlockContent(
    description: string, 
    options: GenerationOptions = {},
    context: BlockContext = {}
  ): Promise<BlockData> {
    const prompt = this.buildGenerationPrompt(description, options, context)
    const response = await this.provider.generateContent(prompt, options)
    return this.parseBlockResponse(response, options)
  }
  
  // Content Improvement
  async analyzeContent(text: string): Promise<ContentAnalysis> {
    const prompt = this.buildAnalysisPrompt(text)
    const response = await this.provider.analyzeContent(prompt)
    return this.parseAnalysisResponse(response)
  }
  
  async suggestImprovements(
    text: string, 
    focusAreas: string[] = ['grammar', 'engagement']
  ): Promise<Suggestion[]> {
    const suggestions: Suggestion[] = []
    
    for (const area of focusAreas) {
      const prompt = this.buildImprovementPrompt(text, area)
      const response = await this.provider.improveText(prompt, area)
      suggestions.push(...this.parseImprovementResponse(response, area))
    }
    
    return suggestions.sort((a, b) => b.confidence - a.confidence)
  }
  
  // Context Analysis
  async analyzePageContext(blocks: BlockData[]): Promise<PageContext> {
    const content = blocks.map(b => this.extractTextContent(b)).join('\n\n')
    const prompt = this.buildContextPrompt(content)
    const response = await this.provider.analyzeContent(prompt)
    return this.parseContextResponse(response)
  }
  
  async suggestNextBlocks(context: PageContext): Promise<BlockSuggestion[]> {
    const prompt = this.buildSuggestionPrompt(context)
    const response = await this.provider.generateContent(prompt, {})
    return this.parseSuggestionResponse(response)
  }
  
  // Utility Methods
  private buildGenerationPrompt(
    description: string, 
    options: GenerationOptions,
    context: BlockContext
  ): string {
    let prompt = `Generate content for a ${options.blockType || 'content'} block based on this description: "${description}"`
    
    if (options.industry) {
      prompt += `\nIndustry: ${options.industry}`
    }
    
    if (options.tone) {
      prompt += `\nTone: ${options.tone}`
    }
    
    if (context.pageType) {
      prompt += `\nPage type: ${context.pageType}`
    }
    
    if (context.existingBlocks?.length) {
      prompt += `\nExisting content context: ${this.summarizeBlocks(context.existingBlocks)}`
    }
    
    prompt += `\nReturn response as JSON with this structure:
    {
      "title": "Block title",
      "content": "Main content",
      "metadata": {
        "callToAction": "Optional CTA text",
        "style": "suggested styling",
        "keywords": ["relevant", "keywords"]
      }
    }`
    
    return prompt
  }
  
  private buildImprovementPrompt(text: string, focusArea: string): string {
    const prompts = {
      grammar: `Fix grammar and spelling errors in this text: "${text}"`,
      engagement: `Make this text more engaging and compelling: "${text}"`,
      clarity: `Improve clarity and readability of this text: "${text}"`,
      seo: `Optimize this text for SEO while maintaining readability: "${text}"`,
      tone: `Adjust the tone of this text to be more professional: "${text}"`
    }
    
    return prompts[focusArea as keyof typeof prompts] || prompts.grammar
  }
}
```

### AITemplateGenerator Component

```vue
<!-- src/components/AITemplateGenerator.vue -->
<template>
  <v-dialog 
    v-model="isOpen" 
    max-width="700"
    persistent
    scrollable
  >
    <v-card>
      <v-card-title class="d-flex align-center">
        <v-icon class="mr-2" color="primary">auto_awesome</v-icon>
        Generate Block with AI
      </v-card-title>
      
      <v-card-text>
        <v-container>
          <!-- Description Input -->
          <v-row>
            <v-col cols="12">
              <v-textarea
                v-model="description"
                label="Describe what you want to create"
                placeholder="e.g., Hero section for a SaaS product that helps teams collaborate better"
                rows="3"
                outlined
                :rules="[rules.required]"
                hint="Be specific about the purpose, audience, and key message"
              />
            </v-col>
          </v-row>
          
          <!-- Options -->
          <v-row>
            <v-col cols="6">
              <v-select
                v-model="options.blockType"
                :items="blockTypes"
                label="Block Type"
                outlined
                hint="Auto-detect will analyze your description"
              />
            </v-col>
            
            <v-col cols="6">
              <v-select
                v-model="options.industry"
                :items="industries"
                label="Industry"
                outlined
                clearable
              />
            </v-col>
          </v-row>
          
          <v-row>
            <v-col cols="6">
              <v-select
                v-model="options.tone"
                :items="tones"
                label="Tone of Voice"
                outlined
              />
            </v-col>
            
            <v-col cols="6">
              <v-select
                v-model="options.language"
                :items="languages"
                label="Language"
                outlined
              />
            </v-col>
          </v-row>
          
          <!-- Advanced Options (Collapsible) -->
          <v-expansion-panels v-model="advancedPanel" class="mt-4">
            <v-expansion-panel>
              <v-expansion-panel-header>
                <span class="text-subtitle-2">Advanced Options</span>
              </v-expansion-panel-header>
              
              <v-expansion-panel-content>
                <v-row>
                  <v-col cols="6">
                    <v-slider
                      v-model="options.maxLength"
                      :min="50"
                      :max="500"
                      label="Max Length (words)"
                      thumb-label
                      step="25"
                    />
                  </v-col>
                  
                  <v-col cols="6">
                    <v-switch
                      v-model="options.includeCallToAction"
                      label="Include Call-to-Action"
                      inset
                    />
                  </v-col>
                </v-row>
                
                <v-textarea
                  v-model="additionalContext"
                  label="Additional Context (Optional)"
                  placeholder="Target audience, brand personality, specific requirements..."
                  rows="2"
                  outlined
                />
              </v-expansion-panel-content>
            </v-expansion-panel>
          </v-expansion-panels>
          
          <!-- Generated Content Preview -->
          <v-card 
            v-if="generatedContent" 
            class="mt-6" 
            outlined
          >
            <v-card-subtitle class="d-flex align-center">
              <v-icon class="mr-2" color="success">check_circle</v-icon>
              Generated Content Preview
            </v-card-subtitle>
            
            <v-card-text>
              <div class="generated-preview">
                <div class="block-preview" :class="`block-type-${generatedContent.type}`">
                  <h3 v-if="generatedContent.title" class="preview-title">
                    {{ generatedContent.title }}
                  </h3>
                  
                  <div 
                    class="preview-content" 
                    v-html="formatPreviewContent(generatedContent.content)"
                  />
                  
                  <v-chip
                    v-if="generatedContent.metadata?.callToAction"
                    class="mt-2"
                    color="primary"
                    outlined
                    small
                  >
                    {{ generatedContent.metadata.callToAction }}
                  </v-chip>
                </div>
              </div>
            </v-card-text>
          </v-card>
          
          <!-- Error Display -->
          <v-alert
            v-if="error"
            type="error"
            dismissible
            class="mt-4"
          >
            {{ error }}
          </v-alert>
        </v-container>
      </v-card-text>
      
      <v-card-actions>
        <v-spacer />
        
        <v-btn
          text
          @click="close"
          :disabled="isGenerating"
        >
          Cancel
        </v-btn>
        
        <v-btn
          v-if="generatedContent"
          text
          color="warning"
          @click="regenerate"
          :loading="isGenerating"
        >
          <v-icon left>refresh</v-icon>
          Regenerate
        </v-btn>
        
        <v-btn
          v-if="!generatedContent"
          color="primary"
          @click="generate"
          :loading="isGenerating"
          :disabled="!canGenerate"
        >
          <v-icon left>auto_awesome</v-icon>
          Generate
        </v-btn>
        
        <v-btn
          v-if="generatedContent"
          color="success"
          @click="addBlock"
          :disabled="isGenerating"
        >
          <v-icon left>add</v-icon>
          Add Block
        </v-btn>
      </v-card-actions>
    </v-card>
  </v-dialog>
</template>

<script setup lang="ts">
import { ref, computed, inject } from 'vue'
import { AIService } from '@/ai/ai-service'
import type { GenerationOptions, BlockData } from '@/types'

// Props & Emits
interface Props {
  modelValue: boolean
  collection: string
  allowedCollections?: string[]
}

interface Emits {
  (e: 'update:modelValue', value: boolean): void
  (e: 'block-generated', block: BlockData): void
}

const props = defineProps<Props>()
const emit = defineEmits<Emits>()

// Services
const aiService = inject<AIService>('aiService')

// Reactive Data
const description = ref('')
const additionalContext = ref('')
const advancedPanel = ref<number>()
const isGenerating = ref(false)
const generatedContent = ref<BlockData | null>(null)
const error = ref('')

const options = ref<GenerationOptions>({
  blockType: 'auto-detect',
  industry: '',
  tone: 'professional',
  language: 'en',
  maxLength: 200,
  includeCallToAction: true
})

// Computed
const isOpen = computed({
  get: () => props.modelValue,
  set: (value) => emit('update:modelValue', value)
})

const canGenerate = computed(() => {
  return description.value.trim().length > 10 && aiService
})

// Data Options
const blockTypes = [
  { text: 'Auto-detect', value: 'auto-detect' },
  { text: 'Hero Section', value: 'hero' },
  { text: 'Text Content', value: 'text' },
  { text: 'Call to Action', value: 'cta' },
  { text: 'Features List', value: 'features' },
  { text: 'Testimonial', value: 'testimonial' }
]

const industries = [
  { text: 'Technology/SaaS', value: 'technology' },
  { text: 'E-commerce', value: 'ecommerce' },
  { text: 'Healthcare', value: 'healthcare' },
  { text: 'Education', value: 'education' },
  { text: 'Finance', value: 'finance' },
  { text: 'Real Estate', value: 'realestate' },
  { text: 'Restaurant/Food', value: 'restaurant' },
  { text: 'Creative/Agency', value: 'creative' }
]

const tones = [
  { text: 'Professional', value: 'professional' },
  { text: 'Friendly', value: 'friendly' },
  { text: 'Casual', value: 'casual' },
  { text: 'Authoritative', value: 'authoritative' },
  { text: 'Inspirational', value: 'inspirational' }
]

const languages = [
  { text: 'English', value: 'en' },
  { text: 'German', value: 'de' },
  { text: 'Spanish', value: 'es' },
  { text: 'French', value: 'fr' }
]

// Validation Rules
const rules = {
  required: (value: string) => !!value || 'This field is required'
}

// Methods
const generate = async () => {
  if (!aiService || !canGenerate.value) return
  
  isGenerating.value = true
  error.value = ''
  generatedContent.value = null
  
  try {
    const context = {
      pageType: 'content-page', // Could be detected from current page
      additionalContext: additionalContext.value
    }
    
    const result = await aiService.generateBlockContent(
      description.value,
      options.value,
      context
    )
    
    generatedContent.value = result
  } catch (err: any) {
    error.value = err.message || 'Failed to generate content. Please try again.'
  } finally {
    isGenerating.value = false
  }
}

const regenerate = () => {
  generatedContent.value = null
  generate()
}

const addBlock = () => {
  if (generatedContent.value) {
    emit('block-generated', generatedContent.value)
    close()
  }
}

const close = () => {
  if (!isGenerating.value) {
    isOpen.value = false
    // Reset form
    description.value = ''
    additionalContext.value = ''
    generatedContent.value = null
    error.value = ''
  }
}

const formatPreviewContent = (content: string): string => {
  // Simple markdown-like formatting for preview
  return content
    .replace(/\n\n/g, '</p><p>')
    .replace(/\n/g, '<br>')
    .replace(/^(.+)$/, '<p>$1</p>')
}
</script>

<style scoped>
.generated-preview {
  border: 2px dashed #e0e0e0;
  border-radius: 8px;
  padding: 20px;
  background: #fafafa;
}

.block-preview {
  max-width: 100%;
}

.preview-title {
  color: #1976d2;
  margin-bottom: 12px;
}

.preview-content {
  line-height: 1.6;
  color: #424242;
}

.block-type-hero .preview-content {
  font-size: 1.1em;
  text-align: center;
}

.block-type-cta {
  text-align: center;
  background: linear-gradient(45deg, #1976d2, #42a5f5);
  color: white;
  border-radius: 8px;
}

.ai-assistant-btn {
  background: linear-gradient(45deg, #667eea 0%, #764ba2 100%);
  color: white;
}
</style>
```

### AIAssistantDrawer Component

```vue
<!-- src/components/AIAssistantDrawer.vue -->
<template>
  <v-navigation-drawer
    v-model="isOpen"
    location="right"
    width="420"
    temporary
    class="ai-assistant-drawer"
  >
    <v-toolbar flat color="primary" dark>
      <v-icon class="mr-2">auto_awesome</v-icon>
      <v-toolbar-title>AI Assistant</v-toolbar-title>
      <v-spacer />
      <v-btn icon @click="close">
        <v-icon>close</v-icon>
      </v-btn>
    </v-toolbar>
    
    <div class="drawer-content">
      <!-- Loading State -->
      <v-card v-if="isAnalyzing" class="ma-4" outlined>
        <v-card-text class="text-center py-8">
          <v-progress-circular
            indeterminate
            color="primary"
            size="48"
            class="mb-4"
          />
          <div class="text-h6 mb-2">Analyzing Content</div>
          <div class="text-body-2 text--secondary">
            AI is reviewing "{{ blockTitle }}"...
          </div>
        </v-card-text>
      </v-card>
      
      <!-- Content Analysis Results -->
      <div v-if="analysis && !isAnalyzing" class="analysis-section">
        <!-- Analysis Overview -->
        <v-card class="ma-4" outlined>
          <v-card-subtitle class="d-flex align-center">
            <v-icon class="mr-2" color="primary">assessment</v-icon>
            Content Analysis
          </v-card-subtitle>
          
          <v-card-text>
            <div class="analysis-metrics">
              <div class="metric-item">
                <div class="metric-label">Grammar</div>
                <v-progress-linear
                  :value="analysis.grammar.score"
                  :color="getScoreColor(analysis.grammar.score)"
                  height="8"
                  rounded
                />
                <div class="metric-score">{{ analysis.grammar.score }}%</div>
              </div>
              
              <div class="metric-item">
                <div class="metric-label">Engagement</div>
                <v-progress-linear
                  :value="analysis.engagement.score"
                  :color="getScoreColor(analysis.engagement.score)"
                  height="8"
                  rounded
                />
                <div class="metric-score">{{ analysis.engagement.score }}%</div>
              </div>
              
              <div class="metric-item">
                <div class="metric-label">Readability</div>
                <v-progress-linear
                  :value="analysis.readability.score"
                  :color="getScoreColor(analysis.readability.score)"
                  height="8"
                  rounded
                />
                <div class="metric-score">{{ analysis.readability.score }}%</div>
              </div>
            </div>
          </v-card-text>
        </v-card>
        
        <!-- Improvement Suggestions -->
        <v-card v-if="suggestions.length > 0" class="ma-4" outlined>
          <v-card-subtitle class="d-flex align-center">
            <v-icon class="mr-2" color="success">lightbulb</v-icon>
            Improvement Suggestions
            <v-spacer />
            <v-chip small color="primary" outlined>{{ suggestions.length }}</v-chip>
          </v-card-subtitle>
          
          <v-card-text class="pa-0">
            <div
              v-for="(suggestion, index) in suggestions"
              :key="suggestion.id"
              class="suggestion-item"
            >
              <div class="suggestion-header">
                <v-icon
                  :color="getSuggestionTypeColor(suggestion.type)"
                  size="20"
                  class="mr-2"
                >
                  {{ getSuggestionTypeIcon(suggestion.type) }}
                </v-icon>
                
                <div class="suggestion-info">
                  <div class="suggestion-description">{{ suggestion.description }}</div>
                  <div class="suggestion-confidence">
                    Confidence: {{ Math.round(suggestion.confidence * 100) }}%
                  </div>
                </div>
                
                <v-spacer />
                
                <v-btn
                  small
                  outlined
                  color="primary"
                  @click="previewSuggestion(suggestion)"
                >
                  Preview
                </v-btn>
              </div>
              
              <!-- Original vs Suggested -->
              <div v-if="suggestion.originalText !== suggestion.suggestedText" class="text-comparison">
                <div class="original-text">
                  <div class="text-label">Original:</div>
                  <div class="text-content">{{ suggestion.originalText }}</div>
                </div>
                
                <v-icon class="comparison-arrow">arrow_downward</v-icon>
                
                <div class="suggested-text">
                  <div class="text-label">Suggested:</div>
                  <div class="text-content">{{ suggestion.suggestedText }}</div>
                </div>
              </div>
              
              <!-- Action Buttons -->
              <div class="suggestion-actions">
                <v-btn
                  small
                  color="success"
                  @click="applySuggestion(suggestion)"
                  :loading="isApplying === suggestion.id"
                >
                  <v-icon left size="16">check</v-icon>
                  Apply
                </v-btn>
                
                <v-btn
                  small
                  text
                  @click="dismissSuggestion(suggestion.id)"
                >
                  Dismiss
                </v-btn>
              </div>
              
              <v-divider v-if="index < suggestions.length - 1" />
            </div>
          </v-card-text>
        </v-card>
        
        <!-- Quick Actions -->
        <v-card class="ma-4" outlined>
          <v-card-subtitle class="d-flex align-center">
            <v-icon class="mr-2" color="warning">flash_on</v-icon>
            Quick Actions
          </v-card-subtitle>
          
          <v-card-text>
            <div class="quick-actions">
              <v-btn
                block
                outlined
                class="mb-2"
                @click="quickAction('grammar')"
                :loading="isProcessing === 'grammar'"
              >
                <v-icon left>spellcheck</v-icon>
                Fix Grammar & Spelling
              </v-btn>
              
              <v-btn
                block
                outlined
                class="mb-2"
                @click="quickAction('tone')"
                :loading="isProcessing === 'tone'"
              >
                <v-icon left>tune</v-icon>
                Adjust Tone
              </v-btn>
              
              <v-btn
                block
                outlined
                class="mb-2"
                @click="quickAction('shorter')"
                :loading="isProcessing === 'shorter'"
              >
                <v-icon left>compress</v-icon>
                Make Shorter
              </v-btn>
              
              <v-btn
                block
                outlined
                class="mb-2"
                @click="quickAction('longer')"
                :loading="isProcessing === 'longer'"
              >
                <v-icon left>expand</v-icon>
                Add More Detail
              </v-btn>
              
              <v-btn
                block
                outlined
                class="mb-2"
                @click="showTranslationOptions = !showTranslationOptions"
              >
                <v-icon left>translate</v-icon>
                Translate
                <v-icon right>{{ showTranslationOptions ? 'expand_less' : 'expand_more' }}</v-icon>
              </v-btn>
              
              <!-- Translation Options -->
              <v-expand-transition>
                <div v-show="showTranslationOptions" class="translation-options mt-2">
                  <v-btn
                    v-for="lang in translationLanguages"
                    :key="lang.code"
                    small
                    outlined
                    class="ma-1"
                    @click="translateTo(lang.code)"
                    :loading="isProcessing === `translate-${lang.code}`"
                  >
                    {{ lang.flag }} {{ lang.name }}
                  </v-btn>
                </div>
              </v-expand-transition>
              
              <v-divider class="my-3" />
              
              <v-btn
                block
                outlined
                color="warning"
                @click="rewriteCompletely"
                :loading="isProcessing === 'rewrite'"
              >
                <v-icon left>refresh</v-icon>
                Completely Rewrite
              </v-btn>
            </div>
          </v-card-text>
        </v-card>
      </div>
      
      <!-- Error State -->
      <v-alert
        v-if="error"
        type="error"
        class="ma-4"
        dismissible
        @input="error = ''"
      >
        {{ error }}
      </v-alert>
      
      <!-- Settings -->
      <v-card class="ma-4" outlined>
        <v-card-subtitle class="d-flex align-center">
          <v-icon class="mr-2" color="grey">settings</v-icon>
          Assistant Settings
        </v-card-subtitle>
        
        <v-card-text>
          <v-switch
            v-model="autoAnalyze"
            label="Auto-analyze on open"
            inset
            dense
          />
          
          <v-switch
            v-model="showConfidence"
            label="Show confidence scores"
            inset
            dense
          />
          
          <v-btn
            text
            small
            color="primary"
            @click="openAIConfig"
          >
            <v-icon left size="16">settings</v-icon>
            AI Configuration
          </v-btn>
        </v-card-text>
      </v-card>
    </div>
  </v-navigation-drawer>
</template>

<script setup lang="ts">
import { ref, computed, watch, inject, nextTick } from 'vue'
import { AIService } from '@/ai/ai-service'
import type { BlockData, ContentAnalysis, Suggestion } from '@/types'

// Props & Emits
interface Props {
  modelValue: boolean
  block: BlockData | null
  blockTitle: string
}

interface Emits {
  (e: 'update:modelValue', value: boolean): void
  (e: 'content-updated', content: string): void
  (e: 'open-ai-config'): void
}

const props = defineProps<Props>()
const emit = defineEmits<Emits>()

// Services
const aiService = inject<AIService>('aiService')

// Reactive Data
const isAnalyzing = ref(false)
const isApplying = ref<string>('')
const isProcessing = ref<string>('')
const analysis = ref<ContentAnalysis | null>(null)
const suggestions = ref<Suggestion[]>([])
const error = ref('')
const autoAnalyze = ref(true)
const showConfidence = ref(true)
const showTranslationOptions = ref(false)

// Computed
const isOpen = computed({
  get: () => props.modelValue,
  set: (value) => emit('update:modelValue', value)
})

// Data
const translationLanguages = [
  { code: 'de', name: 'German', flag: '🇩🇪' },
  { code: 'es', name: 'Spanish', flag: '🇪🇸' },
  { code: 'fr', name: 'French', flag: '🇫🇷' },
  { code: 'it', name: 'Italian', flag: '🇮🇹' }
]

// Watchers
watch(() => props.modelValue, (newVal) => {
  if (newVal && props.block && autoAnalyze.value) {
    nextTick(() => analyzeContent())
  }
})

// Methods
const analyzeContent = async () => {
  if (!aiService || !props.block) return
  
  isAnalyzing.value = true
  error.value = ''
  
  try {
    const content = extractTextContent(props.block)
    
    // Run analysis and suggestions in parallel
    const [analysisResult, suggestionsResult] = await Promise.all([
      aiService.analyzeContent(content),
      aiService.suggestImprovements(content, ['grammar', 'engagement', 'clarity'])
    ])
    
    analysis.value = analysisResult
    suggestions.value = suggestionsResult
  } catch (err: any) {
    error.value = err.message || 'Failed to analyze content'
  } finally {
    isAnalyzing.value = false
  }
}

const extractTextContent = (block: BlockData): string => {
  // Extract text content from block based on its structure
  let content = ''
  
  if (block.title) content += block.title + '\n\n'
  if (block.content) content += block.content
  if (block.subtitle) content += '\n\n' + block.subtitle
  
  return content.trim()
}

const applySuggestion = async (suggestion: Suggestion) => {
  isApplying.value = suggestion.id
  
  try {
    // Apply the suggestion to the content
    emit('content-updated', suggestion.suggestedText)
    
    // Remove the applied suggestion
    suggestions.value = suggestions.value.filter(s => s.id !== suggestion.id)
    
    // Show success feedback
    // Could emit success event or show toast
  } catch (err: any) {
    error.value = 'Failed to apply suggestion'
  } finally {
    isApplying.value = ''
  }
}

const dismissSuggestion = (suggestionId: string) => {
  suggestions.value = suggestions.value.filter(s => s.id !== suggestionId)
}

const previewSuggestion = (suggestion: Suggestion) => {
  // Could open a preview dialog or highlight changes
  console.log('Preview suggestion:', suggestion)
}

const quickAction = async (action: string) => {
  if (!aiService || !props.block) return
  
  isProcessing.value = action
  
  try {
    const content = extractTextContent(props.block)
    let improvedContent: string
    
    switch (action) {
      case 'grammar':
        improvedContent = await aiService.improveText(content, 'Fix grammar and spelling errors')
        break
      case 'tone':
        improvedContent = await aiService.improveText(content, 'Make the tone more professional and engaging')
        break
      case 'shorter':
        improvedContent = await aiService.improveText(content, 'Make this text more concise while keeping the key message')
        break
      case 'longer':
        improvedContent = await aiService.improveText(content, 'Expand this text with more details and examples')
        break
      case 'rewrite':
        improvedContent = await aiService.improveText(content, 'Completely rewrite this content to be more engaging and effective')
        break
      default:
        throw new Error('Unknown action')
    }
    
    emit('content-updated', improvedContent)
  } catch (err: any) {
    error.value = err.message || 'Failed to process content'
  } finally {
    isProcessing.value = ''
  }
}

const translateTo = async (languageCode: string) => {
  if (!aiService || !props.block) return
  
  isProcessing.value = `translate-${languageCode}`
  
  try {
    const content = extractTextContent(props.block)
    const translatedContent = await aiService.translateContent(content, languageCode)
    emit('content-updated', translatedContent)
  } catch (err: any) {
    error.value = err.message || 'Failed to translate content'
  } finally {
    isProcessing.value = ''
  }
}

const getScoreColor = (score: number): string => {
  if (score >= 80) return 'success'
  if (score >= 60) return 'warning'
  return 'error'
}

const getSuggestionTypeColor = (type: string): string => {
  const colors = {
    grammar: 'error',
    style: 'warning',
    engagement: 'success',
    seo: 'info'
  }
  return colors[type as keyof typeof colors] || 'grey'
}

const getSuggestionTypeIcon = (type: string): string => {
  const icons = {
    grammar: 'spellcheck',
    style: 'palette',
    engagement: 'favorite',
    seo: 'search'
  }
  return icons[type as keyof typeof icons] || 'help'
}

const openAIConfig = () => {
  emit('open-ai-config')
}

const close = () => {
  isOpen.value = false
  // Reset state
  analysis.value = null
  suggestions.value = []
  error.value = ''
}

const rewriteCompletely = () => {
  quickAction('rewrite')
}
</script>

<style scoped>
.ai-assistant-drawer {
  border-left: 3px solid #1976d2;
}

.drawer-content {
  height: 100%;
  overflow-y: auto;
}

.analysis-metrics {
  display: flex;
  flex-direction: column;
  gap: 16px;
}

.metric-item {
  display: flex;
  align-items: center;
  gap: 12px;
}

.metric-label {
  min-width: 80px;
  font-weight: 500;
  font-size: 0.875rem;
}

.metric-score {
  min-width: 40px;
  text-align: right;
  font-weight: 600;
  font-size: 0.875rem;
}

.suggestion-item {
  padding: 16px;
}

.suggestion-header {
  display: flex;
  align-items: flex-start;
  margin-bottom: 12px;
}

.suggestion-info {
  flex: 1;
}

.suggestion-description {
  font-weight: 500;
  margin-bottom: 4px;
}

.suggestion-confidence {
  font-size: 0.75rem;
  color: #666;
}

.text-comparison {
  margin: 12px 0;
  padding: 12px;
  background: #f5f5f5;
  border-radius: 8px;
}

.original-text,
.suggested-text {
  margin: 8px 0;
}

.text-label {
  font-size: 0.75rem;
  font-weight: 600;
  color: #666;
  margin-bottom: 4px;
}

.text-content {
  padding: 8px;
  background: white;
  border-radius: 4px;
  border-left: 3px solid #ddd;
  font-size: 0.875rem;
}

.suggested-text .text-content {
  border-left-color: #4caf50;
}

.comparison-arrow {
  display: block;
  text-align: center;
  color: #666;
  margin: 8px 0;
}

.suggestion-actions {
  display: flex;
  gap: 8px;
  justify-content: flex-end;
  margin-top: 12px;
}

.quick-actions {
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.translation-options {
  display: flex;
  flex-wrap: wrap;
  gap: 4px;
}
</style>
```

---

## 🤖 AI Service Integration

### OpenAI Provider Implementation

```typescript
// src/ai/providers/openai-provider.ts
import type { AIProvider, GenerationOptions } from '../types'

export class OpenAIProvider implements AIProvider {
  private apiKey: string
  private baseUrl: string
  private model: string
  
  constructor(config: {
    apiKey: string
    baseUrl?: string
    model?: string
  }) {
    this.apiKey = config.apiKey
    this.baseUrl = config.baseUrl || 'https://api.openai.com/v1'
    this.model = config.model || 'gpt-4o-mini'
  }
  
  async generateContent(prompt: string, options: GenerationOptions = {}): Promise<string> {
    const response = await fetch(`${this.baseUrl}/chat/completions`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${this.apiKey}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        model: this.model,
        messages: [
          {
            role: 'system',
            content: this.getSystemPrompt(options)
          },
          {
            role: 'user',
            content: prompt
          }
        ],
        max_tokens: options.maxTokens || 500,
        temperature: options.temperature || 0.7
      })
    })
    
    if (!response.ok) {
      throw new Error(`OpenAI API error: ${response.statusText}`)
    }
    
    const data = await response.json()
    return data.choices[0]?.message?.content || ''
  }
  
  async improveText(text: string, instructions: string): Promise<string> {
    const prompt = `${instructions}\n\nOriginal text: "${text}"\n\nImproved text:`
    return this.generateContent(prompt, { maxTokens: 300 })
  }
  
  async analyzeContent(text: string): Promise<any> {
    const prompt = `Analyze this content for grammar, readability, engagement, and SEO. Return a JSON object with scores (0-100) and specific feedback:\n\n"${text}"`
    
    const response = await this.generateContent(prompt, {
      maxTokens: 400,
      temperature: 0.3
    })
    
    try {
      return JSON.parse(response)
    } catch {
      // Fallback if JSON parsing fails
      return this.createDefaultAnalysis()
    }
  }
  
  private getSystemPrompt(options: GenerationOptions): string {
    let prompt = 'You are an expert content creator specializing in web content and marketing copy.'
    
    if (options.industry) {
      prompt += ` You have extensive experience in the ${options.industry} industry.`
    }
    
    if (options.tone) {
      prompt += ` Always write in a ${options.tone} tone.`
    }
    
    prompt += ' Focus on creating engaging, clear, and actionable content. When generating blocks, return valid JSON with the structure requested.'
    
    return prompt
  }
  
  private createDefaultAnalysis() {
    return {
      grammar: { score: 85, issues: [] },
      readability: { score: 75, level: 'intermediate' },
      engagement: { score: 70, improvements: [] },
      seo: { score: 65, recommendations: [] }
    }
  }
}
```

### Claude Provider Implementation

```typescript
// src/ai/providers/claude-provider.ts
export class ClaudeProvider implements AIProvider {
  private apiKey: string
  private model: string
  
  constructor(config: { apiKey: string; model?: string }) {
    this.apiKey = config.apiKey
    this.model = config.model || 'claude-3-haiku-20240307'
  }
  
  async generateContent(prompt: string, options: GenerationOptions = {}): Promise<string> {
    const response = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'x-api-key': this.apiKey,
        'anthropic-version': '2023-06-01',
        'content-type': 'application/json'
      },
      body: JSON.stringify({
        model: this.model,
        max_tokens: options.maxTokens || 500,
        messages: [
          {
            role: 'user',
            content: `${this.getSystemPrompt(options)}\n\n${prompt}`
          }
        ]
      })
    })
    
    if (!response.ok) {
      throw new Error(`Claude API error: ${response.statusText}`)
    }
    
    const data = await response.json()
    return data.content[0]?.text || ''
  }
  
  // Similar implementation for other methods...
}
```

---

## ⚙️ Configuration System

### AI Configuration Store

```typescript
// src/ai/ai-config.ts
interface AIConfig {
  provider: 'openai' | 'claude' | 'custom'
  apiKey?: string
  baseUrl?: string
  model?: string
  defaultIndustry?: string
  defaultTone?: string
  defaultLanguage?: string
  autoAnalyze?: boolean
  maxRequestsPerMonth?: number
  currentUsage?: number
}

class AIConfigStore {
  private config: AIConfig
  private storageKey = 'directus-ai-config'
  
  constructor() {
    this.config = this.loadConfig()
  }
  
  private loadConfig(): AIConfig {
    const stored = localStorage.getItem(this.storageKey)
    if (stored) {
      try {
        return { ...this.getDefaultConfig(), ...JSON.parse(stored) }
      } catch {
        // Invalid JSON, use defaults
      }
    }
    return this.getDefaultConfig()
  }
  
  private getDefaultConfig(): AIConfig {
    return {
      provider: 'openai',
      defaultIndustry: 'technology',
      defaultTone: 'professional',
      defaultLanguage: 'en',
      autoAnalyze: true,
      maxRequestsPerMonth: 1000,
      currentUsage: 0
    }
  }
  
  saveConfig(config: Partial<AIConfig>) {
    this.config = { ...this.config, ...config }
    localStorage.setItem(this.storageKey, JSON.stringify(this.config))
  }
  
  getConfig(): AIConfig {
    return { ...this.config }
  }
  
  isConfigured(): boolean {
    return !!this.config.apiKey || this.config.provider === 'directus-cloud'
  }
  
  incrementUsage() {
    this.config.currentUsage = (this.config.currentUsage || 0) + 1
    this.saveConfig({ currentUsage: this.config.currentUsage })
  }
  
  hasUsageRemaining(): boolean {
    return (this.config.currentUsage || 0) < (this.config.maxRequestsPerMonth || 1000)
  }
}

export const aiConfigStore = new AIConfigStore()
```

---

## 🧪 Testing Strategy

### Unit Tests for AI Service

```typescript
// test/unit/ai/ai-service.spec.ts
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { AIService } from '@/ai/ai-service'
import type { AIProvider } from '@/ai/types'

describe('AIService', () => {
  let aiService: AIService
  let mockProvider: AIProvider
  
  beforeEach(() => {
    mockProvider = {
      generateContent: vi.fn(),
      improveText: vi.fn(),
      analyzeContent: vi.fn()
    }
    
    aiService = new AIService({
      provider: 'openai',
      apiKey: 'test-key'
    })
    
    // Replace provider with mock
    ;(aiService as any).provider = mockProvider
  })
  
  describe('generateBlockContent', () => {
    it('should generate block content from description', async () => {
      const mockResponse = JSON.stringify({
        title: 'Test Title',
        content: 'Test content',
        metadata: { callToAction: 'Click here' }
      })
      
      mockProvider.generateContent = vi.fn().mockResolvedValue(mockResponse)
      
      const result = await aiService.generateBlockContent(
        'Create a hero section for a tech startup',
        { blockType: 'hero', industry: 'technology' }
      )
      
      expect(result.title).toBe('Test Title')
      expect(result.content).toBe('Test content')
      expect(mockProvider.generateContent).toHaveBeenCalledWith(
        expect.stringContaining('Generate content for a hero block'),
        expect.any(Object)
      )
    })
    
    it('should handle context information', async () => {
      mockProvider.generateContent = vi.fn().mockResolvedValue('{"title":"Test","content":"Test"}')
      
      await aiService.generateBlockContent(
        'Add testimonial section',
        { blockType: 'testimonial' },
        { 
          pageType: 'landing-page',
          existingBlocks: [{ type: 'hero', title: 'Welcome' }]
        }
      )
      
      expect(mockProvider.generateContent).toHaveBeenCalledWith(
        expect.stringContaining('Page type: landing-page'),
        expect.any(Object)
      )
    })
  })
  
  describe('suggestImprovements', () => {
    it('should return improvement suggestions', async () => {
      mockProvider.improveText = vi.fn()
        .mockResolvedValueOnce('Improved grammar text')
        .mockResolvedValueOnce('More engaging text')
      
      const suggestions = await aiService.suggestImprovements(
        'This is test content.',
        ['grammar', 'engagement']
      )
      
      expect(suggestions).toHaveLength(2)
      expect(suggestions[0].type).toBe('grammar')
      expect(suggestions[1].type).toBe('engagement')
    })
  })
})
```

### E2E Tests for AI Features

```typescript
// e2e/specs/ai-features.spec.ts
import { test, expect } from '@playwright/test'

test.describe('AI Features', () => {
  test.beforeEach(async ({ page }) => {
    // Setup AI configuration with test API key
    await page.goto('/admin/settings/ai')
    await page.fill('[data-testid="api-key-input"]', 'test-api-key')
    await page.click('[data-testid="save-config"]')
  })
  
  test('should generate block with AI', async ({ page }) => {
    await page.goto('/admin/content/pages/9999')
    
    // Click add block
    await page.click('[data-testid="add-block"]')
    
    // Click AI option
    await page.click('[data-testid="ai-generate"]')
    
    // Fill description
    await page.fill('[data-testid="ai-description"]', 'Hero section for SaaS product')
    
    // Click generate
    await page.click('[data-testid="generate-button"]')
    
    // Wait for generation
    await expect(page.locator('[data-testid="generated-content"]')).toBeVisible()
    
    // Add block
    await page.click('[data-testid="add-generated-block"]')
    
    // Verify block was added
    await expect(page.locator('.block-item')).toContainText('SaaS')
  })
  
  test('should open AI assistant drawer', async ({ page }) => {
    await page.goto('/admin/content/pages/9999')
    
    // Click AI button on first block
    await page.click('.block-item:first-child [data-testid="ai-assistant"]')
    
    // Verify drawer opened
    await expect(page.locator('[data-testid="ai-drawer"]')).toBeVisible()
    
    // Verify analysis started
    await expect(page.locator('[data-testid="analyzing-content"]')).toBeVisible()
  })
})
```

---

## 🚀 Deployment & Distribution

### NPM Package Configuration

```json
// package.json additions
{
  "name": "directus-extension-expandable-blocks",
  "version": "2.0.0",
  "keywords": [
    "directus",
    "extension",
    "interface",
    "blocks",
    "ai",
    "content-management"
  ],
  "peerDependencies": {
    "@directus/extensions-sdk": "^11.0.0"
  },
  "dependencies": {
    "vue": "^3.3.0"
  },
  "files": [
    "dist/**/*",
    "README.md",
    "AI_BLOCK_ASSISTANT.md"
  ],
  "directus:extension": {
    "type": "interface",
    "path": "dist/index.js",
    "source": "src/index.ts",
    "host": "^11.0.0"
  }
}
```

### Build Configuration Updates

```typescript
// Update src/index.ts to export AI components
export { default as default } from './interface.vue'
export { AIService } from './ai/ai-service'
export { AIConfigStore } from './ai/ai-config'

// Make AI features optional
export const aiFeatures = {
  available: true,
  version: '2.0.0'
}
```

### Installation Guide

```markdown
# Installation & Setup

## 1. Install Extension
```bash
npm install directus-extension-expandable-blocks
```

## 2. Configure AI (Optional)
1. Go to Settings → Extensions → Expandable Blocks
2. Enable AI Features
3. Configure your preferred AI provider:
   - **OpenAI**: Requires API key from OpenAI
   - **Claude**: Requires API key from Anthropic
   - **Directus Cloud AI**: Coming soon (no key required)

## 3. API Key Setup
- Get your API key from [OpenAI](https://platform.openai.com/api-keys) or [Anthropic](https://console.anthropic.com/)
- Enter in extension settings
- Test connection

## 4. Start Using AI Features
- Click ✨ AI button in any block for assistance
- Use "Generate with AI" when adding new blocks
- Enjoy intelligent content suggestions!
```

---

## 📈 Performance & Security

### Performance Optimizations

1. **Lazy Loading**: AI components only load when needed
2. **Request Caching**: Cache AI responses for identical prompts
3. **Debounced Analysis**: Wait for user to stop typing before analyzing
4. **Progressive Enhancement**: Extension works without AI configuration

### Security Considerations

1. **Client-Side Only**: No server-side AI processing
2. **User-Owned Keys**: API keys stored locally, never transmitted to our servers
3. **Opt-in Features**: AI features must be explicitly enabled
4. **Rate Limiting**: Built-in usage tracking and limits
5. **Content Privacy**: User content only sent to chosen AI provider

### Error Handling

```typescript
// Robust error handling for AI operations
class AIErrorHandler {
  static handle(error: any, operation: string): string {
    if (error.status === 401) {
      return 'Invalid API key. Please check your AI configuration.'
    }
    
    if (error.status === 429) {
      return 'Rate limit exceeded. Please try again later.'
    }
    
    if (error.status >= 500) {
      return 'AI service temporarily unavailable. Please try again.'
    }
    
    return `Failed to ${operation}. Please check your internet connection and try again.`
  }
}
```

---

This comprehensive implementation guide provides everything needed to build the AI Block Assistant feature as a seamless part of the expandable-blocks extension. The system is designed to be:

- **Client-side only** (no server dependencies)
- **Provider agnostic** (works with multiple AI services)
- **NPM distributable** (standard Directus extension)
- **Privacy-focused** (user owns their data and keys)
- **Progressively enhanced** (works without AI)

The implementation can be done in phases, allowing for incremental deployment and testing of features.