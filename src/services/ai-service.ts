export interface AIProvider {
  name: string;
  apiKey: string;
  model?: string;
  baseUrl?: string;
}

export interface AIRequest {
  prompt: string;
  context?: string;
  temperature?: number;
  maxTokens?: number;
  pageContext?: {
    title?: string;
    type?: string;
    description?: string;
    url?: string;
  };
  blockContext?: {
    type: string;
    position?: number;
    totalBlocks?: number;
    allFields: Record<string, any>;
    targetField?: string;
    targetFields?: string[];
    selectedFieldsOnly?: boolean;
  };
  neighborBlocks?: Array<{
    type: string;
    title?: string;
    content?: string;
  }>;
}

export interface AIResponse {
  content: string;
  multiFieldContent?: Record<string, string>; // For structured multi-field responses
  usage?: {
    promptTokens: number;
    completionTokens: number;
    totalTokens: number;
  };
  error?: string;
}

export interface AIConfig {
  provider: 'openai' | 'claude' | 'custom';
  apiKey: string;
  model: string;
  baseUrl?: string;
  temperature: number;
  maxTokens: number;
  enabled: boolean;
}

export class AIService {
  private config: AIConfig | null = null;

  constructor() {
    this.loadConfig();
  }

  private loadConfig(): void {
    try {
      const saved = localStorage.getItem('expandable-blocks-ai-config');
      if (saved) {
        this.config = JSON.parse(saved);
      }
    } catch (error) {
      console.warn('Failed to load AI config:', error);
    }
  }

  public saveConfig(config: AIConfig): void {
    this.config = config;
    try {
      localStorage.setItem('expandable-blocks-ai-config', JSON.stringify(config));
    } catch (error) {
      console.error('Failed to save AI config:', error);
    }
  }

  public getConfig(): AIConfig | null {
    return this.config;
  }

  public isConfigured(): boolean {
    return !!(this.config?.enabled && this.config?.apiKey && this.config?.provider);
  }

  public async generateContent(request: AIRequest): Promise<AIResponse> {
    if (!this.isConfigured()) {
      return {
        content: '',
        error: 'AI service is not configured. Please configure your AI provider in the settings.'
      };
    }

    // Build enhanced context
    const enhancedRequest = this.buildEnhancedContext(request);

    try {
      switch (this.config!.provider) {
        case 'openai':
          return await this.callOpenAI(enhancedRequest);
        case 'claude':
          return await this.callClaude(enhancedRequest);
        case 'custom':
          return await this.callCustomAPI(enhancedRequest);
        default:
          return {
            content: '',
            error: `Unsupported AI provider: ${this.config!.provider}`
          };
      }
    } catch (error) {
      console.error('AI generation failed:', error);
      return {
        content: '',
        error: error instanceof Error ? error.message : 'Unknown error occurred'
      };
    }
  }

  private buildEnhancedContext(request: AIRequest): AIRequest {
    let contextParts: string[] = [];

    // Add page context
    if (request.pageContext) {
      contextParts.push('=== PAGE CONTEXT ===');
      if (request.pageContext.title) {
        contextParts.push(`Page Title: ${request.pageContext.title}`);
      }
      if (request.pageContext.type) {
        contextParts.push(`Page Type: ${request.pageContext.type}`);
      }
      if (request.pageContext.description) {
        contextParts.push(`Page Description: ${request.pageContext.description}`);
      }
      contextParts.push('');
    }

    // Add block context
    if (request.blockContext) {
      contextParts.push('=== CURRENT BLOCK CONTEXT ===');
      contextParts.push(`Block Type: ${request.blockContext.type}`);
      
      if (request.blockContext.position && request.blockContext.totalBlocks) {
        contextParts.push(`Position: Block ${request.blockContext.position} of ${request.blockContext.totalBlocks}`);
      }
      
      if (request.blockContext.targetFields && request.blockContext.targetFields.length > 0) {
        contextParts.push(`Target Fields: ${request.blockContext.targetFields.join(', ')}`);
      } else if (request.blockContext.targetField) {
        contextParts.push(`Target Field: ${request.blockContext.targetField}`);
      }

      // Add all block fields for context
      if (request.blockContext.allFields) {
        contextParts.push('\nCurrent Block Content:');
        Object.entries(request.blockContext.allFields).forEach(([key, value]) => {
          if (value && typeof value === 'string' && value.trim()) {
            const label = key.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase());
            const isTargetField = request.blockContext?.targetFields?.includes(key) || 
                                  request.blockContext?.targetField === key;
            const marker = isTargetField ? '🎯 ' : '- ';
            contextParts.push(`${marker}${label}: ${value.substring(0, 100)}${value.length > 100 ? '...' : ''}`);
          }
        });
      }
      contextParts.push('');
    }

    // Add neighbor blocks context
    if (request.neighborBlocks && request.neighborBlocks.length > 0) {
      contextParts.push('=== SURROUNDING BLOCKS CONTEXT ===');
      request.neighborBlocks.forEach((block, index) => {
        contextParts.push(`Block ${index + 1}: ${block.type}`);
        if (block.title) {
          contextParts.push(`  Title: ${block.title}`);
        }
        if (block.content) {
          contextParts.push(`  Content: ${block.content.substring(0, 80)}${block.content.length > 80 ? '...' : ''}`);
        }
      });
      contextParts.push('');
    }

    // Combine original context with enhanced context
    const enhancedContext = contextParts.length > 0 
      ? contextParts.join('\n') + (request.context ? `\n${request.context}` : '')
      : request.context;

    return {
      ...request,
      context: enhancedContext
    };
  }

  private async callOpenAI(request: AIRequest): Promise<AIResponse> {
    const response = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${this.config!.apiKey}`
      },
      body: JSON.stringify({
        model: this.config!.model || 'gpt-3.5-turbo',
        messages: [
          {
            role: 'system',
            content: 'You are a helpful assistant for creating and improving web content blocks. Provide clear, concise, and engaging content.'
          },
          {
            role: 'user',
            content: request.context ? `${request.context}\n\n${request.prompt}` : request.prompt
          }
        ],
        temperature: request.temperature ?? this.config!.temperature,
        max_tokens: request.maxTokens ?? this.config!.maxTokens
      })
    });

    if (!response.ok) {
      const error = await response.json().catch(() => ({}));
      throw new Error(error.error?.message || `OpenAI API error: ${response.status}`);
    }

    const data = await response.json();
    return {
      content: data.choices[0]?.message?.content || '',
      usage: {
        promptTokens: data.usage?.prompt_tokens || 0,
        completionTokens: data.usage?.completion_tokens || 0,
        totalTokens: data.usage?.total_tokens || 0
      }
    };
  }

  private async callClaude(request: AIRequest): Promise<AIResponse> {
    const response = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${this.config!.apiKey}`,
        'anthropic-version': '2023-06-01'
      },
      body: JSON.stringify({
        model: this.config!.model || 'claude-3-haiku-20240307',
        max_tokens: request.maxTokens ?? this.config!.maxTokens,
        temperature: request.temperature ?? this.config!.temperature,
        messages: [
          {
            role: 'user',
            content: request.context ? `${request.context}\n\n${request.prompt}` : request.prompt
          }
        ]
      })
    });

    if (!response.ok) {
      const error = await response.json().catch(() => ({}));
      throw new Error(error.error?.message || `Claude API error: ${response.status}`);
    }

    const data = await response.json();
    return {
      content: data.content[0]?.text || '',
      usage: {
        promptTokens: data.usage?.input_tokens || 0,
        completionTokens: data.usage?.output_tokens || 0,
        totalTokens: (data.usage?.input_tokens || 0) + (data.usage?.output_tokens || 0)
      }
    };
  }

  private async callCustomAPI(request: AIRequest): Promise<AIResponse> {
    if (!this.config!.baseUrl) {
      throw new Error('Custom API base URL is required');
    }

    const response = await fetch(`${this.config!.baseUrl}/generate`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${this.config!.apiKey}`
      },
      body: JSON.stringify({
        prompt: request.context ? `${request.context}\n\n${request.prompt}` : request.prompt,
        model: this.config!.model,
        temperature: request.temperature ?? this.config!.temperature,
        max_tokens: request.maxTokens ?? this.config!.maxTokens
      })
    });

    if (!response.ok) {
      const error = await response.json().catch(() => ({}));
      throw new Error(error.message || `Custom API error: ${response.status}`);
    }

    const data = await response.json();
    return {
      content: data.content || data.text || '',
      usage: data.usage
    };
  }

  public async improveContent(
    content: string, 
    improvementType: string, 
    context?: {
      pageContext?: AIRequest['pageContext'];
      blockContext?: AIRequest['blockContext'];
      neighborBlocks?: AIRequest['neighborBlocks'];
    }
  ): Promise<AIResponse> {
    const prompts = {
      grammar: `Please improve the grammar and spelling of the following text while maintaining its original meaning and tone:\n\n${content}`,
      style: `Please improve the writing style of the following text to make it more engaging and professional:\n\n${content}`,
      clarity: `Please rewrite the following text to make it clearer and more concise:\n\n${content}`,
      tone: `Please adjust the tone of the following text to be more appropriate for web content:\n\n${content}`,
      seo: `Please optimize the following text for SEO while maintaining readability:\n\n${content}`
    };

    const prompt = prompts[improvementType as keyof typeof prompts] || prompts.style;
    
    return this.generateContent({
      prompt,
      context: 'This is content from a web page content block. Please provide only the improved text without additional explanations. Consider the page and block context to ensure the content fits well with the overall page structure and messaging.',
      pageContext: context?.pageContext,
      blockContext: context?.blockContext,
      neighborBlocks: context?.neighborBlocks
    });
  }

  public async generateBlockContent(
    blockType: string, 
    description: string,
    context?: {
      pageContext?: AIRequest['pageContext'];
      blockContext?: AIRequest['blockContext'];
      neighborBlocks?: AIRequest['neighborBlocks'];
    }
  ): Promise<AIResponse> {
    // Identify available fields from block context
    const availableFields = context?.blockContext?.allFields || {};
    let fieldNames = Object.keys(availableFields).filter(field => 
      !['id', 'status', 'sort', 'user_created', 'date_created', 'user_updated', 'date_updated'].includes(field)
    );

    // Use only selected fields if specified
    if (context?.blockContext?.targetFields && context.blockContext.targetFields.length > 0) {
      fieldNames = context.blockContext.targetFields;
      console.log('🔍 Using selected fields only:', fieldNames);
    }

    // Create structured prompt for multi-field generation
    const structuredPrompt = this.buildMultiFieldPrompt(blockType, description, fieldNames);

    const response = await this.generateContent({
      prompt: structuredPrompt,
      context: 'This content will be used in a web page content management system. Provide structured, ready-to-use content that fits well with the overall page context and surrounding content.',
      pageContext: context?.pageContext,
      blockContext: context?.blockContext,
      neighborBlocks: context?.neighborBlocks
    });

    // Parse structured response
    const parsedResponse = this.parseMultiFieldResponse(response.content, fieldNames);
    
    return {
      ...response,
      multiFieldContent: parsedResponse
    };
  }

  private buildMultiFieldPrompt(blockType: string, description: string, fieldNames: string[]): string {
    const fieldDescriptions = this.getFieldDescriptions();
    
    let prompt = `Create content for a ${blockType} block about: ${description}\n\n`;
    prompt += `Please provide content for the following fields:\n\n`;
    
    fieldNames.forEach(field => {
      const fieldLabel = field.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase());
      const fieldDesc = fieldDescriptions[field] || `Content for ${fieldLabel}`;
      prompt += `**${fieldLabel}** (${field}): ${fieldDesc}\n`;
    });

    prompt += `\nPlease format your response like this:\n`;
    fieldNames.forEach(field => {
      const fieldLabel = field.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase());
      prompt += `\n**${fieldLabel}:**\n[Your content here]\n`;
    });

    prompt += `\nEnsure each field's content is appropriate for its purpose and works well together as a cohesive block.`;

    return prompt;
  }

  private getFieldDescriptions(): Record<string, string> {
    return {
      headline: 'A compelling main headline that grabs attention',
      title: 'A clear and descriptive title',
      subheadline: 'A supporting subheadline that adds context',
      subtitle: 'A descriptive subtitle that complements the main title',
      content: 'The main body content with detailed information',
      text: 'Informative text content',
      description: 'A clear description of the content or offering',
      summary: 'A brief summary or overview',
      excerpt: 'A short excerpt or preview',
      intro: 'An engaging introduction',
      button_text: 'Compelling call-to-action button text',
      cta_text: 'Call-to-action text that motivates action',
      link_text: 'Descriptive link text',
      quote: 'An inspiring or relevant quote',
      testimonial: 'Customer testimonial or review text',
      author: 'Author name or attribution',
      name: 'Name or identifier',
      label: 'A descriptive label'
    };
  }

  private parseMultiFieldResponse(content: string, fieldNames: string[]): Record<string, string> {
    const result: Record<string, string> = {};
    
    // Try to parse structured response with **Field Name:** format
    fieldNames.forEach(field => {
      const fieldLabel = field.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase());
      const regex = new RegExp(`\\*\\*${fieldLabel}\\*\\*:?\\s*([\\s\\S]*?)(?=\\*\\*|$)`, 'i');
      const match = content.match(regex);
      
      if (match && match[1]) {
        result[field] = match[1].trim();
      }
    });

    // Fallback: if structured parsing fails, try to extract content intelligently
    if (Object.keys(result).length === 0 && fieldNames.length > 0) {
      // For single field, use entire content
      if (fieldNames.length === 1) {
        result[fieldNames[0]] = content.trim();
      } else {
        // For multiple fields, try to split content logically
        const lines = content.split('\n').filter(line => line.trim());
        if (lines.length >= fieldNames.length) {
          fieldNames.forEach((field, index) => {
            if (lines[index]) {
              result[field] = lines[index].trim();
            }
          });
        } else {
          // Fallback: assign content to first field
          result[fieldNames[0]] = content.trim();
        }
      }
    }

    return result;
  }

  public getDefaultConfig(): AIConfig {
    return {
      provider: 'openai',
      apiKey: '',
      model: 'gpt-3.5-turbo',
      temperature: 0.7,
      maxTokens: 1000,
      enabled: false
    };
  }
}

export const aiService = new AIService();