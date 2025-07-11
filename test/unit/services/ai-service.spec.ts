import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest';
import { AIService, type AIConfig } from '@/services/ai-service';

// Mock localStorage
const localStorageMock = {
  getItem: vi.fn(),
  setItem: vi.fn(),
  removeItem: vi.fn(),
  clear: vi.fn()
};

Object.defineProperty(window, 'localStorage', {
  value: localStorageMock
});

// Mock fetch
global.fetch = vi.fn();

describe('AIService', () => {
  let aiService: AIService;

  beforeEach(() => {
    vi.clearAllMocks();
    aiService = new AIService();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe('Configuration Management', () => {
    it('loads default config when localStorage is empty', () => {
      localStorageMock.getItem.mockReturnValue(null);
      
      const newService = new AIService();
      const config = newService.getConfig();
      
      expect(config).toBeNull();
      expect(localStorageMock.getItem).toHaveBeenCalledWith('expandable-blocks-ai-config');
    });

    it('loads saved config from localStorage', () => {
      const savedConfig: AIConfig = {
        provider: 'openai',
        apiKey: 'test-key',
        model: 'gpt-3.5-turbo',
        temperature: 0.7,
        maxTokens: 1000,
        enabled: true
      };
      
      localStorageMock.getItem.mockReturnValue(JSON.stringify(savedConfig));
      
      const newService = new AIService();
      const config = newService.getConfig();
      
      expect(config).toEqual(savedConfig);
    });

    it('saves config to localStorage', () => {
      const config: AIConfig = {
        provider: 'claude',
        apiKey: 'claude-key',
        model: 'claude-3-haiku-20240307',
        temperature: 0.5,
        maxTokens: 2000,
        enabled: true
      };
      
      aiService.saveConfig(config);
      
      expect(localStorageMock.setItem).toHaveBeenCalledWith(
        'expandable-blocks-ai-config',
        JSON.stringify(config)
      );
      expect(aiService.getConfig()).toEqual(config);
    });

    it('handles localStorage errors gracefully', () => {
      localStorageMock.getItem.mockImplementation(() => {
        throw new Error('localStorage error');
      });
      
      // Should not throw
      const newService = new AIService();
      expect(newService.getConfig()).toBeNull();
    });
  });

  describe('Configuration Validation', () => {
    it('returns false for isConfigured when not configured', () => {
      expect(aiService.isConfigured()).toBe(false);
    });

    it('returns true for isConfigured when properly configured', () => {
      const config: AIConfig = {
        provider: 'openai',
        apiKey: 'test-key',
        model: 'gpt-3.5-turbo',
        temperature: 0.7,
        maxTokens: 1000,
        enabled: true
      };
      
      aiService.saveConfig(config);
      expect(aiService.isConfigured()).toBe(true);
    });

    it('returns false when enabled is false', () => {
      const config: AIConfig = {
        provider: 'openai',
        apiKey: 'test-key',
        model: 'gpt-3.5-turbo',
        temperature: 0.7,
        maxTokens: 1000,
        enabled: false
      };
      
      aiService.saveConfig(config);
      expect(aiService.isConfigured()).toBe(false);
    });
  });

  describe('Content Generation', () => {
    beforeEach(() => {
      const config: AIConfig = {
        provider: 'openai',
        apiKey: 'test-key',
        model: 'gpt-3.5-turbo',
        temperature: 0.7,
        maxTokens: 1000,
        enabled: true
      };
      aiService.saveConfig(config);
    });

    it('returns error when not configured', async () => {
      const unconfiguredService = new AIService();
      
      const response = await unconfiguredService.generateContent({
        prompt: 'Test prompt'
      });
      
      expect(response.error).toContain('not configured');
      expect(response.content).toBe('');
    });

    it('makes successful OpenAI API call', async () => {
      const mockResponse = {
        choices: [{ message: { content: 'Generated content' } }],
        usage: { prompt_tokens: 10, completion_tokens: 20, total_tokens: 30 }
      };
      
      (global.fetch as any).mockResolvedValue({
        ok: true,
        json: () => Promise.resolve(mockResponse)
      });
      
      const response = await aiService.generateContent({
        prompt: 'Test prompt',
        context: 'Test context'
      });
      
      expect(response.content).toBe('Generated content');
      expect(response.usage).toEqual({
        promptTokens: 10,
        completionTokens: 20,
        totalTokens: 30
      });
      expect(response.error).toBeUndefined();
    });

    it('handles OpenAI API errors', async () => {
      (global.fetch as any).mockResolvedValue({
        ok: false,
        status: 401,
        json: () => Promise.resolve({
          error: { message: 'Invalid API key' }
        })
      });
      
      const response = await aiService.generateContent({
        prompt: 'Test prompt'
      });
      
      expect(response.content).toBe('');
      expect(response.error).toContain('Invalid API key');
    });

    it('handles network errors', async () => {
      (global.fetch as any).mockRejectedValue(new Error('Network error'));
      
      const response = await aiService.generateContent({
        prompt: 'Test prompt'
      });
      
      expect(response.content).toBe('');
      expect(response.error).toContain('Network error');
    });
  });

  describe('Content Improvement', () => {
    beforeEach(() => {
      const config: AIConfig = {
        provider: 'openai',
        apiKey: 'test-key',
        model: 'gpt-3.5-turbo',
        temperature: 0.7,
        maxTokens: 1000,
        enabled: true
      };
      aiService.saveConfig(config);
    });

    it('generates grammar improvement prompt', async () => {
      (global.fetch as any).mockResolvedValue({
        ok: true,
        json: () => Promise.resolve({
          choices: [{ message: { content: 'Improved content' } }]
        })
      });
      
      await aiService.improveContent('Test content', 'grammar');
      
      expect(global.fetch).toHaveBeenCalledWith(
        'https://api.openai.com/v1/chat/completions',
        expect.objectContaining({
          body: expect.stringContaining('grammar and spelling')
        })
      );
    });

    it('generates style improvement prompt', async () => {
      (global.fetch as any).mockResolvedValue({
        ok: true,
        json: () => Promise.resolve({
          choices: [{ message: { content: 'Improved content' } }]
        })
      });
      
      await aiService.improveContent('Test content', 'style');
      
      expect(global.fetch).toHaveBeenCalledWith(
        'https://api.openai.com/v1/chat/completions',
        expect.objectContaining({
          body: expect.stringContaining('writing style')
        })
      );
    });
  });

  describe('Block Content Generation', () => {
    beforeEach(() => {
      const config: AIConfig = {
        provider: 'openai',
        apiKey: 'test-key',
        model: 'gpt-3.5-turbo',
        temperature: 0.7,
        maxTokens: 1000,
        enabled: true
      };
      aiService.saveConfig(config);
    });

    it('generates hero block content', async () => {
      (global.fetch as any).mockResolvedValue({
        ok: true,
        json: () => Promise.resolve({
          choices: [{ message: { content: 'Hero content' } }]
        })
      });
      
      await aiService.generateBlockContent('hero', 'SaaS landing page');
      
      expect(global.fetch).toHaveBeenCalledWith(
        'https://api.openai.com/v1/chat/completions',
        expect.objectContaining({
          body: expect.stringContaining('hero section')
        })
      );
    });

    it('handles unknown block types', async () => {
      (global.fetch as any).mockResolvedValue({
        ok: true,
        json: () => Promise.resolve({
          choices: [{ message: { content: 'Custom content' } }]
        })
      });
      
      await aiService.generateBlockContent('custom', 'Custom description');
      
      expect(global.fetch).toHaveBeenCalledWith(
        'https://api.openai.com/v1/chat/completions',
        expect.objectContaining({
          body: expect.stringContaining('custom block')
        })
      );
    });
  });

  describe('Default Configuration', () => {
    it('returns correct default config', () => {
      const defaultConfig = aiService.getDefaultConfig();
      
      expect(defaultConfig).toEqual({
        provider: 'openai',
        apiKey: '',
        model: 'gpt-3.5-turbo',
        temperature: 0.7,
        maxTokens: 1000,
        enabled: false
      });
    });
  });
});